import {
  ALL_BIP143,
  DEFAULT_DUST_SATS,
  DEFAULT_FEE_SATS_PER_KB,
  Ecc,
  P2PKHSignatory,
  Script,
  Tx,
  TxBuilder,
  UnsignedTx,
  flagSignature,
  fromHex,
  sha256,
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
import { minePowBits, verifyPowBits } from '../covenant/minePow.js';
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
export const MOORE_TIP_NONCE_LENGTH = 4;
export const MOORE_TIP_POW_COMMIT = 'sha256-preimage' as const;

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

export interface MooreTipRemintPrepared {
  contract: PowRemintMooreTipContract;
  baton: BatonUtxo;
  fuel: FuelUtxo;
  miner: RemintKeys;
  locktime: number;
  tip: MooreTipState;
  nextContract: PowRemintMooreTipContract;
  nextRedeem: Buffer;
  opReturn: Script;
  minerP2pkh: Script;
  dust: bigint;
  /** BIP143 sighash preimage for baton input (codesep 0). */
  preimage: Uint8Array;
  /** sha256(preimage) — client mines sha256d(powPrefix || nonce). */
  powPrefix: Uint8Array;
  preimageHex: string;
  powPrefixHex: string;
}

async function prepareMooreTipRemint(opts: {
  contract: PowRemintMooreTipContract;
  baton: BatonUtxo;
  fuel: FuelUtxo;
  miner: RemintKeys;
  locktime: number;
}): Promise<MooreTipRemintPrepared> {
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
  const nextRedeem = reconstructNextRedeem(
    contract.params,
    contract.codeHash,
    contract.prefixHash,
    contract.codeBytes,
    tip.locktime,
  );
  if (!nextRedeem.equals(nextContract.redeemScriptBuf)) {
    throw new Error(
      `nextRedeem mismatch vs nextContract (${nextRedeem.length} vs ${nextContract.redeemScriptBuf.length})`,
    );
  }

  const unsigned = new Tx({
    locktime,
    inputs: [
      {
        prevOut: baton.outpoint,
        sequence: LOCKTIME_ENABLE_SEQUENCE,
        signData: {
          sats: baton.sats,
          redeemScript: contract.redeem,
        },
      },
      {
        prevOut: fuel.outpoint,
        sequence: LOCKTIME_ENABLE_SEQUENCE,
        signData: {
          sats: fuel.sats,
          outputScript: fuel.outputScript,
        },
      },
    ],
    outputs: [
      { sats: 0n, script: opReturn },
      { sats: dust, script: minerP2pkh },
      { sats: dust, script: nextContract.p2shScript },
    ],
  });

  const preimage = UnsignedTx.fromTx(unsigned)
    .inputAt(0)
    .sigHashPreimage(ALL_BIP143, MOORE_TIP_CODESEP_INDEX).bytes;
  const powPrefix = sha256(preimage);

  return {
    contract,
    baton,
    fuel,
    miner,
    locktime,
    tip,
    nextContract,
    nextRedeem,
    opReturn,
    minerP2pkh,
    dust,
    preimage,
    powPrefix,
    preimageHex: toHex(preimage),
    powPrefixHex: toHex(powPrefix),
  };
}

/** Build challenge material (preimage) without mining. */
export async function buildMooreTipRemintChallenge(opts: {
  contract: PowRemintMooreTipContract;
  baton: BatonUtxo;
  fuel: FuelUtxo;
  miner: RemintKeys;
  locktime: number;
}): Promise<MooreTipRemintPrepared> {
  return prepareMooreTipRemint(opts);
}

/** Sign + serialize remint using a client-mined nonce (server verifies first). */
export async function buildMooreTipRemintTxWithNonce(opts: {
  prepared: MooreTipRemintPrepared;
  nonce: Uint8Array;
}): Promise<{
  txHex: string;
  nonceHex: string;
  tip: MooreTipState;
  locktime: number;
  nextContract: PowRemintMooreTipContract;
  mintAtoms: string;
}> {
  const { prepared, nonce } = opts;
  if (nonce.length !== MOORE_TIP_NONCE_LENGTH) {
    throw new Error(
      `nonce must be ${MOORE_TIP_NONCE_LENGTH} bytes, got ${nonce.length}`,
    );
  }
  if (
    !verifyPowBits({
      preimage: prepared.preimage,
      nonce,
      bits: prepared.tip.bits,
      commit: MOORE_TIP_POW_COMMIT,
    })
  ) {
    throw new Error('PoW nonce does not meet difficulty');
  }

  const { contract, baton, fuel, miner, locktime, tip, nextContract } =
    prepared;

  const mkUnlock = (
    n: Uint8Array,
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
      nonce: Buffer.from(n),
      s: Buffer.from(sig65),
      ds: Buffer.from(ds64),
      minerPk: Buffer.from(miner.pk),
      preimage: Buffer.from(preimage),
      nextRedeem: prepared.nextRedeem,
    }) as Buffer;
    return new Script(new Uint8Array(scriptSigBuf));
  };

  const batonSignatory: Signatory = (eccCtx, input) => {
    const pre = input.sigHashPreimage(ALL_BIP143, MOORE_TIP_CODESEP_INDEX);
    const preimage = pre.bytes;
    if (toHex(preimage) !== prepared.preimageHex) {
      throw new Error('sighash preimage drift vs challenge');
    }
    const rawSig = eccCtx.schnorrSign(miner.sk, sha256d(preimage));
    const sig65 = flagSignature(rawSig, ALL_BIP143);
    return mkUnlock(nonce, sig65, rawSig, preimage);
  };

  const ecc = new Ecc();
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
      { sats: 0n, script: prepared.opReturn },
      { sats: prepared.dust, script: prepared.minerP2pkh },
      { sats: prepared.dust, script: nextContract.p2shScript },
    ],
  });

  const tx = txBuild.sign({
    ecc,
    feePerKb: DEFAULT_FEE_SATS_PER_KB * 2n,
    dustSats: prepared.dust,
  });
  if (tx.outputs.length !== 3) {
    throw new Error(`Expected 3 outputs, got ${tx.outputs.length}`);
  }
  if (tx.locktime !== locktime) {
    throw new Error(`locktime mismatch: tx=${tx.locktime} want=${locktime}`);
  }

  return {
    txHex: toHex(tx.ser()),
    nonceHex: toHex(nonce),
    tip,
    locktime,
    nextContract,
    mintAtoms: contract.params.mintAtoms.toString(),
  };
}

/** Mine + finalize (CLI / server fallback). */
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
  powMs: number;
  mintAtoms: string;
  tip: MooreTipState;
  locktime: number;
  nextContract: PowRemintMooreTipContract;
}> {
  const prepared = await prepareMooreTipRemint(opts);
  const t0 = Date.now();
  const mined = minePowBits({
    preimage: prepared.preimage,
    bits: prepared.tip.bits,
    commit: MOORE_TIP_POW_COMMIT,
    maxAttempts: 100_000_000,
  });
  const powMs = Math.max(1, Date.now() - t0);
  const built = await buildMooreTipRemintTxWithNonce({
    prepared,
    nonce: mined.nonce,
  });
  return {
    ...built,
    powAttempts: mined.attempts,
    powMs,
  };
}

export function parseNonceHex(nonceHex: string): Uint8Array {
  const cleaned = nonceHex.trim().toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]+$/.test(cleaned) || cleaned.length !== MOORE_TIP_NONCE_LENGTH * 2) {
    throw new Error(
      `nonceHex must be ${MOORE_TIP_NONCE_LENGTH * 2} hex chars`,
    );
  }
  return fromHex(cleaned);
}
