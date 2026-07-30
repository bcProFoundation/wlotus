import { useEffect, useRef } from 'react';
import { useLocale } from '../i18n/LocaleContext.js';
import type { SearchResultRow } from '../lib/searchAltars.js';

/** Ranked name search rows — shared by header search and memorial field. */
export function SearchResultsList(props: {
  results: SearchResultRow[];
  listId?: string;
  className?: string;
  rowClassName?: string;
  onSelect: (txid: string) => void;
  /** Reset scroll when query/results change (header search modal). */
  scrollKey?: string;
}) {
  const { t } = useLocale();
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [props.scrollKey, props.results]);

  if (props.results.length === 0) return null;

  const listClass = ['search-results-list', props.className]
    .filter(Boolean)
    .join(' ');

  return (
    <ul
      id={props.listId}
      ref={listRef}
      className={listClass}
      role="listbox"
      aria-label={t('searchTitle')}
    >
      {props.results.map(r => (
        <li key={r.txid}>
          <button
            type="button"
            className={['search-result-row', props.rowClassName]
              .filter(Boolean)
              .join(' ')}
            role="option"
            onMouseDown={e => e.preventDefault()}
            onClick={() => props.onSelect(r.txid)}
          >
            <span className="search-result-name">{r.label}</span>
            <span className="search-result-count">
              {t('burnTotal', { n: r.totalBurns })}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
