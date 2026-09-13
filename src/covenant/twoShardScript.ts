/**
 * Two-shard (C + M) covenant assembly, mint-only v1.
 *
 * Spedn 5.0 cannot emit native introspection (0xc0–0xcd), so each full
 * redeem = hand-assembled 28B prefix + Spedn-compiled body:
 *
 *   prefix(shard s, sibling hole h):
 *     OP_INPUTINDEX <selfIdx> OP_NUMEQUALVERIFY
 *     <sibIdx> OP_UTXOBYTECODE OP_HASH160 <h:20> OP_EQUALVERIFY
 *   with h = hash160(sibling BODY at the same state) — bodies are known
 *   before prefixes, so there is no hash cycle. (Outputs pin the FULL
 *   sibling redeems, closing the loop.)
 *
 * v1 has NO successor shell verification (ergon-dogfood posture — the
 * next redeems are unverified witness, like ergon's batonHash). Heads
 * are still layout-asserted: TS reconstructs the expected head bytes
 * and requires the compiled body to start with them.
 *
 * C head (60B): 0x20 tokenIdRev | 0x06 mintAtomsLe | 0x04 genesisUnixLe
 *   | 0x04 daySecondsLe | 0x04 tipDayLe | 0x04 tipTargetLe (STATE at 50).
 * M head (40B): 0x20 tokenIdRev | 0x06 mintAtomsLe (stateless).
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
import { OP_INPUTINDEX, OP_UTXOBYTECODE } from './opcodes.js';

export type TwoShardId = 'C' | 'M';

/** OP_0/OP_1/…/OP_16 as single minimal bytes (0x00/0x51+). */
function smallNum(n: number): number {
  if (n === 0) return 0x00;
  if (n >= 1 && n <= 16) return 0x50 + n;
  throw new Error(`smallNum out of range: ${n}`);
}

const OP_NUMEQUALVERIFY = 0x9d;
const OP_HASH160 = 0xa9;
const OP_EQUALVERIFY = 0x88;

export const TWOSHARD_PREFIX_LEN = 28;
export const TWOSHARD_C_STATE_OFF = 50;
export const TWOSHARD_C_STATE_LEN = 10;
export const TWOSHARD_C_HEAD_LEN = 60;
export const TWOSHARD_M_HEAD_LEN = 40;

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
  prefix: Buffer;
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

/** Reconstruct the exact expected head bytes for a shard + params. */
export function expectedShardHead(
  id: TwoShardId,
  params: TwoShardShardParams,
): Buffer {
  const head = Buffer.concat([
    push(Buffer.from(fromHexRev(params.tokenId))),
    push(mintAtomsLe6(params.mintAtoms)),
    ...(id === 'C'
      ? [
          push(u32LeBuf(params.genesisUnix, 'genesisUnix')),
          push(u32LeBuf(params.daySeconds, 'daySeconds')),
          push(u32LeBuf(params.tipDay, 'tipDay')),
          push(u32LeBuf(params.tipTarget, 'tipTarget')),
        ]
      : []),
  ]);
  const want = id === 'C' ? TWOSHARD_C_HEAD_LEN : TWOSHARD_M_HEAD_LEN;
  if (head.length !== want) throw new Error(`head ${head.length}B != ${want}B`);
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
  const args: Record<string, Buffer> =
    id === 'C'
      ? {
          tokenIdRev: Buffer.from(fromHexRev(params.tokenId)),
          mintAtomsLe: mintAtomsLe6(params.mintAtoms),
          genesisUnixLe: u32LeBuf(params.genesisUnix, 'genesisUnix'),
          daySecondsLe: u32LeBuf(params.daySeconds, 'daySeconds'),
          tipDayLe: u32LeBuf(params.tipDay, 'tipDay'),
          tipTargetLe: u32LeBuf(params.tipTarget, 'tipTarget'),
        }
      : {
          tokenIdRev: Buffer.from(fromHexRev(params.tokenId)),
          mintAtomsLe: mintAtomsLe6(params.mintAtoms),
        };
  return new Ctor(args) as TwoShardInstance;
}

/** 28B prefix: index pin + sibling-body-hash pin. */
export function buildShardPrefix(
  id: TwoShardId,
  siblingBodyHash: Buffer,
): Buffer {
  if (siblingBodyHash.length !== 20) {
    throw new Error(
      `siblingBodyHash must be 20B, got ${siblingBodyHash.length}`,
    );
  }
  const selfIdx = id === 'C' ? 0 : 1;
  const sibIdx = id === 'C' ? 1 : 0;
  return Buffer.concat([
    Buffer.from([
      OP_INPUTINDEX,
      smallNum(selfIdx),
      OP_NUMEQUALVERIFY,
      smallNum(sibIdx),
      OP_UTXOBYTECODE,
      OP_HASH160,
      0x14,
    ]),
    siblingBodyHash,
    Buffer.from([OP_EQUALVERIFY]),
  ]);
}

function assembleShard(
  id: TwoShardId,
  params: TwoShardShardParams,
  instance: TwoShardInstance,
  siblingBody: Buffer,
): TwoShardShard {
  const body = Buffer.from(instance.redeemScript as Buffer);
  const head = expectedShardHead(id, params);
  if (!body.subarray(0, head.length).equals(head)) {
    throw new Error(
      `${id} body head mismatch (Spedn layout drift?) — ` +
        `got ${body.subarray(0, head.length).toString('hex')} want ${head.toString('hex')}`,
    );
  }
  const prefix = buildShardPrefix(
    id,
    Buffer.from(shaRmd160(new Uint8Array(siblingBody))),
  );
  if (prefix.length !== TWOSHARD_PREFIX_LEN) {
    throw new Error(`prefix ${prefix.length}B != ${TWOSHARD_PREFIX_LEN}B`);
  }
  const redeem = Buffer.concat([prefix, body]);
  const scriptHash = shaRmd160(new Uint8Array(redeem));
  const p2shScript = EcashScript.p2sh(scriptHash);
  return {
    id,
    params,
    body,
    prefix,
    redeem,
    redeemHex: toHex(new Uint8Array(redeem)),
    scriptHash,
    p2shScript,
    address: Address.p2sh(scriptHash, 'ecash').toString(),
    instance,
  };
}

/**
 * Build the full C+M pair at one state: compile both bodies (layout
 * asserted), then prefixes (sibling BODY hashes — no cycle), then full
 * redeems + P2SH addresses.
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
    const instC = instantiate(portC, 'C', params);
    const instM = instantiate(portM, 'M', params);
    const bodyC = Buffer.from(instC.redeemScript as Buffer);
    const bodyM = Buffer.from(instM.redeemScript as Buffer);
    const c = assembleShard('C', params, instC, bodyM);
    const m = assembleShard('M', params, instM, bodyC);
    return { c, m };
  } finally {
    spedn.dispose();
  }
}
