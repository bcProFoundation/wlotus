/**
 * Single-shard δ P2SH assembly for v5 (durable generation).
 *
 * Mirrors singleShardDeltaScript.ts with the v5 layout:
 * - econHead (85B): tokenId01(33B data) + mintAtoms01(7B data) + genesis(4)
 *   + daySeconds(4) + codeHash(32) — the trailing 01s are the ALP MINT
 *   separators, pre-joined into the center pushes to save two script CATs.
 *   Pinned mint bytes are IDENTICAL to v4 (50B, 0x32).
 * - prefixHash push (33B) at offset 85, state push (0x09 + 9B) at 118.
 * - state9 = slotLe(4).mLe(4).eByte; head total 128B; CODE (194 ops).
 *
 * The witness order / scriptSig builder is unchanged from v4 — reuse
 * buildUdeltaScriptSig from singleShardDeltaScript.ts.
 */
import { createHash } from 'node:crypto';
import { Address, shaRmd160, Script as EcashScript } from 'ecash-lib';
import {
  assemble,
  encodePush,
  simulateUdeltaCode,
} from './singleShardDeltaMath.js';
import {
  UDELTA_V5_ECON_LEN,
  UDELTA_V5_E_MAX,
  UDELTA_V5_E_MIN,
  UDELTA_V5_HEAD_LEN,
  simUdeltaV5,
  udeltaV5CodeUnits,
} from './singleShardDeltaMathV5.js';

export interface SingleShardDeltaV5Params {
  tokenId: string;
  mintAtoms: bigint;
  genesisUnix: number;
  daySeconds: number;
  tipDay: number;
  m: number;
  e: number;
}

export interface SingleShardDeltaV5Contract {
  params: SingleShardDeltaV5Params;
  code: Buffer;
  codeHash: Buffer;
  prefixHash: Buffer;
  redeem: Buffer;
  redeemScript: EcashScript;
  scriptHash: Uint8Array;
  p2shScript: EcashScript;
  address: string;
  redeemHex: string;
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

function codeBytes(): Buffer {
  if (!cachedCode) {
    cachedCode = Buffer.from(assemble(udeltaV5CodeUnits()));
  }
  return cachedCode;
}

export function createSingleShardDeltaContractV5(
  params: SingleShardDeltaV5Params,
): SingleShardDeltaV5Contract {
  if (!Number.isInteger(params.m) || params.m < 1 || params.m >= 2 ** 31) {
    throw new Error(`v5 mantissa must be in [1, 2^31), got ${params.m}`);
  }
  if (
    !Number.isInteger(params.e) ||
    params.e < UDELTA_V5_E_MIN ||
    params.e > UDELTA_V5_E_MAX
  ) {
    throw new Error(`v5 exponent must be in [0, 4], got ${params.e}`);
  }
  const sim = simUdeltaV5();
  const code = codeBytes();
  const codeHash = sha256(code);
  // Trailing 01s pre-joined (script pins identical mint bytes with 2 fewer CATs).
  const tokenId01 = Buffer.concat([fromHexRev(params.tokenId), Buffer.from([1])]);
  const mintAtoms01 = Buffer.concat([
    mintAtomsLe6(params.mintAtoms),
    Buffer.from([1]),
  ]);
  const econHead = Buffer.concat([
    Buffer.from(encodePush(tokenId01)),
    Buffer.from(encodePush(mintAtoms01)),
    Buffer.from(encodePush(u32Le(params.genesisUnix, 'genesisUnix'))),
    Buffer.from(encodePush(u32Le(params.daySeconds, 'daySeconds'))),
    Buffer.from(encodePush(codeHash)),
  ]);
  if (econHead.length !== UDELTA_V5_ECON_LEN) {
    throw new Error(`econHead ${econHead.length}B != ${UDELTA_V5_ECON_LEN}`);
  }
  const prefixHash = sha256(econHead);
  const eByte = Buffer.alloc(1);
  eByte[0] = params.e;
  const redeem = Buffer.concat([
    econHead,
    Buffer.from(encodePush(prefixHash)),
    Buffer.from(
      encodePush(
        Buffer.concat([
          u32Le(params.tipDay, 'tipDay'),
          u32Le(params.m, 'm'),
          eByte,
        ]),
      ),
    ),
    code,
  ]);
  if (redeem.length > 520) {
    throw new Error(`redeem ${redeem.length}B exceeds 520 (push limit)`);
  }
  // Layout self-check: head/skip/state offsets the code hard-codes.
  if (redeem[UDELTA_V5_ECON_LEN] !== 0x20) {
    throw new Error('prefixHash push tag moved (code assumes 0x20@85)');
  }
  if (redeem[UDELTA_V5_HEAD_LEN - 10] !== 0x09) {
    throw new Error('state push tag moved (code assumes 0x09@118)');
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
    redeemHex: Buffer.from(redeemScript.bytecode).toString('hex'),
    ops: sim.ops,
    maxMain: sim.maxMain,
    maxAlt: sim.maxAlt,
  };
}
