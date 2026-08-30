/**
 * GLotus MooreTip factory — same econHead layout as WlotusPowRemintMooreTip,
 * felt +1 bit (no whole-byte guard), ALP MINT only.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Spedn } from '@spedn/sdk';
import { ModuleFactory, type PortableModule } from '@spedn/rts';
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
  buildEconHead,
  findTipValueOffset,
  reconstructNextRedeem,
  MOORE_TIP_ECON_HEAD_LEN,
  type PowRemintMooreTipContract,
  type PowRemintMooreTipParams,
  type PowMooreTipInstance,
} from './powRemintMooreTipScript.js';

export type PowRemintGlotusTipContract = PowRemintMooreTipContract;

let cachedPortable: PortableModule | undefined;

async function loadPortable(): Promise<PortableModule> {
  if (cachedPortable) return cachedPortable;
  const spedn = new Spedn();
  try {
    const code = readFileSync(
      resolve(process.cwd(), 'contracts/GlotusPowRemintMooreTip.spedn'),
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
  prefixHash: Buffer,
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
    prefixHash,
    tipLocktimeLe: u32LeBuf(params.tipLocktime),
  };
}

function instantiate(
  portable: PortableModule,
  params: PowRemintMooreTipParams,
  codeHash: Buffer,
  prefixHash: Buffer,
): PowMooreTipInstance {
  const factory = new ModuleFactory(new BchJsRts('mainnet'));
  const Ctor = factory.make(portable).GlotusPowRemintMooreTip;
  return new Ctor(
    ctorArgs(params, codeHash, prefixHash),
  ) as PowMooreTipInstance;
}

export async function createPowRemintGlotusTipContract(
  params: PowRemintMooreTipParams,
): Promise<PowRemintGlotusTipContract> {
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

export { reconstructNextRedeem };
