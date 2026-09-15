/**
 * Two-shard (C + M) covenant assembly, mint-only v1.
 *
 * Pure Spedn, NO hand assembly: eCash never activated native introspection
 * (0xc0–0xcd — BCH-only since May 2022), so the genesis 1–3 hand-spliced
 * sibling-pin prefix is gone. (It never executed anyway: P2SH commits to
 * the full redeem while RTS signs with the Spedn body, so every pre-v2
 * spend died at the P2SH hash check with a false top stack — and the
 * opcodes are undefined on eCash regardless.) Each shard's redeem IS its
 * Spedn body, so stock RTS builds correct scriptSigs with zero hacks.
 * Cross-shard binding is (identical output pins) + (ALP ≥1-baton rule) +
 * (M's day window / target monotonicity); see the contract headers.
 *
 * Uniform 60B head, both shards (STATE at 50):
 *   0x20 tokenIdRev | 0x06 mintAtomsLe | 0x04 genesisUnixLe
 *   | 0x04 daySecondsLe | 0x04 tipDayLe | 0x04 tipTargetLe
 * (M never derives, so it never reads genesisUnix/daySeconds — they ride
 * along for one shared head layout. TS layout-asserts every compile.)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Spedn } from '@spedn/sdk';
import {
  ModuleFactory,
  type Instance,
  type PortableModule,
  type Challenges,
} from '@spedn/rts';
import { BchJsRts } from '@spedn/rts-bchjs';
import {
  Address,
  fromHexRev,
  shaRmd160,
  toHex,
  Script as EcashScript,
} from 'ecash-lib';

export type TwoShardId = 'C' | 'M';

export const TWOSHARD_HEAD_LEN = 60;
export const TWOSHARD_STATE_OFF = 50;
export const TWOSHARD_STATE_LEN = 10;

const OP_CODESEPARATOR = 0xab;

export interface TwoShardShardParams {
  tokenId: string;
  mintAtoms: bigint;
  genesisUnix: number;
  daySeconds: number;
  genesisTarget: number;
  tipDay: number;
  tipTarget: number;
}

export type TwoShardInstance = Instance & { challenges: Challenges };

export interface TwoShardShard {
  id: TwoShardId;
  params: TwoShardShardParams;
  body: Buffer;
  /** Full P2SH redeem — always identical to body (pure Spedn, no splice). */
  redeem: Buffer;
  redeemHex: string;
  scriptHash: Uint8Array;
  p2shScript: EcashScript;
  address: string;
  /** Live challenge entry (scriptSig builder for the miner). */
  instance: TwoShardInstance;
}

export interface TwoShardPair {
  c: TwoShardShard;
  m: TwoShardShard;
}

const portableCache = new Map<TwoShardId, PortableModule>();

async function loadPortable(
  spedn: Spedn,
  id: TwoShardId,
): Promise<PortableModule> {
  const hit = portableCache.get(id);
  if (hit) return hit;
  const file =
    id === 'C' ? 'GlotusComputeShard.spedn' : 'GlotusMintShard.spedn';
  const code = readFileSync(resolve(process.cwd(), `contracts/${file}`), 'utf8');
  const portable = await spedn.compileCode('xec', code);
  portableCache.set(id, portable);
  return portable;
}

function u32LeBuf(n: number, what: string): Buffer {
  if (!Number.isInteger(n) || n < 0 || n >= 0x80000000) {
    throw new Error(`${what} out of Script-safe u32 range: ${n}`);
  }
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(n >>> 0, 0);
  return buf;
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

function push(b: Buffer): Buffer {
  if (b.length > 75) throw new Error('push too long for single opcode');
  return Buffer.concat([Buffer.from([b.length]), b]);
}

/** Reconstruct the exact expected 60B head bytes for params (both shards). */
export function expectedShardHead(params: TwoShardShardParams): Buffer {
  const head = Buffer.concat([
    push(Buffer.from(fromHexRev(params.tokenId))),
    push(mintAtomsLe6(params.mintAtoms)),
    push(u32LeBuf(params.genesisUnix, 'genesisUnix')),
    push(u32LeBuf(params.daySeconds, 'daySeconds')),
    push(u32LeBuf(params.tipDay, 'tipDay')),
    push(u32LeBuf(params.tipTarget, 'tipTarget')),
  ]);
  if (head.length !== TWOSHARD_HEAD_LEN) {
    throw new Error(`head ${head.length}B != ${TWOSHARD_HEAD_LEN}B`);
  }
  return head;
}

function instantiate(
  portable: PortableModule,
  id: TwoShardId,
  params: TwoShardShardParams,
): TwoShardInstance {
  const factory = new ModuleFactory(new BchJsRts('mainnet'));
  const name = id === 'C' ? 'GlotusComputeShard' : 'GlotusMintShard';
  const Ctor = factory.make(portable)[name];
  const args: Record<string, Buffer> = {
    tokenIdRev: Buffer.from(fromHexRev(params.tokenId)),
    mintAtomsLe: mintAtomsLe6(params.mintAtoms),
    genesisUnixLe: u32LeBuf(params.genesisUnix, 'genesisUnix'),
    daySecondsLe: u32LeBuf(params.daySeconds, 'daySeconds'),
    tipDayLe: u32LeBuf(params.tipDay, 'tipDay'),
    tipTargetLe: u32LeBuf(params.tipTarget, 'tipTarget'),
  };
  return new Ctor(args) as TwoShardInstance;
}

/**
 * Push-aware redeem shape check: exactly one executed CODESEPARATOR (the
 * miner cuts scriptCode at raw index 0 — ecash-lib's cut is push-aware,
 * but a second separator, or none, would still desync the sighash), and
 * no 0xc0–0xcd executed anywhere (undefined on eCash — fail fast if a
 * future Spedn ever emits introspection).
 */
function assertRedeemShape(id: TwoShardId, redeem: Buffer): void {
  let seps = 0;
  let i = 0;
  while (i < redeem.length) {
    const op = redeem[i]!;
    if (op >= 1 && op <= 75) {
      i += 1 + op;
      continue;
    }
    if (op === 0x4c) {
      i += 2 + redeem[i + 1]!;
      continue;
    }
    if (op === 0x4d) {
      i += 3 + (redeem[i + 1]! | (redeem[i + 2]! << 8));
      continue;
    }
    if (op === OP_CODESEPARATOR) seps++;
    if (op >= 0xc0 && op <= 0xcd) {
      throw new Error(
        `${id} redeem executes 0x${op.toString(16)} (introspection is BCH-only — eCash would reject)`,
      );
    }
    i += 1;
  }
  if (seps !== 1) {
    throw new Error(
      `${id} redeem has ${seps} executed CODESEPARATORs, need exactly 1`,
    );
  }
}

function assembleShard(
  id: TwoShardId,
  params: TwoShardShardParams,
  instance: TwoShardInstance,
): TwoShardShard {
  const body = Buffer.from(instance.redeemScript as Buffer);
  const head = expectedShardHead(params);
  if (!body.subarray(0, head.length).equals(head)) {
    throw new Error(
      `${id} body head mismatch (Spedn layout drift?) — ` +
        `got ${body.subarray(0, head.length).toString('hex')} want ${head.toString('hex')}`,
    );
  }
  // Pure Spedn: redeem IS the body (no splice). Push-aware shape gate.
  const redeem = body;
  assertRedeemShape(id, redeem);
  if (redeem.length > 520) {
    throw new Error(`${id} redeem ${redeem.length}B exceeds 520B push limit`);
  }
  const scriptHash = shaRmd160(new Uint8Array(redeem));
  const p2shScript = EcashScript.p2sh(scriptHash);
  return {
    id,
    params,
    body,
    redeem,
    redeemHex: toHex(new Uint8Array(redeem)),
    scriptHash,
    p2shScript,
    address: Address.p2sh(scriptHash, 'ecash').toString(),
    instance,
  };
}

/**
 * Build the C+M pair at one state: compile both bodies (layout asserted).
 * No cross-pins (eCash has no introspection) — binding is co-pinned
 * outputs + ALP batons + M's window/cap; see the contract headers.
 */
export async function createTwoShardPair(
  params: TwoShardShardParams,
): Promise<TwoShardPair> {
  const spedn = new Spedn();
  try {
    const [portC, portM] = await Promise.all([
      loadPortable(spedn, 'C'),
      loadPortable(spedn, 'M'),
    ]);
    const c = assembleShard('C', params, instantiate(portC, 'C', params));
    const m = assembleShard('M', params, instantiate(portM, 'M', params));
    return { c, m };
  } finally {
    spedn.dispose();
  }
}
