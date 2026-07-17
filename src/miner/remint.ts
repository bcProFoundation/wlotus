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
  contractForToken,
  type PowRemintContract,
} from '../covenant/powRemintScript.js';
import { expectedMintOpReturnScript } from '../covenant/powRemintOutputs.js';
import { minePow } from '../covenant/minePow.js';
import { BASE_MINT_ATOMS, POW_LEADING_ZERO_BYTES } from '../params/consensus.js';

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

export { contractForToken };

export function minerBanner(): string {
  return [
    'mWLOTUS PoW remint miner',
    `powLeadingZeroBytes=${POW_LEADING_ZERO_BYTES}`,
    `mintAtoms=${BASE_MINT_ATOMS} (always 100.00 @ 2 decimals)`,
    'covenant: Spedn Mist-style BIP143 preimage (eCash)',
  ].join(' | ');
}

/**
 * Build + mine + sign one remint.
 * Schnorr sig (65B) for CHECKSIG over sha256d(preimage);
 * Schnorr datasig (64B) for CHECKDATASIG over sha256(preimage).
 */
export async function buildMinedRemintTx(opts: {
  contract: PowRemintContract;
  baton: BatonUtxo;
  fuel: FuelUtxo;
  miner: RemintKeys;
}): Promise<{
  txHex: string;
  nonceHex: string;
  powAttempts: number;
  mintAtoms: string;
}> {
  const { contract, baton, fuel, miner } = opts;
  const dust = DEFAULT_DUST_SATS;
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
      const mined = minePow({
        preimage,
        difficultyLeadingZeroBytes: contract.params.difficultyLeadingZeroBytes,
      });
      minedNonce = mined.nonce;
      minedAttempts = mined.attempts;
    }
    // CHECKSIG message = hash256(preimage). CHECKDATASIG hashes its
    // message once, so pass sha256(preimage) on-stack and the same 64-byte
    // Schnorr sig (toDataSig) — both verify hash256(preimage).
    const rawSig = eccCtx.schnorrSign(miner.sk, sha256d(preimage));
    const sig65 = flagSignature(rawSig, ALL_BIP143);
    const ds64 = rawSig;
    return mkUnlock(minedNonce, sig65, ds64, preimage);
  };

  const txBuild = new TxBuilder({
    inputs: [
      {
        input: {
          prevOut: baton.outpoint,
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
  if (!minedNonce) {
    throw new Error('PoW nonce was not mined');
  }

  return {
    txHex: toHex(tx.ser()),
    nonceHex: toHex(minedNonce),
    powAttempts: minedAttempts,
    mintAtoms: contract.params.mintAtoms.toString(),
  };
}
