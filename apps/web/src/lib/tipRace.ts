/**
 * Server/client signals that this challenge’s tip was taken — auto-restart Offer,
 * never surface as a hard error.
 */
export function isTipRaceLost(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  if (/^TIP_RACE_LOST\b/i.test(m)) return true;
  if (/Someone else offered on this tip first/i.test(m)) return true;
  if (/Challenge is expired/i.test(m)) return true;
  if (/Challenge expired/i.test(m)) return true;
  if (/Challenge preimage no longer matches/i.test(m)) return true;
  if (/Unknown challenge/i.test(m)) return true;
  return false;
}

/** Resolve the live tip epoch for the tip we are mining. */
export function liveTipEpochFromStatus(
  status: {
    tipEpoch?: string | null;
    tipEpochs?: Record<string, string>;
  },
  tipIndex: number | undefined,
  tipEpoch: string | null,
): string | null {
  if (tipIndex != null && status.tipEpochs) {
    const keyed = status.tipEpochs[String(tipIndex)];
    if (keyed) return keyed;
  }
  // Fallback only when we have no tipIndex (legacy). Prefer not to use primary
  // tipEpoch when tipIndex is known but missing from tipEpochs — that would
  // false-positive on the other tip reminting.
  if (tipIndex == null) {
    return status.tipEpoch ?? tipEpoch;
  }
  return tipEpoch;
}
