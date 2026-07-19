import { ChronikClient, ConnectionStrategy } from 'chronik-client';
import { Wallet } from 'ecash-wallet';
import { fromHex, toHex } from 'ecash-lib';
import { CHRONIK_URLS } from './config.js';

const SK_STORAGE_KEY = 'wlotus.web.skHex';

export async function createChronik(): Promise<ChronikClient> {
  return ChronikClient.useStrategy(
    ConnectionStrategy.ClosestFirst,
    [...CHRONIK_URLS],
  );
}

export function loadStoredSkHex(): string | null {
  try {
    const v = localStorage.getItem(SK_STORAGE_KEY)?.trim() ?? '';
    return /^[0-9a-fA-F]{64}$/.test(v) ? v.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function storeSkHex(skHex: string): void {
  localStorage.setItem(SK_STORAGE_KEY, skHex.toLowerCase());
}

export function clearStoredSk(): void {
  localStorage.removeItem(SK_STORAGE_KEY);
}

export function randomSkHex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toHex(bytes);
}

export async function walletFromSkHex(
  skHex: string,
  chronik: ChronikClient,
): Promise<Wallet> {
  if (!/^[0-9a-fA-F]{64}$/.test(skHex.trim())) {
    throw new Error('Secret key must be 64 hex characters');
  }
  const wallet = Wallet.fromSk(fromHex(skHex.trim()), chronik);
  await wallet.sync();
  return wallet;
}

export function prayerAtoms(wallet: Wallet, tokenId: string): bigint {
  let total = 0n;
  for (const u of wallet.utxos) {
    if (u.token?.tokenId === tokenId && !u.token.isMintBaton) {
      total += BigInt(u.token.atoms);
    }
  }
  return total;
}

export function xecSats(wallet: Wallet): bigint {
  let total = 0n;
  for (const u of wallet.utxos) {
    if (!u.token) total += BigInt(u.sats);
  }
  return total;
}
