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
import { PRAYER_MINT_ATOMS } from '../params/consensus.js';
import {
  TEST_MOORE_SECONDS_PER_EXTRA_BIT,
  TEST_PRAYER_TIP_BASE_ZERO_BITS,
  type PrayerTipParams,
} from './wlpt.js';

export interface PowRemintPrayerTipParams extends PrayerTipParams {
  tokenId: string;
  mintAtoms: bigint;
}

export type PowPrayerTipInstance = Instance & { challenges: Challenges };

export interface PowRemintPrayerTipContract {
  params: PowRemintPrayerTipParams;
  instance: PowPrayerTipInstance;
  redeem: EcashScript;
  redeemScriptBuf: Buffer;
  scriptHash: Uint8Array;
  p2shScript: EcashScript;
  address: string;
  redeemHex: string;
}

let cachedPortable: PortableModule | undefined;

async function loadPortable(): Promise<PortableModule> {
  if (cachedPortable) return cachedPortable;
  const spedn = new Spedn();
  try {
    const code = readFileSync(
      resolve(process.cwd(), 'contracts/WlotusPowRemintPrayerTip.spedn'),
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

/** Moore-bit Prayer tip P2SH (D from calendar locktime; tip anti-rewind). */
export async function createPowRemintPrayerTipContract(
  params: PowRemintPrayerTipParams,
): Promise<PowRemintPrayerTipContract> {
  const portable = await loadPortable();
  const factory = new ModuleFactory(new BchJsRts('mainnet'));
  const Ctor = factory.make(portable).WlotusPowRemintPrayerTip;
  const instance = new Ctor({
    tokenIdRev: Buffer.from(fromHexRev(params.tokenId)),
    mintAtomsLe: mintAtomsLe6(params.mintAtoms),
    genesisUnix: params.genesisUnix,
    baseZeroBits: params.baseZeroBits,
    secondsPerExtraBit: params.secondsPerExtraBit,
    tipLocktime: params.tipLocktime,
  }) as PowPrayerTipInstance;
  const redeemScriptBuf = instance.redeemScript as Buffer;
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
  };
}

export function defaultPrayerTipParams(
  tokenId: string,
  genesisUnix: number,
  tipLocktime?: number,
): PowRemintPrayerTipParams {
  return {
    tokenId,
    mintAtoms: PRAYER_MINT_ATOMS,
    genesisUnix,
    baseZeroBits: TEST_PRAYER_TIP_BASE_ZERO_BITS,
    secondsPerExtraBit: TEST_MOORE_SECONDS_PER_EXTRA_BIT,
    tipLocktime: tipLocktime ?? genesisUnix,
  };
}

export {
  TEST_MOORE_SECONDS_PER_EXTRA_BIT,
  TEST_PRAYER_TIP_BASE_ZERO_BITS,
};
