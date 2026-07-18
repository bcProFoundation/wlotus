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
import {
  PROD_SECONDS_PER_EXTRA_BIT,
  type MooreTipParams,
} from './mooreTip.js';

export interface PowRemintMooreTipParams extends MooreTipParams {
  tokenId: string;
  mintAtoms: bigint;
}

export type PowMooreTipInstance = Instance & { challenges: Challenges };

export interface PowRemintMooreTipContract {
  params: PowRemintMooreTipParams;
  instance: PowMooreTipInstance;
  redeem: EcashScript;
  redeemScriptBuf: Buffer;
  scriptHash: Uint8Array;
  p2shScript: EcashScript;
  address: string;
  redeemHex: string;
  codeBytes: Buffer;
  codeHash: Uint8Array;
  prefixHash: Uint8Array;
  tipValueOffset: number;
}

/** econHead through codeHash; tip opcode at 85+33=118, tip value at 119. */
export const MOORE_TIP_ECON_HEAD_LEN = 85;
export const MOORE_TIP_VALUE_OFFSET = 119;

let cachedPortable: PortableModule | undefined;

async function loadPortable(): Promise<PortableModule> {
  if (cachedPortable) return cachedPortable;
  const spedn = new Spedn();
  try {
    const code = readFileSync(
      resolve(process.cwd(), 'contracts/WlotusPowRemintMooreTip.spedn'),
      'utf8',
    );
    cachedPortable = await spedn.compileCode('xec', code);
    return cachedPortable;
  } finally {
    spedn.dispose();
  }
}

function mintAtomsLe6(atoms: bigint): Buffer {
  const buf = Buffer.alloc(6);
  buf.writeUInt32LE(Number(atoms & 0xffffffffn), 0);
  buf.writeUInt16LE(Number(atoms >> 32n), 4);
  return buf;
}

function u32LeBuf(n: number): Buffer {
  if (!Number.isInteger(n) || n < 0 || n >= 0x80000000) {
    throw new Error(`u32 Script-safe out of range: ${n}`);
  }
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(n >>> 0, 0);
  return buf;
}

export function buildEconHead(
  params: PowRemintMooreTipParams,
  codeHash: Buffer | Uint8Array,
): Buffer {
  return Buffer.concat([
    Buffer.from([0x20]),
    Buffer.from(fromHexRev(params.tokenId)),
    Buffer.from([0x06]),
    mintAtomsLe6(params.mintAtoms),
    Buffer.from([0x04]),
    u32LeBuf(params.genesisUnix),
    Buffer.from([0x01]),
    Buffer.from([params.baseZeroBits & 0xff]),
    Buffer.from([0x04]),
    u32LeBuf(params.secondsPerExtraBit),
    Buffer.from([0x20]),
    Buffer.from(codeHash),
  ]);
}

function ctorArgs(
  params: PowRemintMooreTipParams,
  codeHash: Buffer,
  prefixHash: Buffer,
): Record<string, Buffer> {
  if (
    !Number.isInteger(params.baseZeroBits) ||
    params.baseZeroBits < 0 ||
    params.baseZeroBits > 255
  ) {
    throw new Error(`baseZeroBits out of u8 range: ${params.baseZeroBits}`);
  }
  if (params.baseZeroBits % 8 !== 0) {
    throw new Error(
      `baseZeroBits ${params.baseZeroBits} must be a multiple of 8 (whole-byte PoW)`,
    );
  }
  return {
    tokenIdRev: Buffer.from(fromHexRev(params.tokenId)),
    mintAtomsLe: mintAtomsLe6(params.mintAtoms),
    genesisUnixLe: u32LeBuf(params.genesisUnix),
    baseZeroBitsBin: Buffer.from([params.baseZeroBits & 0xff]),
    secondsPerExtraBitLe: u32LeBuf(params.secondsPerExtraBit),
    codeHash,
    prefixHash,
    tipLocktimeLe: u32LeBuf(params.tipLocktime),
  };
}

export function findTipValueOffset(
  redeem: Buffer,
  tipLocktime: number,
  codeHash: Buffer,
  prefixHash: Buffer,
): number {
  const tipLe = u32LeBuf(tipLocktime);
  const marker = Buffer.concat([
    Buffer.from([0x20]),
    codeHash,
    Buffer.from([0x20]),
    prefixHash,
    Buffer.from([0x04]),
    tipLe,
  ]);
  const at = redeem.indexOf(marker);
  if (at < 0) throw new Error('tip marker not found');
  const off = at + 1 + 32 + 1 + 32 + 1;
  if (off !== MOORE_TIP_VALUE_OFFSET) {
    throw new Error(`tipValueOffset ${off} != ${MOORE_TIP_VALUE_OFFSET}`);
  }
  return off;
}

function instantiate(
  portable: PortableModule,
  params: PowRemintMooreTipParams,
  codeHash: Buffer,
  prefixHash: Buffer,
): PowMooreTipInstance {
  const factory = new ModuleFactory(new BchJsRts('mainnet'));
  const Ctor = factory.make(portable).WlotusPowRemintMooreTip;
  return new Ctor(
    ctorArgs(params, codeHash, prefixHash),
  ) as PowMooreTipInstance;
}

export async function createPowRemintMooreTipContract(
  params: PowRemintMooreTipParams,
): Promise<PowRemintMooreTipContract> {
  const portable = await loadPortable();
  const z = Buffer.alloc(32, 0);

  const probe = instantiate(portable, params, z, z);
  const tipOff = findTipValueOffset(
    probe.redeemScript as Buffer,
    params.tipLocktime,
    z,
    z,
  );
  const codeBytes = Buffer.from(
    (probe.redeemScript as Buffer).subarray(tipOff + 4),
  );
  const codeHash = Buffer.from(sha256(codeBytes));
  const prefixHash = Buffer.from(sha256(buildEconHead(params, codeHash)));

  const instance = instantiate(portable, params, codeHash, prefixHash);
  const redeemScriptBuf = instance.redeemScript as Buffer;
  const tipValueOffset = findTipValueOffset(
    redeemScriptBuf,
    params.tipLocktime,
    codeHash,
    prefixHash,
  );
  const finalCode = Buffer.from(redeemScriptBuf.subarray(tipValueOffset + 4));
  if (!finalCode.equals(codeBytes)) {
    throw new Error('codeBytes changed after hash commit');
  }
  if (!Buffer.from(sha256(finalCode)).equals(codeHash)) {
    throw new Error('codeHash mismatch');
  }
  if (
    !Buffer.from(
      sha256(redeemScriptBuf.subarray(0, MOORE_TIP_ECON_HEAD_LEN)),
    ).equals(prefixHash)
  ) {
    throw new Error('prefixHash mismatch');
  }

  const reconstructed = reconstructNextRedeem(
    params,
    codeHash,
    prefixHash,
    finalCode,
    params.tipLocktime,
  );
  if (!reconstructed.equals(redeemScriptBuf)) {
    throw new Error(
      `reconstruct mismatch: got ${reconstructed.length}B want ${redeemScriptBuf.length}B`,
    );
  }

  const redeem = new EcashScript(new Uint8Array(redeemScriptBuf));
  const scriptHash = shaRmd160(redeem.bytecode);
  const p2shScript = EcashScript.p2sh(scriptHash);
  const address = Address.p2sh(scriptHash, 'ecash').toString();

  return {
    params,
    instance,
    redeem,
    redeemScriptBuf,
    scriptHash,
    p2shScript,
    address,
    redeemHex: toHex(redeem.bytecode),
    codeBytes: finalCode,
    codeHash,
    prefixHash,
    tipValueOffset,
  };
}

export function reconstructNextRedeem(
  params: PowRemintMooreTipParams,
  codeHash: Buffer | Uint8Array,
  prefixHash: Buffer | Uint8Array,
  codeBytes: Buffer | Uint8Array,
  nextTipLocktime: number,
): Buffer {
  return Buffer.concat([
    buildEconHead(params, codeHash),
    Buffer.from([0x20]),
    Buffer.from(prefixHash),
    Buffer.from([0x04]),
    u32LeBuf(nextTipLocktime),
    Buffer.from(codeBytes),
  ]);
}

export async function mooreTipContractForNextTip(
  current: PowRemintMooreTipContract,
  nextTipLocktime: number,
): Promise<PowRemintMooreTipContract> {
  return createPowRemintMooreTipContract({
    ...current.params,
    tipLocktime: nextTipLocktime,
  });
}

export function defaultMooreTipParams(
  tokenId: string,
  genesisUnix: number,
  opts: {
    mintAtoms: bigint;
    baseZeroBits: number;
    tipLocktime?: number;
    secondsPerExtraBit?: number;
  },
): PowRemintMooreTipParams {
  return {
    tokenId,
    mintAtoms: opts.mintAtoms,
    genesisUnix,
    baseZeroBits: opts.baseZeroBits,
    secondsPerExtraBit:
      opts.secondsPerExtraBit ?? PROD_SECONDS_PER_EXTRA_BIT,
    tipLocktime: opts.tipLocktime ?? genesisUnix,
  };
}
