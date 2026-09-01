/**
 * Which genesis batons this mint-api process spends.
 * Prod launch: index 0, count 1 (tip 0). Test on the same token: index 27,
 * count 1 (last of 28 batons) so the two desks do not race one UTXO.
 *
 * `MINT_SERVING_TIP_INDEX` is the baton index (0..27), not a slice into the
 * tips array. `MINT_SERVING_TIP_OFFSET` is a deprecated alias for the same env.
 */
export function parseServingTipCount(
  raw: string | undefined = process.env.MINT_SERVING_TIP_COUNT,
): number {
  return Math.max(1, Number(raw?.trim() || 1) || 1);
}

function servingTipIndexEnv(): string | undefined {
  const named = process.env.MINT_SERVING_TIP_INDEX?.trim();
  if (named) return named;
  return process.env.MINT_SERVING_TIP_OFFSET;
}

export function parseServingTipIndex(
  raw: string | undefined = servingTipIndexEnv(),
): number {
  return Math.max(0, Number(raw?.trim() || 0) || 0);
}

export function selectServingTips<T extends { index: number }>(
  tips: T[],
  opts?: { count?: number; index?: number },
): T[] {
  const start = Math.max(0, opts?.index ?? 0);
  const count = Math.max(1, opts?.count ?? 1);
  const wanted = new Set(
    Array.from({ length: count }, (_, i) => start + i),
  );
  return [...tips]
    .filter(t => wanted.has(t.index))
    .sort((a, b) => a.index - b.index);
}
