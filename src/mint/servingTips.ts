/**
 * Which genesis batons this mint-api process spends.
 * Prod launch: index 0, count 1 (tip 0). Test on the same token: index 27,
 * count 1 (last of 28 batons) so the two desks do not race one UTXO.
 *
 * `MINT_SERVING_TIP_INDEX` is the baton index (0..27), not a slice into the
 * tips array. `MINT_SERVING_TIP_OFFSET` is a deprecated alias for the same env.
 */
import { POW_BATON_COUNT_MAX } from '../params/consensus.js';

const LAST_BATON_INDEX = POW_BATON_COUNT_MAX - 1;

function clampInt(
  n: number,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!Number.isInteger(n)) return fallback;
  if (n < min) return fallback;
  return Math.min(max, n);
}

export function parseServingTipCount(
  raw: string | undefined = process.env.MINT_SERVING_TIP_COUNT,
): number {
  return clampInt(Number(raw?.trim() || 1), 1, POW_BATON_COUNT_MAX, 1);
}

function servingTipIndexEnv(): string | undefined {
  const named = process.env.MINT_SERVING_TIP_INDEX?.trim();
  if (named) return named;
  return process.env.MINT_SERVING_TIP_OFFSET;
}

export function parseServingTipIndex(
  raw: string | undefined = servingTipIndexEnv(),
): number {
  return clampInt(Number(raw?.trim() || 0), 0, LAST_BATON_INDEX, 0);
}

export function selectServingTips<T extends { index: number }>(
  tips: T[],
  opts?: { count?: number; index?: number },
): T[] {
  const start = clampInt(opts?.index ?? 0, 0, LAST_BATON_INDEX, 0);
  const count = clampInt(opts?.count ?? 1, 1, POW_BATON_COUNT_MAX, 1);
  const end = start + count;
  return [...tips]
    .filter(t => t.index >= start && t.index < end)
    .sort((a, b) => a.index - b.index);
}
