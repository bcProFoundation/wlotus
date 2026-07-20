/**
 * Per-tip fee wallets derived from MINT_MNEMONIC (BIP44 account per tip).
 *
 * Main desk (`loadMintWallet`) stays on the legacy token-aware single address
 * and holds treasury XEC. Tip fee wallets are HD accounts:
 *
 *   tipIndex i → m/44'/1899'/(i+1)'/0/0
 *
 * so tip 0 and tip 1 never share a fee UTXO. The tip key signs remint fuel and
 * therefore also receives the minted Prayer dust for that remint.
 */
import { toHex } from 'ecash-lib';
import { Wallet } from 'ecash-wallet';
import type { ChronikClient } from 'chronik-client';
import type { MintWallet } from './loadMintWallet.js';
import { tipFeeAccountNumber } from './fuelUtxo.js';

function normalizeMnemonic(raw: string): string {
  return raw.trim().split(/\s+/).join(' ');
}

export { tipFeeAccountNumber };

export async function loadTipFeeWallet(
  chronik: ChronikClient,
  tipIndex: number,
): Promise<MintWallet> {
  const mnemonic = process.env.MINT_MNEMONIC?.trim();
  if (!mnemonic) {
    throw new Error(
      'MINT_MNEMONIC required for tip fee wallets (HD accounts from the desk phrase)',
    );
  }
  const phrase = normalizeMnemonic(mnemonic);
  const words = phrase.split(' ');
  if (words.length !== 12 && words.length !== 24) {
    throw new Error(
      `MINT_MNEMONIC must be 12 or 24 words (got ${words.length})`,
    );
  }

  const accountNumber = tipFeeAccountNumber(tipIndex);
  const wallet = Wallet.fromMnemonic(phrase, chronik, {
    hd: true,
    accountNumber,
    receiveIndex: 0,
    changeIndex: 0,
  });
  await wallet.sync();
  return {
    wallet,
    sk: wallet.sk,
    pk: wallet.pk,
    address: wallet.address,
    source: 'mnemonic',
  };
}

export function tipFeeWalletSummary(
  tipIndex: number,
  m: MintWallet,
): Record<string, string | number> {
  return {
    tipIndex,
    accountNumber: tipFeeAccountNumber(tipIndex),
    address: m.address,
    pkPrefix: `${toHex(m.pk).slice(0, 8)}…`,
    source: m.source,
  };
}
