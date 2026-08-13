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
import {
  effectiveAppearance,
  readStoredAppearance,
  writeStoredAppearance,
  type Appearance,
} from './appearance.js';
import { LOCALE_OPTIONS, type Locale } from './types.js';

type TFunc = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

interface LocaleCtx {
  locale: Locale;
  /** Light or dark; dark skin is black (EN/VI) or rosewood (ZH). */
  appearance: Appearance;
  ready: boolean;
  setLocale: (locale: Locale) => void;
  setAppearance: (appearance: Appearance) => void;
  t: TFunc;
}

const Ctx = createContext<LocaleCtx | null>(null);

function bootLocale(): Locale {
  if (typeof document === 'undefined') return 'en';
  const fromDom = document.documentElement.dataset.locale;
  if (fromDom === 'en' || fromDom === 'vi' || fromDom === 'zh') return fromDom;
  return 'en';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(bootLocale);
  const [appearanceOverride, setAppearanceOverride] = useState<Appearance | null>(
    () => readStoredAppearance(),
  );
  const [ready, setReady] = useState(false);
  const appearance = effectiveAppearance(locale, appearanceOverride);

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
    document.documentElement.dataset.locale = locale;
    document.title = MESSAGES[locale].brand;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeStoredLocale(next);
  }, []);

  const setAppearance = useCallback((next: Appearance) => {
    writeStoredAppearance(next);
    setAppearanceOverride(next);
  }, []);

  const t = useCallback<TFunc>(
    (key, vars) => interpolate(MESSAGES[locale][key], vars),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, appearance, ready, setLocale, setAppearance, t }),
    [locale, appearance, ready, setLocale, setAppearance, t],
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
