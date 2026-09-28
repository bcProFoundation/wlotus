import { ChronikClient, ConnectionStrategy } from 'chronik-client';
import { MAINNET_CHRONIK_URLS } from './chronikUrls.js';

export type ChronikStrategy = 'closest' | 'ordered';

/**
 * Chronik URLs for this run: `CHRONIK_URLS` env (comma-separated) wins,
 * otherwise the public mainnet fleet. Mirrors the dana-index override.
 */
export function chronikUrlsFromEnv(): string[] {
  const raw = process.env.CHRONIK_URLS?.trim();
  if (raw) return raw.split(',').map(s => s.trim()).filter(Boolean);
  return [...MAINNET_CHRONIK_URLS];
}

/**
 * Build a Chronik client against the public mainnet fleet.
 *
 * `CHRONIK_URLS` (comma-separated) overrides the default fleet — this is
 * the testnet escape hatch: point it at a reachable testnet (ectest)
 * Chronik once one is configured, with no code changes.
 */
export async function createChronik(
  strategy: ChronikStrategy = 'closest',
  urls: readonly string[] = chronikUrlsFromEnv(),
): Promise<ChronikClient> {
  const mode =
    strategy === 'ordered'
      ? ConnectionStrategy.AsOrdered
      : ConnectionStrategy.ClosestFirst;
  return ChronikClient.useStrategy(mode, [...urls]);
}
