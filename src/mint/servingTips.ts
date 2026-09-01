/**
 * Which genesis batons this mint-api process spends.
 * Prod launch: offset 0, count 1 (tip 0). Test on the same token: offset 27,
 * count 1 (last of 28 batons) so the two desks do not race one UTXO.
 */
export function parseServingTipCount(
  raw: string | undefined = process.env.MINT_SERVING_TIP_COUNT,
): number {
  return Math.max(1, Number(raw?.trim() || 1) || 1);
}

export function parseServingTipOffset(
  raw: string | undefined = process.env.MINT_SERVING_TIP_OFFSET,
): number {
  return Math.max(0, Number(raw?.trim() || 0) || 0);
}

export function selectServingTips<T extends { index: number }>(
  tips: T[],
  opts?: { count?: number; offset?: number },
): T[] {
  const sorted = [...tips].sort((a, b) => a.index - b.index);
  const offset = Math.max(0, opts?.offset ?? 0);
  const count = Math.max(1, opts?.count ?? 1);
  return sorted.slice(offset, offset + count);
}
