import { useLocale } from '../i18n/LocaleContext.js';
import type { SearchResultRow } from '../lib/searchAltars.js';

/** Search by name across White Lotus — ordered by relevance then offering score. */
export function SearchOverlay(props: {
  query: string;
  onQueryChange: (value: string) => void;
  results: SearchResultRow[];
  loading: boolean;
  error: string;
  onSelect: (txid: string) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const hasQuery = props.query.trim().length > 0;

  return (
    <div
      className="offer-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-overlay-title"
    >
      <div className="offer-modal-card">
        <button
          type="button"
          className="offer-modal-close"
          aria-label={t('btnClose')}
          onClick={props.onClose}
        >
          ×
        </button>
        <h2 id="search-overlay-title">{t('searchTitle')}</h2>
        <div className="field">
          <input
            type="search"
            autoFocus
            value={props.query}
            onChange={e => props.onQueryChange(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchTitle')}
          />
        </div>

        {!hasQuery ? <p className="hint">{t('searchHint')}</p> : null}
        {props.loading ? <p className="hint">{t('searchLoading')}</p> : null}
        {props.error ? <div className="msg hint-inline">{props.error}</div> : null}
        {hasQuery && !props.loading && props.results.length === 0 ? (
          <p className="hint">{t('searchNoResults')}</p>
        ) : null}

        {props.results.length > 0 ? (
          <ul className="search-results-list">
            {props.results.map(r => (
              <li key={r.txid}>
                <button
                  type="button"
                  className="search-result-row"
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
        ) : null}
      </div>
    </div>
  );
}
