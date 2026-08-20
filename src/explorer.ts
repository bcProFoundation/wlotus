/**
 * Public Dana explorer (Temple), hosted at danaverse.org.
 *
 * User-facing wLotus links should open here — not explorer.e.cash — so
 * memorial notes are decoded and unrelated chain txs stay hidden.
 */

export const DEFAULT_DANA_EXPLORER_ORIGIN = 'https://danaverse.org';

export function danaExplorerOrigin(origin?: string | null): string {
  const raw = (origin ?? '').trim() || DEFAULT_DANA_EXPLORER_ORIGIN;
  return raw.replace(/\/$/, '');
}

/** `/tx/<txid>` — drop-in for explorer.e.cash tx URLs. */
export function explorerTx(txid: string, origin?: string | null): string {
  return `${danaExplorerOrigin(origin)}/tx/${txid.trim().toLowerCase()}`;
}
