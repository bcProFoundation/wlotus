/**
 * Two-shard (C + M) covenant assembly.
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
 * Body layout (98B head + code), all offsets asserted at load:
 *   [0:33]   0x20 tokenIdRev
 *   [33:40]  0x06 mintAtomsLe
 *   [40:45]  0x04 genesisUnixLe
 *   [45:50]  0x04 daySecondsLe
 *   [50:55]  0x04 genesisTargetLe
 *   [55:65]  0x04 tipDayLe | 0x04 tipTargetLe   (STATE hole)
 *   [65:98]  0x20 bodyShellHash
 *   [98:]    code
 * bodyShell = sha256(body[0:55] . body[98:]).
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
  sha256,
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
export const TWOSHARD_BODY_STATE_OFF = 55;
export const TWOSHARD_BODY_STATE_LEN = 10;
export const TWOSHARD_BODY_HEAD_LEN = 98;

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
  bodyShellHash: Buffer;
  prefix: Buffer;
  redeem: Buffer;
  redeemHex: string;
  scriptHash: Uint8Array;
  p2shScript: EcashScript;
  address: string;
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

function ctorArgs(
  params: TwoShardShardParams,
  bodyShellHash: Buffer,
): Record<string, Buffer> {
  return {
    tokenIdRev: Buffer.from(fromHexRev(params.tokenId)),
    mintAtomsLe: mintAtomsLe6(params.mintAtoms),
    genesisUnixLe: u32LeBuf(params.genesisUnix, 'genesisUnix'),
    daySecondsLe: u32LeBuf(params.daySeconds, 'daySeconds'),
    genesisTargetLe: u32LeBuf(params.genesisTarget, 'genesisTarget'),
    tipDayLe: u32LeBuf(params.tipDay, 'tipDay'),
    tipTargetLe: u32LeBuf(params.tipTarget, 'tipTarget'),
    bodyShellHash,
  };
}

function instantiate(
  portable: PortableModule,
  id: TwoShardId,
  params: TwoShardShardParams,
  bodyShellHash: Buffer,
): TwoShardInstance {
  const factory = new ModuleFactory(new BchJsRts('mainnet'));
  const name = id === 'C' ? 'GlotusComputeShard' : 'GlotusMintShard';
  const Ctor = factory.make(portable)[name];
  return new Ctor(ctorArgs(params, bodyShellHash)) as TwoShardInstance;
}

/** Locate the 0x20||hash anchor; state starts 10B earlier. */
function findBodyStateOff(body: Buffer, hash: Buffer): number {
  const marker = Buffer.concat([Buffer.from([0x20]), hash]);
  const at = body.indexOf(marker);
  if (at < 0) throw new Error('body shell-hash anchor not found');
  const off = at - TWOSHARD_BODY_STATE_LEN;
  if (off !== TWOSHARD_BODY_STATE_OFF) {
    throw new Error(
      `body state offset ${off} != ${TWOSHARD_BODY_STATE_OFF} (Spedn layout drift?)`,
    );
  }
  return off;
}

function compileBody(
  portable: PortableModule,
  id: TwoShardId,
  params: TwoShardShardParams,
): { body: Buffer; bodyShellHash: Buffer } {
  const z = Buffer.alloc(32, 0);
  const probe = Buffer.from(
    instantiate(portable, id, params, z).redeemScript as Buffer,
  );
  findBodyStateOff(probe, z);
  if (probe[TWOSHARD_BODY_STATE_OFF + TWOSHARD_BODY_STATE_LEN] !== 0x20) {
    throw new Error('shell push is not 0x20-prefixed (layout drift?)');
  }
  const stablePre = probe.subarray(0, TWOSHARD_BODY_STATE_OFF);
  const stableCode = probe.subarray(TWOSHARD_BODY_HEAD_LEN);
  const bodyShellHash = Buffer.from(
    sha256(Buffer.concat([stablePre, stableCode])),
  );

  const body = Buffer.from(
    instantiate(portable, id, params, bodyShellHash)
      .redeemScript as Buffer,
  );
  findBodyStateOff(body, bodyShellHash);
  if (
    !Buffer.from(body.subarray(0, TWOSHARD_BODY_STATE_OFF)).equals(stablePre) ||
    !Buffer.from(body.subarray(TWOSHARD_BODY_HEAD_LEN)).equals(stableCode)
  ) {
    throw new Error('body layout changed after shell commit');
  }
  const check = Buffer.from(
    sha256(
      Buffer.concat([
        body.subarray(0, TWOSHARD_BODY_STATE_OFF),
        body.subarray(TWOSHARD_BODY_HEAD_LEN),
      ]),
    ),
  );
  if (!check.equals(bodyShellHash)) {
    throw new Error('bodyShellHash mismatch');
  }
  return { body, bodyShellHash };
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
  body: Buffer,
  bodyShellHash: Buffer,
  siblingBody: Buffer,
): TwoShardShard {
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
    bodyShellHash,
    prefix,
    redeem,
    redeemHex: toHex(new Uint8Array(redeem)),
    scriptHash,
    p2shScript,
    address: Address.p2sh(scriptHash, 'ecash').toString(),
  };
}

/**
 * Build the full C+M pair at one state. Bodies are compiled (two-phase
 * shell commit), then prefixes (sibling BODY hashes — no cycle), then
 * full redeems + P2SH addresses.
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
    const cBody = compileBody(portC, 'C', params);
    const mBody = compileBody(portM, 'M', params);
    const c = assembleShard(
      'C',
      params,
      cBody.body,
      cBody.bodyShellHash,
      mBody.body,
    );
    const m = assembleShard(
      'M',
      params,
      mBody.body,
      mBody.bodyShellHash,
      cBody.body,
    );
    return { c, m };
  } finally {
    spedn.dispose();
  }
}
