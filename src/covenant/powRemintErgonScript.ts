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
import { BASE_MINT_ATOMS } from '../params/consensus.js';
import {
  buildErgonTargetTable,
  ERGON_DAY_SECONDS_DEFAULT,
  ERGON_GENESIS_TARGET,
} from './ergon.js';

export interface PowRemintErgonParams {
  tokenId: string;
  mintAtoms: bigint;
  genesisUnix: number;
  daySeconds: number;
  genesisTarget: number;
}

export type PowErgonInstance = Instance & { challenges: Challenges };

export interface PowRemintErgonContract {
  params: PowRemintErgonParams;
  instance: PowErgonInstance;
  redeem: EcashScript;
  redeemScriptBuf: Buffer;
  scriptHash: Uint8Array;
  p2shScript: EcashScript;
  address: string;
  redeemHex: string;
  targetTable: Buffer;
}

let cachedPortable: PortableModule | undefined;

async function loadPortable(): Promise<PortableModule> {
  if (cachedPortable) return cachedPortable;
  const spedn = new Spedn();
  try {
    const code = readFileSync(
      resolve(process.cwd(), 'contracts/WlotusPowRemintErgon.spedn'),
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

export async function createPowRemintErgonContract(
  params: PowRemintErgonParams,
): Promise<PowRemintErgonContract> {
  const portable = await loadPortable();
  const factory = new ModuleFactory(new BchJsRts('mainnet'));
  const Ctor = factory.make(portable).WlotusPowRemintErgon;
  const targetTable = buildErgonTargetTable(params.genesisTarget);
  const instance = new Ctor({
    tokenIdRev: Buffer.from(fromHexRev(params.tokenId)),
    mintAtomsLe: mintAtomsLe6(params.mintAtoms),
    genesisUnix: params.genesisUnix,
    daySeconds: params.daySeconds,
    targetTable,
  }) as PowErgonInstance;
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
    targetTable,
  };
}

export function defaultErgonParams(
  tokenId: string,
  genesisUnix: number,
): PowRemintErgonParams {
  return {
    tokenId,
    mintAtoms: BASE_MINT_ATOMS,
    genesisUnix,
    daySeconds: ERGON_DAY_SECONDS_DEFAULT,
    genesisTarget: ERGON_GENESIS_TARGET,
  };
}
