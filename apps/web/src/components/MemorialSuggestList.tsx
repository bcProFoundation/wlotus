import { useLocale } from '../i18n/LocaleContext.js';
import type { SearchResultRow } from '../lib/searchAltars.js';
import { SearchResultsList } from './SearchResultsList.js';

/** Inline name suggestions above the main memorial field (drop-up). */
export function MemorialSuggestList(props: {
  results: SearchResultRow[];
  loading: boolean;
  onSelect: (txid: string) => void;
}) {
  const { t } = useLocale();
  if (!props.loading && props.results.length === 0) return null;

  return (
    <div className="note-suggest" aria-live="polite">
      {props.loading && props.results.length === 0 ? (
        <p className="hint note-suggest-status">{t('searchLoading')}</p>
      ) : null}
      <SearchResultsList
        listId="note-suggest-list"
        results={props.results}
        className="note-suggest-list"
        rowClassName="note-suggest-row"
        onSelect={props.onSelect}
      />
    </div>
  );
}
