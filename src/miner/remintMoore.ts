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
  type PowRemintMooreContract,
} from '../covenant/powRemintMooreScript.js';
import { minePowBits } from '../covenant/minePow.js';
import { expectedMintOpReturnScript } from '../covenant/powRemintOutputs.js';
import {
  computeMooreBits,
  type MooreBitsState,
} from '../covenant/wldf.js';
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

/** Activate nLockTime: at least one input sequence must be < 0xffffffff. */
export const LOCKTIME_ENABLE_SEQUENCE = 0xfffffffe;

export function mooreMinerBanner(contract: PowRemintMooreContract): string {
  const p = contract.params;
  return [
    'mWLPOW Moore-bit PoW remint miner',
    `baseZeroBits=${p.baseZeroBits}`,
    `secondsPerExtraBit=${p.secondsPerExtraBit}`,
    `genesisUnix=${p.genesisUnix}`,
    `mintAtoms=${BASE_MINT_ATOMS} (always 100 @ 0 decimals)`,
    'covenant: WlotusPowRemintMoore (locktime bits; ALP MINT OP_RETURN)',
  ].join(' | ');
}

/**
 * Build + mine + sign one Moore remint.
 * Sets nLockTime and input sequences so locktime-derived bits are active.
 */
export async function buildMinedMooreRemintTx(opts: {
  contract: PowRemintMooreContract;
  baton: BatonUtxo;
  fuel: FuelUtxo;
  miner: RemintKeys;
  /** Unix locktime; default = now (clamped ≥ genesisUnix). */
  locktime?: number;
}): Promise<{
  txHex: string;
  nonceHex: string;
  powAttempts: number;
  mintAtoms: string;
  moore: MooreBitsState;
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
  const moore = computeMooreBits(locktime, contract.params);
  const opReturn = expectedMintOpReturnScript(
    contract.params.tokenId,
    contract.params.mintAtoms,
  );
  const minerP2pkh = Script.p2pkh(shaRmd160(miner.pk));
  const ecc = new Ecc();

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
    }) as Buffer;
    return new Script(new Uint8Array(scriptSigBuf));
  };

  const batonSignatory: Signatory = (eccCtx, input) => {
    const pre = input.sigHashPreimage(ALL_BIP143);
    const preimage = pre.bytes;
    if (!minedNonce) {
      const mined = minePowBits({
        preimage,
        bits: moore.bits,
        commit: 'sha256-preimage',
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
      { sats: dust, script: contract.p2shScript },
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
    moore,
    locktime,
  };
}
