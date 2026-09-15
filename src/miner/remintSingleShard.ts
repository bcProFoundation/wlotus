/**
 * Single-shard δ v4 (ELOTUS) miner: builds the 2-input remint
 * [covenant baton + fuel] → [OP_RETURN | miner | baton'].
 *
 * v4 is miner-paced: 10-minute slots, k>=1 skip-tolerant (miners decide
 * backfill-vs-jump; same-slot k=0 stays forbidden), EXACTLY ONE micro-δ
 * step per block regardless of k (difficulty tracks WORK). Consensus math:
 * deriveUdeltaV4 (SUB-form micro-δ), minePowErgonTarget
 * (sha256-preimage commit), WLDF v5 pushdata, numBatons=1 in ALP MINT.
 */
import {
  ALL_BIP143,
  ALP_STANDARD,
  DEFAULT_DUST_SATS,
  Ecc,
  P2PKHSignatory,
  Script,
  TxBuilder,
  alpMint,
  emppScript,
  flagSignature,
  sha256d,
  shaRmd160,
  toHex,
  type OutPoint,
  type Signatory,
} from 'ecash-lib';
import {
  buildUdeltaScriptSig,
  createSingleShardDeltaContract,
  type SingleShardDeltaContract,
  type SingleShardDeltaParams,
} from '../covenant/singleShardDeltaScript.js';
import { minePowErgonTarget } from '../covenant/minePow.js';
import {
  deriveUdeltaV4,
  wldfUdeltaPushdata,
  WLDF_VERSION_UDELTA_V5,
} from '../covenant/singleShardDeltaMath.js';
import { type TwoShardDerived } from '../covenant/twoShardMath.js';

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

export const UDELTA_LOCKTIME_ENABLE_SEQUENCE = 0xfffffffe;
/** The hand-assembled redeem has exactly one CODESEPARATOR (index 0). */
export const UDELTA_CODESEP_INDEX = 0;
/** Single covenant input (~1.2KB scriptSig); policy fee sized by the mine script. */
export const UDELTA_FEE_SATS_PER_KB = 2000n;

export function udeltaMinerBanner(contract: SingleShardDeltaContract): string {
  const p = contract.params;
  return [
    'SingleShardδ v4 (ELOTUS) PoW remint miner — miner-paced slots, k>=1',
    `genesisTarget=${p.genesisTarget}`,
    `daySeconds=${p.daySeconds}`,
    'micro-δ SUB-form: t − floor(t·82/14400000), 1 step/block, verified successors',
    `mintAtoms=${p.mintAtoms}`,
    'covenant: hand-assembled single redeem + WLDF v5',
  ].join(' | ');
}

/** eMPP OP_RETURN: WLDF v5 state + ALP MINT (atoms → out1, 1 baton → out2). */
export function expectedUdeltaMintOpReturnScript(
  tokenId: string,
  mintAtoms: bigint,
  state: { newDay: number; newTarget: number; locktime: number },
): Script {
  return emppScript([
    wldfUdeltaPushdata(state, WLDF_VERSION_UDELTA_V5),
    alpMint(tokenId, ALP_STANDARD, {
      atomsArray: [mintAtoms],
      numBatons: 1,
    }),
  ]);
}

export async function buildMinedUdeltaRemintTx(opts: {
  contract: SingleShardDeltaContract;
  baton: BatonUtxo;
  fuel: FuelUtxo;
  miner: RemintKeys;
  locktime?: number;
}): Promise<{
  txHex: string;
  nonceHex: string;
  powAttempts: number;
  derived: TwoShardDerived;
  locktime: number;
  nextContract: SingleShardDeltaContract;
}> {
  const { contract, baton, fuel, miner } = opts;
  const dust = DEFAULT_DUST_SATS;
  const base: SingleShardDeltaParams = contract.params;
  const locktime =
    opts.locktime ??
    Math.max(base.genesisUnix, Math.floor(Date.now() / 1000) - 600);
  const derived = deriveUdeltaV4(
    {
      genesisUnix: base.genesisUnix,
      daySeconds: base.daySeconds,
      genesisTarget: base.genesisTarget,
    },
    { tipDay: base.tipDay, target: base.tipTarget },
    locktime,
  );
  const nextContract = createSingleShardDeltaContract({
    ...base,
    tipDay: derived.newDay,
    tipTarget: derived.newTarget,
  });
  const opReturn = expectedUdeltaMintOpReturnScript(
    base.tokenId,
    base.mintAtoms,
    derived,
  );
  const minerP2pkh = Script.p2pkh(shaRmd160(miner.pk));
  const ecc = new Ecc();

  let minedNonce: Uint8Array | undefined;
  let minedAttempts = 0;

  const batonSignatory: Signatory = (eccCtx, input) => {
    const pre = input.sigHashPreimage(ALL_BIP143, UDELTA_CODESEP_INDEX);
    const preimage = pre.bytes;
    if (!minedNonce) {
      const mined = minePowErgonTarget({
        preimage,
        target: derived.newTarget,
        commit: 'sha256-preimage',
      });
      minedNonce = mined.nonce;
      minedAttempts = mined.attempts;
    }
    const rawSig = eccCtx.schnorrSign(miner.sk, sha256d(preimage));
    return buildUdeltaScriptSig({
      nextRedeem: new Uint8Array(nextContract.redeem),
      minerPk: miner.pk,
      sig65: flagSignature(rawSig, ALL_BIP143),
      nonce: minedNonce,
      preimage,
      redeem: new Uint8Array(contract.redeem),
    });
  };

  const txBuild = new TxBuilder({
    locktime,
    inputs: [
      {
        input: {
          prevOut: baton.outpoint,
          sequence: UDELTA_LOCKTIME_ENABLE_SEQUENCE,
          signData: {
            sats: baton.sats,
            redeemScript: contract.redeemScript,
          },
        },
        signatory: batonSignatory,
      },
      {
        input: {
          prevOut: fuel.outpoint,
          sequence: UDELTA_LOCKTIME_ENABLE_SEQUENCE,
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
      { sats: dust, script: nextContract.p2shScript },
    ],
  });

  const tx = txBuild.sign({
    ecc,
    feePerKb: UDELTA_FEE_SATS_PER_KB,
    dustSats: dust,
  });
  if (!minedNonce) throw new Error('PoW nonce was not mined');

  return {
    txHex: toHex(tx.ser()),
    nonceHex: toHex(minedNonce),
    powAttempts: minedAttempts,
    derived,
    locktime,
    nextContract,
  };
}
