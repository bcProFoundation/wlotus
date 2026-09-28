/**
 * Single-shard δ (ULOTUS) — ecash-lib-backed P2SH assembly.
 *
 * Two-pass build, Moore-style: the code bytes are FIXED (every param
 * arrives via the stack), so codeHash is a protocol constant; econHead
 * carries the token params (prefixHash commits to them); the 9B state
 * chunk (day+target) ratchets every remint.
 *
 * Layout: econHead(83) | prefixHash push(33) | state push(9) | code.
 * Witness push order (bottom→top): nextRedeem | minerPk | s | nonce |
 * preimage, then the redeem push. Exactly one CODESEPARATOR (index 0).
 */
import { createHash } from 'node:crypto';
import {
  Address,
  shaRmd160,
  toHex,
  Script as EcashScript,
} from 'ecash-lib';
import {
  assemble,
  encodePush,
  simulateUdeltaCode,
  udeltaCodeUnits,
  UDELTA_ECON_LEN,
  UDELTA_HEAD_LEN,
} from './singleShardDeltaMath.js';

export interface SingleShardDeltaParams {
  tokenId: string;
  mintAtoms: bigint;
  genesisUnix: number;
  daySeconds: number;
  /** Deploy-time target (tipTarget at genesis). NOT baked in the redeem — */
  /** derivation ratchets from the tip; carried for the TS mirror + records. */
  genesisTarget: number;
  tipDay: number;
  tipTarget: number;
}

export interface SingleShardDeltaContract {
  params: SingleShardDeltaParams;
  /** Fixed code bytes (no params inside). */
  code: Buffer;
  codeHash: Buffer;
  prefixHash: Buffer;
  redeem: Buffer;
  redeemScript: EcashScript;
  scriptHash: Uint8Array;
  p2shScript: EcashScript;
  address: string;
  redeemHex: string;
  /** Consensus op count + max stack depths from the depth simulator. */
  ops: number;
  maxMain: number;
  maxAlt: number;
}

const sha256 = (b: Uint8Array): Buffer =>
  createHash('sha256').update(b).digest();

function u32Le(n: number, what: string): Buffer {
  if (!Number.isInteger(n) || n < 0 || n >= 0x80000000) {
    throw new Error(`${what} out of Script-safe u32 range: ${n}`);
  }
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

function mintAtomsLe6(atoms: bigint): Buffer {
  if (atoms < 0n || atoms >= 1n << 48n) {
    throw new Error(`mintAtoms out of u48 range: ${atoms}`);
  }
  const buf = Buffer.alloc(6);
  buf.writeUInt32LE(Number(atoms & 0xffffffffn), 0);
  buf.writeUInt16LE(Number(atoms >> 32n), 4);
  return buf;
}

function fromHexRev(hex: string): Buffer {
  const b = Buffer.from(hex, 'hex');
  if (b.length !== 32) throw new Error(`tokenId must be 32 bytes`);
  return Buffer.from(b).reverse();
}

let cachedCode: Buffer | undefined;
let cachedSim: { ops: number; maxMain: number; maxAlt: number } | undefined;

function codeBytes(): Buffer {
  if (!cachedCode) {
    cachedCode = Buffer.from(assemble(udeltaCodeUnits()));
  }
  return cachedCode;
}

/** Depth-simulate the fixed code (12 stack items at entry: 7 head + 5 witness). */
export function simUdelta(): { ops: number; maxMain: number; maxAlt: number } {
  if (!cachedSim) {
    cachedSim = simulateUdeltaCode(udeltaCodeUnits(), 12);
  }
  return cachedSim;
}

export function createSingleShardDeltaContract(
  params: SingleShardDeltaParams,
): SingleShardDeltaContract {
  const sim = simUdelta();
  const code = codeBytes();
  const codeHash = sha256(code);
  const econHead = Buffer.concat([
    Buffer.from(encodePush(fromHexRev(params.tokenId))),
    Buffer.from(encodePush(mintAtomsLe6(params.mintAtoms))),
    Buffer.from(encodePush(u32Le(params.genesisUnix, 'genesisUnix'))),
    Buffer.from(encodePush(u32Le(params.daySeconds, 'daySeconds'))),
    Buffer.from(encodePush(codeHash)),
  ]);
  if (econHead.length !== UDELTA_ECON_LEN) {
    throw new Error(`econHead ${econHead.length}B != ${UDELTA_ECON_LEN}`);
  }
  const prefixHash = sha256(econHead);
  const redeem = Buffer.concat([
    econHead,
    Buffer.from(encodePush(prefixHash)),
    Buffer.from(
      encodePush(
        Buffer.concat([
          u32Le(params.tipDay, 'tipDay'),
          u32Le(params.tipTarget, 'tipTarget'),
        ]),
      ),
    ),
    code,
  ]);
  if (redeem.length > 520) {
    throw new Error(`redeem ${redeem.length}B exceeds 520 (push limit)`);
  }
  // Layout self-check: head/skip/state offsets the code hard-codes.
  if (redeem[UDELTA_ECON_LEN] !== 0x20) {
    throw new Error('prefixHash push tag moved (code assumes 0x20@83)');
  }
  if (redeem[UDELTA_HEAD_LEN - 9] !== 0x08) {
    throw new Error('state push tag moved (code assumes 0x08@116)');
  }
  const redeemScript = new EcashScript(new Uint8Array(redeem));
  const scriptHash = shaRmd160(redeemScript.bytecode);
  const p2shScript = EcashScript.p2sh(scriptHash);
  return {
    params,
    code,
    codeHash,
    prefixHash,
    redeem,
    redeemScript,
    scriptHash,
    p2shScript,
    address: Address.p2sh(scriptHash, 'ecash').toString(),
    redeemHex: toHex(redeemScript.bytecode),
    ops: sim.ops,
    maxMain: sim.maxMain,
    maxAlt: sim.maxAlt,
  };
}

function pushToScriptSig(out: number[], payload: Uint8Array): void {
  const enc = encodePush(payload);
  for (const b of enc) out.push(b);
}

/**
 * Build the P2SH scriptSig: witness pushes in covenant order
 * (nextRedeem | minerPk | s | nonce | preimage) + redeem push.
 */
export function buildUdeltaScriptSig(opts: {
  nextRedeem: Uint8Array;
  minerPk: Uint8Array;
  sig65: Uint8Array;
  nonce: Uint8Array;
  preimage: Uint8Array;
  redeem: Uint8Array;
}): EcashScript {
  const out: number[] = [];
  pushToScriptSig(out, opts.nextRedeem);
  pushToScriptSig(out, opts.minerPk);
  pushToScriptSig(out, opts.sig65);
  pushToScriptSig(out, opts.nonce);
  pushToScriptSig(out, opts.preimage);
  pushToScriptSig(out, opts.redeem);
  return new EcashScript(new Uint8Array(out));
}
