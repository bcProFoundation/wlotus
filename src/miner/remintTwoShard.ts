import {
  ALL_BIP143,
  DEFAULT_DUST_SATS,
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
import {
  createTwoShardPair,
  type TwoShardPair,
  type TwoShardShardParams,
} from '../covenant/twoShardScript.js';
import { minePowErgonTarget } from '../covenant/minePow.js';
import { expectedTwoShardMintOpReturnScript } from '../covenant/twoShard.js';
import {
  deriveTwoShardState,
  type TwoShardDerived,
} from '../covenant/twoShardMath.js';

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

export const TWOSHARD_LOCKTIME_ENABLE_SEQUENCE = 0xfffffffe;
/** Both shards have exactly one CODESEPARATOR (C's is late, M's guards sigs). */
export const TWOSHARD_CODESEP_INDEX = 0;
/** Generous fee: scriptSigs carry two ~300-400B redeems + preimages. */
export const TWOSHARD_FEE_SATS_PER_KB = 2000n;

export function twoShardMinerBanner(pair: TwoShardPair): string {
  const p = pair.c.params;
  return [
    'TwoShard (C+M) Ergon-δ PoW remint miner',
    `genesisTarget=${p.genesisTarget}`,
    `daySeconds=${p.daySeconds}`,
    'δ SUB-form: t − floor(t·82/100000), K=1',
    `mintAtoms=${p.mintAtoms}`,
    'covenant: GlotusComputeShard + GlotusMintShard + WLDF v3',
  ].join(' | ');
}

function redeemScriptOf(shard: { redeem: Buffer }): Script {
  return new Script(new Uint8Array(shard.redeem));
}

export async function buildMinedTwoShardRemintTx(opts: {
  pair: TwoShardPair;
  batonC: BatonUtxo;
  batonM: BatonUtxo;
  fuel: FuelUtxo;
  miner: RemintKeys;
  locktime?: number;
}): Promise<{
  txHex: string;
  nonceHex: string;
  powAttempts: number;
  derived: TwoShardDerived;
  locktime: number;
  nextPair: TwoShardPair;
}> {
  const { pair, batonC, batonM, fuel, miner } = opts;
  const dust = DEFAULT_DUST_SATS;
  const base: TwoShardShardParams = pair.c.params;
  const locktime =
    opts.locktime ??
    Math.max(base.genesisUnix, Math.floor(Date.now() / 1000) - 600);
  const derived = deriveTwoShardState(
    {
      genesisUnix: base.genesisUnix,
      daySeconds: base.daySeconds,
      genesisTarget: base.genesisTarget,
    },
    { tipDay: base.tipDay, target: base.tipTarget },
    locktime,
  );
  const nextPair = await createTwoShardPair({
    ...base,
    tipDay: derived.newDay,
    tipTarget: derived.newTarget,
  });
  const opReturn = expectedTwoShardMintOpReturnScript(
    base.tokenId,
    base.mintAtoms,
    derived,
  );
  const minerP2pkh = Script.p2pkh(shaRmd160(miner.pk));
  const ecc = new Ecc();

  let minedNonce: Uint8Array | undefined;
  let minedAttempts = 0;

  const mkUnlockC = (sig65: Uint8Array, preimage: Uint8Array): Script => {
    const scriptSigBuf = pair.c.instance.challenges.remint({
      minerPk: Buffer.from(miner.pk),
      newTarget: derived.newTarget,
      preimage: Buffer.from(preimage),
      nextCRedeem: nextPair.c.redeem,
      nextMRedeem: nextPair.m.redeem,
      sc: Buffer.from(sig65),
    }) as Buffer;
    return new Script(new Uint8Array(scriptSigBuf));
  };

  const mkUnlockM = (
    nonce: Uint8Array,
    sig65: Uint8Array,
    ds64: Uint8Array,
    preimage: Uint8Array,
  ): Script => {
    const scriptSigBuf = pair.m.instance.challenges.remint({
      nonce: Buffer.from(nonce),
      s: Buffer.from(sig65),
      ds: Buffer.from(ds64),
      minerPk: Buffer.from(miner.pk),
      newDay: derived.newDay,
      newTarget: derived.newTarget,
      preimage: Buffer.from(preimage),
      nextCRedeem: nextPair.c.redeem,
      nextMRedeem: nextPair.m.redeem,
    }) as Buffer;
    return new Script(new Uint8Array(scriptSigBuf));
  };

  // Input 0: C shard (late CODESEPARATOR keeps the preimage small).
  const cSignatory: Signatory = (eccCtx, input) => {
    const pre = input.sigHashPreimage(ALL_BIP143, TWOSHARD_CODESEP_INDEX);
    const rawSigC = eccCtx.schnorrSign(miner.sk, sha256d(pre.bytes));
    return mkUnlockC(flagSignature(rawSigC, ALL_BIP143), pre.bytes);
  };

  // Input 1: M shard (CODESEPARATOR suffix) + PoW mining + sigs.
  const mSignatory: Signatory = (eccCtx, input) => {
    const pre = input.sigHashPreimage(
      ALL_BIP143,
      TWOSHARD_CODESEP_INDEX,
    );
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
    return mkUnlockM(
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
          prevOut: batonC.outpoint,
          sequence: TWOSHARD_LOCKTIME_ENABLE_SEQUENCE,
          signData: {
            sats: batonC.sats,
            redeemScript: redeemScriptOf(pair.c),
          },
        },
        signatory: cSignatory,
      },
      {
        input: {
          prevOut: batonM.outpoint,
          sequence: TWOSHARD_LOCKTIME_ENABLE_SEQUENCE,
          signData: {
            sats: batonM.sats,
            redeemScript: redeemScriptOf(pair.m),
          },
        },
        signatory: mSignatory,
      },
      {
        input: {
          prevOut: fuel.outpoint,
          sequence: TWOSHARD_LOCKTIME_ENABLE_SEQUENCE,
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
      { sats: dust, script: nextPair.c.p2shScript },
      { sats: dust, script: nextPair.m.p2shScript },
    ],
  });

  const tx = txBuild.sign({
    ecc,
    feePerKb: TWOSHARD_FEE_SATS_PER_KB,
    dustSats: dust,
  });
  if (!minedNonce) throw new Error('PoW nonce was not mined');

  return {
    txHex: toHex(tx.ser()),
    nonceHex: toHex(minedNonce),
    powAttempts: minedAttempts,
    derived,
    locktime,
    nextPair,
  };
}
