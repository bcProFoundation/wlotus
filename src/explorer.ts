/**
 * Public Dana explorer (Temple), hosted at danaverse.org.
 *
 * User-facing wLotus links should open here — not explorer.e.cash — so
 * memorial notes are decoded and unrelated chain txs stay hidden.
 * Pass the app locale as the third argument so Temple opens in that language
 * (`?lang=vi|en|zh`, same query W Lotus already uses on share URLs).
 */

export const DEFAULT_DANA_EXPLORER_ORIGIN = 'https://danaverse.org';

export function danaExplorerOrigin(origin?: string | null): string {
  const raw = (origin ?? '').trim() || DEFAULT_DANA_EXPLORER_ORIGIN;
  return raw.replace(/\/$/, '');
}

/** `/offering/<id>` — Temple ledger word, not a blockchain `/tx/` URL. */
export function explorerLang(
  raw?: string | null,
): 'en' | 'vi' | 'zh' | null {
  if (!raw) return null;
  const primary = raw.trim().toLowerCase().split(/[,;_-]/)[0]?.trim() ?? '';
  if (primary === 'vi' || primary === 'zh' || primary === 'en') return primary;
  return null;
}

export function explorerTx(
  txid: string,
  origin?: string | null,
  lang?: string | null,
): string {
  const path = `${danaExplorerOrigin(origin)}/offering/${txid.trim().toLowerCase()}`;
  const locale = explorerLang(lang);
  return locale ? `${path}?lang=${locale}` : path;
}
