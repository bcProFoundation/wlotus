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
import { BASE_MINT_ATOMS, POW_LEADING_ZERO_BYTES } from '../params/consensus.js';

export interface PowRemintParams {
  tokenId: string;
  mintAtoms: bigint;
  difficultyLeadingZeroBytes: number;
}

export type PowInstance = Instance & { challenges: Challenges };

export interface PowRemintContract {
  params: PowRemintParams;
  instance: PowInstance;
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
      resolve(process.cwd(), 'contracts/WlotusPowRemint.spedn'),
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

/** Build the Spedn PoW remint P2SH contract for a known tokenId. */
export async function createPowRemintContract(
  params: PowRemintParams,
): Promise<PowRemintContract> {
  const portable = await loadPortable();
  const factory = new ModuleFactory(new BchJsRts('mainnet'));
  const Ctor = factory.make(portable).WlotusPowRemint;
  const instance = new Ctor({
    tokenIdRev: Buffer.from(fromHexRev(params.tokenId)),
    mintAtomsLe: mintAtomsLe6(params.mintAtoms),
    difficultyLeadingZeroBytes: params.difficultyLeadingZeroBytes,
  }) as PowInstance;
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

export function defaultPowParams(tokenId: string): PowRemintParams {
  return {
    tokenId,
    mintAtoms: BASE_MINT_ATOMS,
    difficultyLeadingZeroBytes: POW_LEADING_ZERO_BYTES,
  };
}

export async function contractForToken(
  tokenId: string,
): Promise<PowRemintContract> {
  return createPowRemintContract(defaultPowParams(tokenId));
}

export function meetsPowDifficulty(hash: Uint8Array, d: number): boolean {
  if (hash.length < d) return false;
  for (let i = 0; i < d; i++) {
    if (hash[i] !== 0) return false;
  }
  return true;
}

export { expectedMintOpReturnScript } from './powRemintOutputs.js';
