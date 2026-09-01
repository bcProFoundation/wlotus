import { createPortal } from 'react-dom';
import { useLocale } from '../i18n/LocaleContext.js';
import type { AppTab } from '../lib/calendarMonth.js';

export function TabBar(props: {
  tab: AppTab;
  onTab: (tab: AppTab) => void;
}) {
  const { t } = useLocale();
  const nav = (
    <nav className="glass-nav" aria-label={t('tabHome')}>
      <div className={`glass-nav-shell glass-nav-shell--${props.tab}`}>
        <span className="glass-nav-blob" aria-hidden="true" />
        <button
          type="button"
          className={`glass-nav-btn${props.tab === 'home' ? ' is-active' : ''}`}
          aria-current={props.tab === 'home' ? 'page' : undefined}
          onClick={() => props.onTab('home')}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
              d="M4 11.2 12 4.5l8 6.7V20a1 1 0 0 1-1 1h-5.2v-6.2H10.2V21H5a1 1 0 0 1-1-1z"
            />
          </svg>
          <span>{t('tabHome')}</span>
        </button>
        <button
          type="button"
          className={`glass-nav-btn${props.tab === 'calendar' ? ' is-active' : ''}`}
          aria-current={props.tab === 'calendar' ? 'page' : undefined}
          onClick={() => props.onTab('calendar')}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect
              x="3.5"
              y="5"
              width="17"
              height="15.5"
              rx="2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              d="M3.5 9.5h17M8 3.5v3M16 3.5v3"
            />
          </svg>
          <span>{t('tabCalendar')}</span>
        </button>
      </div>
    </nav>
  );
  /* Body portal: iOS treats position:fixed inside #root as in-flow when a
     descendant uses backdrop-filter. */
  return createPortal(nav, document.body);
}
