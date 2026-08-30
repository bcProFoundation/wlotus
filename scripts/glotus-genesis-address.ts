#!/usr/bin/env tsx
/**
 * Derive a dedicated GLotus genesis address from GLOTUS_MNEMONIC.
 *
 * Path: m/44'/1899'/99'/0/0 (BIP44 account 99) — not the desk path
 * m/44'/1899'/0'/0/0 and not tip accounts 1–28.
 *
 * Prints address + balance only. Never prints sk or mnemonic.
 */
import { Wallet } from 'ecash-wallet';
import { toHex } from 'ecash-lib';
import type { ChronikClient } from 'chronik-client';
import { createChronik } from '../src/network/createChronik.js';

/** Isolated from desk (0) and sponsored tips (1–28). */
export const GLOTUS_GENESIS_ACCOUNT = 99;

export const GLOTUS_EXPECTED_GENESIS_ADDRESS =
  'ecash:qz269uelzmdvjqls2862p3va3hkkplwxsuhaes8se0';

export function glotusMnemonicPhrase(): string {
  const raw = process.env.GLOTUS_MNEMONIC?.trim();
  if (!raw) throw new Error('Set GLOTUS_MNEMONIC');
  const phrase = raw.split(/\s+/).join(' ');
  const words = phrase.split(' ');
  if (words.length !== 12 && words.length !== 24) {
    throw new Error(
      `GLOTUS_MNEMONIC must be 12 or 24 words (got ${words.length})`,
    );
  }
  return phrase;
}

export async function loadGlotusGenesisWallet(
  chronik: ChronikClient,
): Promise<Wallet> {
  const wallet = Wallet.fromMnemonic(glotusMnemonicPhrase(), chronik, {
    hd: true,
    accountNumber: GLOTUS_GENESIS_ACCOUNT,
    receiveIndex: 0,
    changeIndex: 0,
  });
  // Prior spends send change to /1/n; a fresh changeIndex=0 misses those UTXOs.
  await wallet.syncAndDiscoverAddresses({ gapLimit: 20 });
  return wallet;
}

async function main(): Promise<void> {
  const chronik = await createChronik('closest');
  const wallet = await loadGlotusGenesisWallet(chronik);
  console.log(
    JSON.stringify(
      {
        role: 'glotus-genesis',
        derivation: `m/44'/1899'/${GLOTUS_GENESIS_ACCOUNT}'/0/0`,
        address: wallet.address,
        balanceSats: wallet.balanceSats.toString(),
        balanceXec: Number(wallet.balanceSats) / 100,
        pkPrefix: `${toHex(wallet.pk).slice(0, 8)}…`,
      },
      null,
      2,
    ),
  );
}

const isDirect =
  process.argv[1]?.includes('glotus-genesis-address') === true;
if (isDirect) {
  main().catch(err => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
