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
import {
  createPowRemintMooreTipContract,
  reconstructNextRedeem,
  type PowRemintMooreTipContract,
} from '../covenant/powRemintMooreTipScript.js';
import { expectedMooreTipMintOpReturnScript } from '../covenant/powRemintMooreTipOutputs.js';
import { minePowBits } from '../covenant/minePow.js';
import {
  computeMooreTipState,
  type MooreTipState,
} from '../covenant/mooreTip.js';

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
export const MOORE_TIP_CODESEP_INDEX = 0;

export function mooreTipMinerBanner(
  contract: PowRemintMooreTipContract,
): string {
  const p = contract.params;
  return [
    'MooreTip production miner',
    `baseZeroBits=${p.baseZeroBits}`,
    `secondsPerExtraBit=${p.secondsPerExtraBit}`,
    `tipLocktime=${p.tipLocktime}`,
    `mintAtoms=${p.mintAtoms}`,
    'hard next-P2SH (codeHash) + tip anti-rewind',
  ].join(' | ');
}

/** Mine one MooreTip remint with hard-bound next tip P2SH. */
export async function buildMinedMooreTipRemintTx(opts: {
  contract: PowRemintMooreTipContract;
  baton: BatonUtxo;
  fuel: FuelUtxo;
  miner: RemintKeys;
  locktime: number;
}): Promise<{
  txHex: string;
  nonceHex: string;
  powAttempts: number;
  mintAtoms: string;
  tip: MooreTipState;
  locktime: number;
  nextContract: PowRemintMooreTipContract;
}> {
  const { contract, baton, fuel, miner, locktime } = opts;
  const dust = DEFAULT_DUST_SATS;
  const tip = computeMooreTipState(locktime, contract.params);
  const nextContract = await createPowRemintMooreTipContract({
    ...contract.params,
    tipLocktime: tip.locktime,
  });
  const opReturn = expectedMooreTipMintOpReturnScript(
    contract.params.tokenId,
    contract.params.mintAtoms,
    tip,
  );
  const minerP2pkh = Script.p2pkh(shaRmd160(miner.pk));
  const ecc = new Ecc();
  const nextRedeem = reconstructNextRedeem(
    contract.params,
    contract.codeHash,
    contract.codeBytes,
    tip.locktime,
  );
  if (!nextRedeem.equals(nextContract.redeemScriptBuf)) {
    throw new Error(
      `nextRedeem mismatch vs nextContract (${nextRedeem.length} vs ${nextContract.redeemScriptBuf.length})`,
    );
  }

  let minedNonce: Uint8Array | undefined;
  let minedAttempts = 0;

  const mkUnlock = (
    nonce: Uint8Array,
    sig65: Uint8Array,
    ds64: Uint8Array,
    preimage: Uint8Array,
  ): Script => {
    if (sig65.length !== 65) {
      throw new Error(`Sig must be 65 bytes, got ${sig65.length}`);
    }
    if (ds64.length !== 64) {
      throw new Error(`DataSig must be 64 bytes, got ${ds64.length}`);
    }
    const scriptSigBuf = contract.instance.challenges.remint({
      nonce: Buffer.from(nonce),
      s: Buffer.from(sig65),
      ds: Buffer.from(ds64),
      minerPk: Buffer.from(miner.pk),
      preimage: Buffer.from(preimage),
      nextRedeem,
    }) as Buffer;
    return new Script(new Uint8Array(scriptSigBuf));
  };

  const batonSignatory: Signatory = (eccCtx, input) => {
    const pre = input.sigHashPreimage(ALL_BIP143, MOORE_TIP_CODESEP_INDEX);
    const preimage = pre.bytes;
    if (!minedNonce) {
      const mined = minePowBits({
        preimage,
        bits: tip.bits,
        commit: 'sha256-preimage',
        maxAttempts: 100_000_000,
      });
      minedNonce = mined.nonce;
      minedAttempts = mined.attempts;
    }
    const rawSig = eccCtx.schnorrSign(miner.sk, sha256d(preimage));
    const sig65 = flagSignature(rawSig, ALL_BIP143);
    const ds64 = rawSig;
    return mkUnlock(minedNonce, sig65, ds64, preimage);
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
      { sats: dust, script: nextContract.p2shScript },
    ],
  });

  const tx = txBuild.sign({
    ecc,
    feePerKb: DEFAULT_FEE_SATS_PER_KB,
    dustSats: dust,
  });
  if (tx.outputs.length !== 3) {
    throw new Error(`Expected 3 outputs, got ${tx.outputs.length}`);
  }
  if (tx.locktime !== locktime) {
    throw new Error(`locktime mismatch: tx=${tx.locktime} want=${locktime}`);
  }
  if (!minedNonce) {
    throw new Error('PoW nonce was not mined');
  }

  return {
    txHex: toHex(tx.ser()),
    nonceHex: toHex(minedNonce),
    powAttempts: minedAttempts,
    mintAtoms: contract.params.mintAtoms.toString(),
    tip,
    locktime,
    nextContract,
  };
}
