/**
 * Single-shard δ v5 (durable generation) miner: builds the 2-input remint
 * [covenant baton + fuel] → [OP_RETURN | miner | baton'].
 *
 * v5 keeps miner-paced slots (600s, k>=1 skip-tolerant) and ONE δ step per
 * block, with nBits difficulty (DIV-δ 12.00%/yr, renormalize, terminal
 * HALT), 64-bit PoW, and WLDF v6 pushdata. Consensus math: deriveUdeltaV5,
 * minePowU64, numBatons=1 in ALP MINT.
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
  type Signatory,
} from 'ecash-lib';
import { buildUdeltaScriptSig } from '../covenant/singleShardDeltaScript.js';
import {
  createSingleShardDeltaContractV5,
  type SingleShardDeltaV5Contract,
  type SingleShardDeltaV5Params,
} from '../covenant/singleShardDeltaScriptV5.js';
import { minePowU64 } from '../covenant/minePowV5.js';
import {
  deriveUdeltaV5,
  wldfUdeltaV6Pushdata,
  type UdeltaV5Derived,
} from '../covenant/singleShardDeltaMathV5.js';
import type {
  BatonUtxo,
  FuelUtxo,
  RemintKeys,
} from './remintSingleShard.js';

export const UDELTA_V5_LOCKTIME_ENABLE_SEQUENCE = 0xfffffffe;
/** The v5 redeem has exactly one CODESEPARATOR (index 0). */
export const UDELTA_V5_CODESEP_INDEX = 0;
/** Single covenant input (~1.3KB scriptSig); policy fee sized by the mine script. */
export const UDELTA_V5_FEE_SATS_PER_KB = 2000n;

export function udeltaV5MinerBanner(contract: SingleShardDeltaV5Contract): string {
  const p = contract.params;
  return [
    'SingleShardδ v5 (durable) PoW remint miner — miner-paced slots, k>=1',
    `genesisM=${p.m} genesisE=${p.e}`,
    `daySeconds=${p.daySeconds}`,
    'DIV-δ 12.00%/yr: m − m//463784, 1 step/block, renorm + HALT, verified successors',
    `mintAtoms=${p.mintAtoms}`,
    'covenant: hand-assembled single redeem + WLDF v6 + u64 PoW',
  ].join(' | ');
}

/** eMPP OP_RETURN: WLDF v6 state + ALP MINT (atoms → out1, 1 baton → out2). */
export function expectedUdeltaV5MintOpReturnScript(
  tokenId: string,
  mintAtoms: bigint,
  state: { newDay: number; newM: number; newE: number; locktime: number },
): Script {
  return emppScript([
    wldfUdeltaV6Pushdata(state),
    alpMint(tokenId, ALP_STANDARD, {
      atomsArray: [mintAtoms],
      numBatons: 1,
    }),
  ]);
}

export async function buildMinedUdeltaV5RemintTx(opts: {
  contract: SingleShardDeltaV5Contract;
  baton: BatonUtxo;
  fuel: FuelUtxo;
  miner: RemintKeys;
  locktime?: number;
  maxPowAttempts?: number;
}): Promise<{
  txHex: string;
  nonceHex: string;
  powAttempts: number;
  derived: UdeltaV5Derived;
  locktime: number;
  nextContract: SingleShardDeltaV5Contract;
}> {
  const { contract, baton, fuel, miner } = opts;
  const dust = DEFAULT_DUST_SATS;
  const base: SingleShardDeltaV5Params = contract.params;
  const locktime =
    opts.locktime ??
    Math.max(base.genesisUnix, Math.floor(Date.now() / 1000) - 600);
  const derived = deriveUdeltaV5(
    {
      genesisUnix: base.genesisUnix,
      daySeconds: base.daySeconds,
    },
    { tipDay: base.tipDay, m: base.m, e: base.e },
    locktime,
  );
  const nextContract = createSingleShardDeltaContractV5({
    ...base,
    tipDay: derived.newDay,
    m: derived.newM,
    e: derived.newE,
  });
  const opReturn = expectedUdeltaV5MintOpReturnScript(
    base.tokenId,
    base.mintAtoms,
    derived,
  );
  const minerP2pkh = Script.p2pkh(shaRmd160(miner.pk));
  const ecc = new Ecc();

  let minedNonce: Uint8Array | undefined;
  let minedAttempts = 0;

  const batonSignatory: Signatory = (eccCtx, input) => {
    const pre = input.sigHashPreimage(ALL_BIP143, UDELTA_V5_CODESEP_INDEX);
    const preimage = pre.bytes;
    if (!minedNonce) {
      const mined = minePowU64({
        preimage,
        m: derived.newM,
        e: derived.newE,
        commit: 'sha256-preimage',
        maxAttempts: opts.maxPowAttempts,
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
          sequence: UDELTA_V5_LOCKTIME_ENABLE_SEQUENCE,
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
          sequence: UDELTA_V5_LOCKTIME_ENABLE_SEQUENCE,
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
    feePerKb: UDELTA_V5_FEE_SATS_PER_KB,
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
