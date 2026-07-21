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
import { WLOTUS_MINT_ATOMS } from '../params/wlotusMint.js';
import {
  PROD_SECONDS_PER_EXTRA_BIT,
  type MooreTipParams,
} from './mooreTip.js';

export interface PowRemintMooreTipTempleParams extends MooreTipParams {
  tokenId: string;
  /** 20-byte script hash — IFP-style P2SH temple sink (multisig / cold). */
  templeScriptHash: Uint8Array;
  /** Always 108 for this covenant (1+107 mala). */
  mintAtoms: bigint;
}

export type PowMooreTipTempleInstance = Instance & { challenges: Challenges };

export interface PowRemintMooreTipTempleContract {
  params: PowRemintMooreTipTempleParams;
  instance: PowMooreTipTempleInstance;
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

/** econHead through codeHash; tip opcode/value offsets verified at create. */
export const MOORE_TIP_TEMPLE_ECON_HEAD_LEN = 99;
export const MOORE_TIP_TEMPLE_VALUE_OFFSET = 133;

let cachedPortable: PortableModule | undefined;

async function loadPortable(): Promise<PortableModule> {
  if (cachedPortable) return cachedPortable;
  const spedn = new Spedn();
  try {
    const code = readFileSync(
      resolve(process.cwd(), 'contracts/WlotusPowRemintMooreTipTemple.spedn'),
      'utf8',
    );
    cachedPortable = await spedn.compileCode('xec', code);
    return cachedPortable;
  } finally {
    spedn.dispose();
  }
}

function u32LeBuf(n: number): Buffer {
  if (!Number.isInteger(n) || n < 0 || n >= 0x80000000) {
    throw new Error(`u32 Script-safe out of range: ${n}`);
  }
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(n >>> 0, 0);
  return buf;
}

export function buildTempleEconHead(
  params: PowRemintMooreTipTempleParams,
  codeHash: Buffer | Uint8Array,
): Buffer {
  if (params.templeScriptHash.length !== 20) {
    throw new Error(
      `templeScriptHash must be 20 bytes, got ${params.templeScriptHash.length}`,
    );
  }
  return Buffer.concat([
    Buffer.from([0x20]),
    Buffer.from(fromHexRev(params.tokenId)),
    Buffer.from([0x14]),
    Buffer.from(params.templeScriptHash),
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
  params: PowRemintMooreTipTempleParams,
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
  if (params.mintAtoms !== WLOTUS_MINT_ATOMS) {
    throw new Error(
      `WLotus temple covenant requires mintAtoms=${WLOTUS_MINT_ATOMS}, got ${params.mintAtoms}`,
    );
  }
  if (params.templeScriptHash.length !== 20) {
    throw new Error(`templeScriptHash must be 20 bytes`);
  }
  return {
    tokenIdRev: Buffer.from(fromHexRev(params.tokenId)),
    templeScriptHash: Buffer.from(params.templeScriptHash),
    genesisUnixLe: u32LeBuf(params.genesisUnix),
    baseZeroBitsBin: Buffer.from([params.baseZeroBits & 0xff]),
    secondsPerExtraBitLe: u32LeBuf(params.secondsPerExtraBit),
    codeHash,
    prefixHash,
    tipLocktimeLe: u32LeBuf(params.tipLocktime),
  };
}

export function findTempleTipValueOffset(
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
  if (off !== MOORE_TIP_TEMPLE_VALUE_OFFSET) {
    throw new Error(
      `tipValueOffset ${off} != ${MOORE_TIP_TEMPLE_VALUE_OFFSET}`,
    );
  }
  return off;
}

function instantiate(
  portable: PortableModule,
  params: PowRemintMooreTipTempleParams,
  codeHash: Buffer,
  prefixHash: Buffer,
): PowMooreTipTempleInstance {
  const factory = new ModuleFactory(new BchJsRts('mainnet'));
  const Ctor = factory.make(portable).WlotusPowRemintMooreTipTemple;
  return new Ctor(
    ctorArgs(params, codeHash, prefixHash),
  ) as PowMooreTipTempleInstance;
}

export async function createPowRemintMooreTipTempleContract(
  params: PowRemintMooreTipTempleParams,
): Promise<PowRemintMooreTipTempleContract> {
  const portable = await loadPortable();
  const z = Buffer.alloc(32, 0);

  const probe = instantiate(portable, params, z, z);
  const tipOff = findTempleTipValueOffset(
    probe.redeemScript as Buffer,
    params.tipLocktime,
    z,
    z,
  );
  const codeBytes = Buffer.from(
    (probe.redeemScript as Buffer).subarray(tipOff + 4),
  );
  const codeHash = Buffer.from(sha256(codeBytes));
  const prefixHash = Buffer.from(sha256(buildTempleEconHead(params, codeHash)));

  const instance = instantiate(portable, params, codeHash, prefixHash);
  const redeemScriptBuf = instance.redeemScript as Buffer;
  if (redeemScriptBuf.length > 520) {
    throw new Error(`Redeem ${redeemScriptBuf.length} exceeds 520-byte P2SH`);
  }
  const tipValueOffset = findTempleTipValueOffset(
    redeemScriptBuf,
    params.tipLocktime,
    codeHash,
    prefixHash,
  );
  const finalCode = Buffer.from(redeemScriptBuf.subarray(tipValueOffset + 4));
  if (!finalCode.equals(codeBytes)) {
    throw new Error('codeBytes changed after hash commit');
  }
  if (
    !Buffer.from(
      sha256(redeemScriptBuf.subarray(0, MOORE_TIP_TEMPLE_ECON_HEAD_LEN)),
    ).equals(prefixHash)
  ) {
    throw new Error('prefixHash mismatch');
  }

  const reconstructed = reconstructTempleNextRedeem(
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

export function reconstructTempleNextRedeem(
  params: PowRemintMooreTipTempleParams,
  codeHash: Buffer | Uint8Array,
  prefixHash: Buffer | Uint8Array,
  codeBytes: Buffer | Uint8Array,
  nextTipLocktime: number,
): Buffer {
  return Buffer.concat([
    buildTempleEconHead(params, codeHash),
    Buffer.from([0x20]),
    Buffer.from(prefixHash),
    Buffer.from([0x04]),
    u32LeBuf(nextTipLocktime),
    Buffer.from(codeBytes),
  ]);
}

export async function mooreTipTempleContractForNextTip(
  current: PowRemintMooreTipTempleContract,
  nextTipLocktime: number,
): Promise<PowRemintMooreTipTempleContract> {
  return createPowRemintMooreTipTempleContract({
    ...current.params,
    tipLocktime: nextTipLocktime,
  });
}

export function defaultMooreTipTempleParams(
  tokenId: string,
  genesisUnix: number,
  templeScriptHash: Uint8Array,
  opts: {
    baseZeroBits: number;
    tipLocktime?: number;
    secondsPerExtraBit?: number;
  },
): PowRemintMooreTipTempleParams {
  return {
    tokenId,
    templeScriptHash,
    mintAtoms: WLOTUS_MINT_ATOMS,
    genesisUnix,
    baseZeroBits: opts.baseZeroBits,
    secondsPerExtraBit:
      opts.secondsPerExtraBit ?? PROD_SECONDS_PER_EXTRA_BIT,
    tipLocktime: opts.tipLocktime ?? genesisUnix,
  };
}
