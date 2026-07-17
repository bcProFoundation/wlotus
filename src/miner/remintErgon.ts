import {
  ALL_BIP143,
  DEFAULT_DUST_SATS,
  DEFAULT_FEE_SATS_PER_KB,
  Ecc,
  P2PKHSignatory,
  Script,
  TxBuilder,
  flagSignature,
  sha256d,
  shaRmd160,
  toHex,
  type OutPoint,
  type Signatory,
} from 'ecash-lib';
import { type PowRemintErgonContract } from '../covenant/powRemintErgonScript.js';
import { minePowErgonTarget } from '../covenant/minePow.js';
import { expectedErgonMintOpReturnScript } from '../covenant/powRemintErgonOutputs.js';
import { computeErgonState, type ErgonState } from '../covenant/ergon.js';
import { BASE_MINT_ATOMS } from '../params/consensus.js';

export interface BatonUtxo {
  outpoint: OutPoint;
  sats: bigint;
  txid: string;
  vout: number;
}

export interface RemintKeys {
  sk: Uint8Array;
  pk: Uint8Array;
}

export interface FuelUtxo {
  outpoint: OutPoint;
  sats: bigint;
  outputScript: Script;
}

export const LOCKTIME_ENABLE_SEQUENCE = 0xfffffffe;
export const ERGON_CODESEP_INDEX = 0;

export function ergonMinerBanner(contract: PowRemintErgonContract): string {
  const p = contract.params;
  return [
    'mWLPOW Ergon daily-δ PoW remint miner',
    `genesisTarget=${p.genesisTarget}`,
    `daySeconds=${p.daySeconds}`,
    `δ=99918/100000`,
    `mintAtoms=${BASE_MINT_ATOMS}`,
    'covenant: WlotusPowRemintErgon + eMPP WLDF v2',
  ].join(' | ');
}

export async function buildMinedErgonRemintTx(opts: {
  contract: PowRemintErgonContract;
  baton: BatonUtxo;
  fuel: FuelUtxo;
  miner: RemintKeys;
  locktime?: number;
}): Promise<{
  txHex: string;
  nonceHex: string;
  powAttempts: number;
  mintAtoms: string;
  ergon: ErgonState;
  locktime: number;
}> {
  const { contract, baton, fuel, miner } = opts;
  const dust = DEFAULT_DUST_SATS;
  const locktime =
    opts.locktime ??
    Math.max(
      contract.params.genesisUnix,
      Math.floor(Date.now() / 1000) - 600,
    );
  const ergon = computeErgonState(locktime, contract.params);
  const opReturn = expectedErgonMintOpReturnScript(
    contract.params.tokenId,
    contract.params.mintAtoms,
    ergon,
  );
  const minerP2pkh = Script.p2pkh(shaRmd160(miner.pk));
  const ecc = new Ecc();
  const batonHash = Buffer.from(contract.scriptHash);

  let minedNonce: Uint8Array | undefined;
  let minedAttempts = 0;

  const mkUnlock = (
    nonce: Uint8Array,
    sig65: Uint8Array,
    ds64: Uint8Array,
    preimage: Uint8Array,
  ): Script => {
    const scriptSigBuf = contract.instance.challenges.remint({
      nonce: Buffer.from(nonce),
      s: Buffer.from(sig65),
      ds: Buffer.from(ds64),
      minerPk: Buffer.from(miner.pk),
      preimage: Buffer.from(preimage),
      batonHash,
      target: ergon.target,
    }) as Buffer;
    return new Script(new Uint8Array(scriptSigBuf));
  };

  const batonSignatory: Signatory = (eccCtx, input) => {
    const pre = input.sigHashPreimage(ALL_BIP143, ERGON_CODESEP_INDEX);
    const preimage = pre.bytes;
    if (!minedNonce) {
      const mined = minePowErgonTarget({
        preimage,
        target: ergon.target,
        commit: 'sha256-preimage',
      });
      minedNonce = mined.nonce;
      minedAttempts = mined.attempts;
    }
    const rawSig = eccCtx.schnorrSign(miner.sk, sha256d(preimage));
    return mkUnlock(
      minedNonce,
      flagSignature(rawSig, ALL_BIP143),
      rawSig,
      preimage,
    );
  };

  const txBuild = new TxBuilder({
    locktime,
    inputs: [
      {
        input: {
          prevOut: baton.outpoint,
          sequence: LOCKTIME_ENABLE_SEQUENCE,
          signData: {
            sats: baton.sats,
            redeemScript: contract.redeem,
          },
        },
        signatory: batonSignatory,
      },
      {
        input: {
          prevOut: fuel.outpoint,
          sequence: LOCKTIME_ENABLE_SEQUENCE,
          signData: {
            sats: fuel.sats,
            outputScript: fuel.outputScript,
          },
        },
        signatory: P2PKHSignatory(miner.sk, miner.pk, ALL_BIP143),
      },
    ],
    outputs: [
      { sats: 0n, script: opReturn },
      { sats: dust, script: minerP2pkh },
      { sats: dust, script: contract.p2shScript },
    ],
  });

  const tx = txBuild.sign({
    ecc,
    feePerKb: DEFAULT_FEE_SATS_PER_KB,
    dustSats: dust,
  });
  if (!minedNonce) throw new Error('PoW nonce was not mined');

  return {
    txHex: toHex(tx.ser()),
    nonceHex: toHex(minedNonce),
    powAttempts: minedAttempts,
    mintAtoms: contract.params.mintAtoms.toString(),
    ergon,
    locktime,
  };
}
