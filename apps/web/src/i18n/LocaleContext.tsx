import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { interpolate, MESSAGES, type MessageKey } from './messages.js';
import {
  resolveInitialLocale,
  writeStoredLocale,
} from './detectLocale.js';
import { LOCALE_OPTIONS, type Locale } from './types.js';

type TFunc = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

interface LocaleCtx {
  locale: Locale;
  ready: boolean;
  setLocale: (locale: Locale) => void;
  t: TFunc;
}

const Ctx = createContext<LocaleCtx | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const resolved = await resolveInitialLocale(ac.signal);
        if (!ac.signal.aborted) setLocaleState(resolved);
      } finally {
        if (!ac.signal.aborted) setReady(true);
      }
    })();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    document.documentElement.lang =
      locale === 'zh' ? 'zh-Hans' : locale === 'vi' ? 'vi' : 'en';
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeStoredLocale(next);
  }, []);

  const t = useCallback<TFunc>(
    (key, vars) => interpolate(MESSAGES[locale][key], vars),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, ready, setLocale, t }),
    [locale, ready, setLocale, t],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale(): LocaleCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLocale outside LocaleProvider');
  return ctx;
}

export function useLocaleOptions() {
  return LOCALE_OPTIONS;
}
