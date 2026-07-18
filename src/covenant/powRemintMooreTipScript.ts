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
  /** Immutable body after tipLocktime push (passed in unlock). */
  codeBytes: Buffer;
  codeHash: Uint8Array;
  /** Byte offset of the 4-byte tipLocktime value in redeem. */
  tipValueOffset: number;
}

/** tip value starts at byte 86 (7 fixed-width ctor pushes). */
export const MOORE_TIP_VALUE_OFFSET = 86;

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

function ctorArgs(
  params: PowRemintMooreTipParams,
  codeHash: Buffer,
): Record<string, Buffer> {
  if (
    !Number.isInteger(params.baseZeroBits) ||
    params.baseZeroBits < 0 ||
    params.baseZeroBits > 255
  ) {
    throw new Error(`baseZeroBits out of u8 range: ${params.baseZeroBits}`);
  }
  return {
    tokenIdRev: Buffer.from(fromHexRev(params.tokenId)),
    mintAtomsLe: mintAtomsLe6(params.mintAtoms),
    genesisUnixLe: u32LeBuf(params.genesisUnix),
    baseZeroBitsBin: Buffer.from([params.baseZeroBits & 0xff]),
    secondsPerExtraBitLe: u32LeBuf(params.secondsPerExtraBit),
    codeHash,
    tipLocktimeLe: u32LeBuf(params.tipLocktime),
  };
}

/**
 * Locate tipLocktime value bytes (4 LE) after PUSH4 opcode in redeem.
 * Layout: … 0x20 codeHash | 0x04 tipLocktimeLe | codeBytes
 */
export function findTipValueOffset(
  redeem: Buffer,
  tipLocktime: number,
  codeHash: Buffer,
): number {
  const tipLe = u32LeBuf(tipLocktime);
  const codeHashPush = Buffer.concat([Buffer.from([0x20]), codeHash]);
  const afterHash = redeem.indexOf(codeHashPush);
  if (afterHash >= 0) {
    const tipAt = afterHash + codeHashPush.length;
    if (
      redeem[tipAt] === 0x04 &&
      redeem.subarray(tipAt + 1, tipAt + 5).equals(tipLe)
    ) {
      const off = tipAt + 1;
      if (off !== MOORE_TIP_VALUE_OFFSET) {
        throw new Error(
          `tipValueOffset ${off} != fixed ${MOORE_TIP_VALUE_OFFSET}`,
        );
      }
      return off;
    }
  }
  for (let i = 0; i + 5 <= redeem.length; i++) {
    if (redeem[i] === 0x04 && redeem.subarray(i + 1, i + 5).equals(tipLe)) {
      return i + 1;
    }
  }
  throw new Error('tipLocktimeLe not found in redeem script');
}

function instantiate(
  portable: PortableModule,
  params: PowRemintMooreTipParams,
  codeHash: Buffer,
): PowMooreTipInstance {
  const factory = new ModuleFactory(new BchJsRts('mainnet'));
  const Ctor = factory.make(portable).WlotusPowRemintMooreTip;
  return new Ctor(ctorArgs(params, codeHash)) as PowMooreTipInstance;
}

/**
 * Two-phase factory: placeholder codeHash → measure body → real codeHash.
 */
export async function createPowRemintMooreTipContract(
  params: PowRemintMooreTipParams,
): Promise<PowRemintMooreTipContract> {
  const portable = await loadPortable();
  const placeholderHash = Buffer.alloc(32, 0);

  const probe = instantiate(portable, params, placeholderHash);
  const probeRedeem = probe.redeemScript as Buffer;
  const tipOff = findTipValueOffset(
    probeRedeem,
    params.tipLocktime,
    placeholderHash,
  );
  const codeBytes = Buffer.from(probeRedeem.subarray(tipOff + 4));
  const codeHash = Buffer.from(sha256(codeBytes));

  const instance = instantiate(portable, params, codeHash);
  const redeemScriptBuf = instance.redeemScript as Buffer;
  const tipValueOffset = findTipValueOffset(
    redeemScriptBuf,
    params.tipLocktime,
    codeHash,
  );
  const finalCode = Buffer.from(redeemScriptBuf.subarray(tipValueOffset + 4));
  if (!finalCode.equals(codeBytes)) {
    throw new Error(
      'codeBytes changed after codeHash commit — layout unstable',
    );
  }
  if (!Buffer.from(sha256(finalCode)).equals(codeHash)) {
    throw new Error('codeHash mismatch');
  }

  const reconstructed = reconstructNextRedeem(
    params,
    codeHash,
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
    tipValueOffset,
  };
}

/** Build next redeem (tip' = locktime) matching covenant CAT. */
export function reconstructNextRedeem(
  params: PowRemintMooreTipParams,
  codeHash: Buffer | Uint8Array,
  codeBytes: Buffer | Uint8Array,
  nextTipLocktime: number,
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
