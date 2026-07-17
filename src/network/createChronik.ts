import { ChronikClient, ConnectionStrategy } from 'chronik-client';
import { MAINNET_CHRONIK_URLS } from './chronikUrls.js';

export type ChronikStrategy = 'closest' | 'ordered';

/**
 * Build a Chronik client against the public mainnet fleet.
 */
export async function createChronik(
  strategy: ChronikStrategy = 'closest',
  urls: readonly string[] = MAINNET_CHRONIK_URLS,
): Promise<ChronikClient> {
  const mode =
    strategy === 'ordered'
      ? ConnectionStrategy.AsOrdered
      : ConnectionStrategy.ClosestFirst;
  return ChronikClient.useStrategy(mode, [...urls]);
}
