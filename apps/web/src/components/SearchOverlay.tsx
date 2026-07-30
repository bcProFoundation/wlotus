import { useEffect, useRef } from 'react';
import { useLocale } from '../i18n/LocaleContext.js';
import type { SearchResultRow } from '../lib/searchAltars.js';
import { SearchResultsList } from './SearchResultsList.js';

/** Search by name across White Lotus — ordered by relevance then offering score. */
export function SearchOverlay(props: {
  query: string;
  onQueryChange: (value: string) => void;
  results: SearchResultRow[];
  loading: boolean;
  error: string;
  onSelect: (txid: string) => void;
  /** Open Ban thờ / hồ sơ setup (Thêm). */
  onAdd?: () => void;
  addDisabled?: boolean;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const hasQuery = props.query.trim().length > 0;
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cardRef.current?.scrollTo({ top: 0 });
  }, [props.query, props.results, props.loading]);

  return (
    <div
      className="offer-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-overlay-title"
    >
      <div className="offer-modal-card offer-modal-card--search" ref={cardRef}>
        <button
          type="button"
          className="offer-modal-close"
          aria-label={t('btnClose')}
          onClick={props.onClose}
        >
          ×
        </button>
        <div className="field-label-row search-overlay-title-row">
          <h2 id="search-overlay-title">{t('searchTitle')}</h2>
          {props.onAdd ? (
            <button
              type="button"
              className="link-more"
              disabled={props.addDisabled}
              onClick={props.onAdd}
            >
              {t('btnAltarMore')}
            </button>
          ) : null}
        </div>
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

        <SearchResultsList
          results={props.results}
          scrollKey={props.query}
          onSelect={props.onSelect}
        />
      </div>
    </div>
  );
}
