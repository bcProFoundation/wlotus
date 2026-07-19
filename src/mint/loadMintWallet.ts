/**
 * Load the mint / desk wallet used to pay XEC fees and hold kept Prayer atoms.
 *
 * Priority:
 *   1. MINT_MNEMONIC (12/24-word BIP39-style phrase)
 *   2. MINT_SK_HEX
 *   3. GENESIS_SK_HEX (legacy / local dogfood)
 */
import { toHex } from 'ecash-lib';
import { Wallet } from 'ecash-wallet';
import type { ChronikClient } from 'chronik-client';

export interface MintWallet {
  wallet: Wallet;
  sk: Uint8Array;
  pk: Uint8Array;
  address: string;
  source: 'mnemonic' | 'mint_sk' | 'genesis_sk';
}

function normalizeMnemonic(raw: string): string {
  return raw.trim().split(/\s+/).join(' ');
}

export async function loadMintWallet(
  chronik: ChronikClient,
): Promise<MintWallet> {
  const mnemonic = process.env.MINT_MNEMONIC?.trim();
  if (mnemonic) {
    const phrase = normalizeMnemonic(mnemonic);
    const words = phrase.split(' ');
    if (words.length !== 12 && words.length !== 24) {
      throw new Error(
        `MINT_MNEMONIC must be 12 or 24 words (got ${words.length})`,
      );
    }
    // Non-HD: single address from seed (ecash-wallet default).
    const wallet = Wallet.fromMnemonic(phrase, chronik);
    await wallet.sync();
    return {
      wallet,
      sk: wallet.sk,
      pk: wallet.pk,
      address: wallet.address,
      source: 'mnemonic',
    };
  }

  const skHex =
    process.env.MINT_SK_HEX?.trim() || process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error(
      'Set MINT_MNEMONIC (preferred) or MINT_SK_HEX / GENESIS_SK_HEX',
    );
  }

  const { fromHex } = await import('ecash-lib');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await wallet.sync();
  return {
    wallet,
    sk: wallet.sk,
    pk: wallet.pk,
    address: wallet.address,
    source: process.env.MINT_SK_HEX?.trim() ? 'mint_sk' : 'genesis_sk',
  };
}

/** Debug helper — never log sk/mnemonic. */
export function mintWalletSummary(m: MintWallet): Record<string, string> {
  return {
    source: m.source,
    address: m.address,
    pkPrefix: `${toHex(m.pk).slice(0, 8)}…`,
  };
}
