import type { Locale } from './types.js';

const UNITS: Record<
  Locale,
  { min: string; h: string; d: string; s: string; ms: string }
> = {
  en: { min: 'min', h: 'h', d: 'd', s: 's', ms: 'ms' },
  vi: { min: 'phút', h: 'giờ', d: 'ngày', s: 'giây', ms: 'ms' },
  zh: { min: '分钟', h: '小时', d: '天', s: '秒', ms: '毫秒' },
};

export function formatEstimateDurationLocale(
  seconds: number,
  locale: Locale,
): string {
  const u = UNITS[locale];
  if (!Number.isFinite(seconds) || seconds > 1e12) return '—';
  if (seconds < 6) return `~0.1 ${u.min}`;
  if (seconds < 3600) {
    const tenths = Math.max(1, Math.round(seconds / 6));
    return `~${(tenths / 10).toFixed(1)} ${u.min}`;
  }
  if (seconds < 86400) {
    const h = seconds / 3600;
    const rounded = h >= 10 ? Math.round(h) : Math.round(h * 10) / 10;
    return `~${rounded} ${u.h}`;
  }
  return `~${(seconds / 86400).toFixed(1)} ${u.d}`;
}

export function formatActualDurationLocale(
  seconds: number,
  locale: Locale,
): string {
  const u = UNITS[locale];
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 1) return `${Math.round(seconds * 1000)} ${u.ms}`;
  if (seconds < 60) {
    const rounded =
      seconds >= 10 ? Math.round(seconds) : Math.round(seconds * 10) / 10;
    return `${rounded} ${u.s}`;
  }
  if (seconds < 3600) {
    const min = seconds / 60;
    const rounded = min >= 10 ? Math.round(min) : Math.round(min * 10) / 10;
    return `${rounded} ${u.min}`;
  }
  const h = seconds / 3600;
  const rounded = h >= 10 ? Math.round(h) : Math.round(h * 10) / 10;
  return `${rounded} ${u.h}`;
}

const DATE_TAGS: Record<Locale, string> = {
  en: 'en-US',
  vi: 'vi-VN',
  zh: 'zh-CN',
};

/** Local date + time for the home success banner after an offering. */
export function formatOfferedAtLocale(atMs: number, locale: Locale): string {
  if (!Number.isFinite(atMs)) return '—';
  return new Intl.DateTimeFormat(DATE_TAGS[locale], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(atMs));
}

export function formatElapsedTenthsMinLocale(
  elapsedMs: number,
  locale: Locale,
): string {
  const u = UNITS[locale];
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return `0.0 ${u.min}`;
  // 0.1 min = 6s (same unit as estimate/actual) — not 10s.
  const tenths = Math.floor(elapsedMs / 6_000);
  return `${(tenths / 10).toFixed(1)} ${u.min}`;
}
