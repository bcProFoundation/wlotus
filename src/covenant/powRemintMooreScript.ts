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
import { BASE_MINT_ATOMS, POW_BASE_ZERO_BITS } from '../params/consensus.js';
import { TEST_MOORE_SECONDS_PER_EXTRA_BIT } from './wldf.js';

export interface PowRemintMooreParams {
  tokenId: string;
  mintAtoms: bigint;
  genesisUnix: number;
  baseZeroBits: number;
  secondsPerExtraBit: number;
}

export type PowMooreInstance = Instance & { challenges: Challenges };

export interface PowRemintMooreContract {
  params: PowRemintMooreParams;
  instance: PowMooreInstance;
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
      resolve(process.cwd(), 'contracts/WlotusPowRemintMoore.spedn'),
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

/** Build the Moore-bit PoW remint P2SH (D from nLockTime, not redeem mutation). */
export async function createPowRemintMooreContract(
  params: PowRemintMooreParams,
): Promise<PowRemintMooreContract> {
  const portable = await loadPortable();
  const factory = new ModuleFactory(new BchJsRts('mainnet'));
  const Ctor = factory.make(portable).WlotusPowRemintMoore;
  const instance = new Ctor({
    tokenIdRev: Buffer.from(fromHexRev(params.tokenId)),
    mintAtomsLe: mintAtomsLe6(params.mintAtoms),
    genesisUnix: params.genesisUnix,
    baseZeroBits: params.baseZeroBits,
    secondsPerExtraBit: params.secondsPerExtraBit,
  }) as PowMooreInstance;
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

export function defaultMooreParams(
  tokenId: string,
  genesisUnix: number,
): PowRemintMooreParams {
  return {
    tokenId,
    mintAtoms: BASE_MINT_ATOMS,
    genesisUnix,
    baseZeroBits: POW_BASE_ZERO_BITS,
    secondsPerExtraBit: TEST_MOORE_SECONDS_PER_EXTRA_BIT,
  };
}

export async function mooreContractForToken(
  tokenId: string,
  genesisUnix: number,
  opts?: Partial<
    Pick<PowRemintMooreParams, 'baseZeroBits' | 'secondsPerExtraBit' | 'mintAtoms'>
  >,
): Promise<PowRemintMooreContract> {
  return createPowRemintMooreContract({
    ...defaultMooreParams(tokenId, genesisUnix),
    ...opts,
  });
}
