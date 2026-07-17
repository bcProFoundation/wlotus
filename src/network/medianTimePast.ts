import type { ChronikClient } from 'chronik-client';

/**
 * Approximate Bitcoin-ABC GetMedianTimePast: median timestamp of the last
 * 11 blocks (tip inclusive). nLockTime (unix) must be ≤ this for finality.
 */
export async function getMedianTimePast(
  chronik: ChronikClient,
): Promise<{ tipHeight: number; tipUnix: number; mtp: number }> {
  const tip = await chronik.blockchainInfo();
  const times: number[] = [];
  const start = Math.max(0, tip.tipHeight - 10);
  for (let h = start; h <= tip.tipHeight; h++) {
    const block = await chronik.block(h);
    times.push(Number(block.blockInfo.timestamp));
  }
  const sorted = [...times].sort((a, b) => a - b);
  const mtp = sorted[Math.floor(sorted.length / 2)]!;
  return {
    tipHeight: tip.tipHeight,
    tipUnix: times[times.length - 1]!,
    mtp,
  };
}
