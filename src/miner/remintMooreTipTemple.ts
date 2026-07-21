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
  sha256,
  sha256d,
  shaRmd160,
  toHex,
  type OutPoint,
  type Signatory,
} from 'ecash-lib';
import {
  createPowRemintMooreTipTempleContract,
  reconstructTempleNextRedeem,
  type PowRemintMooreTipTempleContract,
} from '../covenant/powRemintMooreTipTempleScript.js';
import { expectedMooreTipTempleMintOpReturnScript } from '../covenant/powRemintMooreTipTempleOutputs.js';
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
export const MOORE_TIP_TEMPLE_CODESEP_INDEX = 0;
export const MOORE_TIP_TEMPLE_NONCE_LENGTH = 4;
export const MOORE_TIP_TEMPLE_POW_COMMIT = 'sha256-preimage' as const;

export function mooreTipTempleMinerBanner(
  contract: PowRemintMooreTipTempleContract,
): string {
  const p = contract.params;
  return [
    'MooreTipTemple wLotus miner',
    `baseZeroBits=${p.baseZeroBits}`,
    `mint=108 (1 miner + 107 temple mala)`,
    `tipLocktime=${p.tipLocktime}`,
    'hard next-P2SH + tip anti-rewind',
  ].join(' | ');
}

export interface MooreTipTempleRemintPrepared {
  contract: PowRemintMooreTipTempleContract;
  baton: BatonUtxo;
  fuel: FuelUtxo;
  miner: RemintKeys;
  locktime: number;
  tip: MooreTipState;
  nextContract: PowRemintMooreTipTempleContract;
  nextRedeem: Buffer;
  opReturn: Script;
  minerP2pkh: Script;
  templeP2sh: Script;
  dust: bigint;
  preimage: Uint8Array;
  powPrefix: Uint8Array;
  preimageHex: string;
  powPrefixHex: string;
}

async function prepareMooreTipTempleRemint(opts: {
  contract: PowRemintMooreTipTempleContract;
  baton: BatonUtxo;
  fuel: FuelUtxo;
  miner: RemintKeys;
  locktime: number;
}): Promise<MooreTipTempleRemintPrepared> {
  const { contract, baton, fuel, miner, locktime } = opts;
  const dust = DEFAULT_DUST_SATS;
  const tip = computeMooreTipState(locktime, contract.params);
  const nextContract = await createPowRemintMooreTipTempleContract({
    ...contract.params,
    tipLocktime: tip.locktime,
  });
  const opReturn = expectedMooreTipTempleMintOpReturnScript(
    contract.params.tokenId,
    tip,
  );
  const minerP2pkh = Script.p2pkh(shaRmd160(miner.pk));
  const templeP2sh = Script.p2sh(contract.params.templeScriptHash);
  const nextRedeem = reconstructTempleNextRedeem(
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
      { sats: dust, script: templeP2sh },
      { sats: dust, script: nextContract.p2shScript },
    ],
  });

  const preimage = UnsignedTx.fromTx(unsigned)
    .inputAt(0)
    .sigHashPreimage(ALL_BIP143, MOORE_TIP_TEMPLE_CODESEP_INDEX).bytes;
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
    templeP2sh,
    dust,
    preimage,
    powPrefix,
    preimageHex: toHex(preimage),
    powPrefixHex: toHex(powPrefix),
  };
}

export async function buildMooreTipTempleRemintChallenge(opts: {
  contract: PowRemintMooreTipTempleContract;
  baton: BatonUtxo;
  fuel: FuelUtxo;
  miner: RemintKeys;
  locktime: number;
}): Promise<MooreTipTempleRemintPrepared> {
  return prepareMooreTipTempleRemint(opts);
}

export async function buildMooreTipTempleRemintTxWithNonce(opts: {
  prepared: MooreTipTempleRemintPrepared;
  nonce: Uint8Array;
}): Promise<{
  txHex: string;
  nonceHex: string;
  tip: MooreTipState;
  locktime: number;
  nextContract: PowRemintMooreTipTempleContract;
  mintAtoms: string;
}> {
  const { prepared, nonce } = opts;
  if (nonce.length !== MOORE_TIP_TEMPLE_NONCE_LENGTH) {
    throw new Error(
      `nonce must be ${MOORE_TIP_TEMPLE_NONCE_LENGTH} bytes, got ${nonce.length}`,
    );
  }
  if (
    !verifyPowBits({
      preimage: prepared.preimage,
      nonce,
      bits: prepared.tip.bits,
      commit: MOORE_TIP_TEMPLE_POW_COMMIT,
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
    const pre = input.sigHashPreimage(
      ALL_BIP143,
      MOORE_TIP_TEMPLE_CODESEP_INDEX,
    );
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
      { sats: prepared.dust, script: prepared.templeP2sh },
      { sats: prepared.dust, script: nextContract.p2shScript },
    ],
  });

  const tx = txBuild.sign({
    ecc,
    feePerKb: DEFAULT_FEE_SATS_PER_KB * 2n,
    dustSats: prepared.dust,
  });
  if (tx.outputs.length !== 4) {
    throw new Error(`Expected 4 outputs, got ${tx.outputs.length}`);
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

export async function buildMinedMooreTipTempleRemintTx(opts: {
  contract: PowRemintMooreTipTempleContract;
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
  nextContract: PowRemintMooreTipTempleContract;
}> {
  const prepared = await prepareMooreTipTempleRemint(opts);
  const t0 = Date.now();
  const mined = minePowBits({
    preimage: prepared.preimage,
    bits: prepared.tip.bits,
    commit: MOORE_TIP_TEMPLE_POW_COMMIT,
  });
  const built = await buildMooreTipTempleRemintTxWithNonce({
    prepared,
    nonce: mined.nonce,
  });
  return {
    ...built,
    powAttempts: mined.attempts,
    powMs: Date.now() - t0,
  };
}
