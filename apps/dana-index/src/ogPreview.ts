/**
 * Open Graph / social preview HTML for dedication share URLs.
 *
 * Messengers scrape this HTML (they do not run the SPA). Locale order:
 * 1. `?lang=` from the shared URL (sender's app locale when they tapped Share)
 * 2. Accept-Language (rarely useful for crawlers)
 * 3. Vietnamese product default (legacy links without ?lang=)
 */

import {
  memorialDisplayName,
  parseAltarNote,
} from '../../../src/offering/altarFields.js';

export type OgLocale = 'vi' | 'en' | 'zh';

const OG_LOCALES: readonly OgLocale[] = ['vi', 'en', 'zh'];

export function parseOgLocale(
  raw: string | null | undefined,
): OgLocale | null {
  if (!raw) return null;
  const primary = raw.trim().toLowerCase().split(/[,;]/)[0]?.trim() ?? '';
  if (primary.startsWith('vi')) return 'vi';
  if (primary.startsWith('zh')) return 'zh';
  if (primary.startsWith('en')) return 'en';
  return null;
}

/** Prefer sender `?lang=`, then Accept-Language, else Vietnamese. */
export function resolveOgLocale(opts: {
  langParam?: string | null;
  acceptLanguage?: string | null;
}): OgLocale {
  return (
    parseOgLocale(opts.langParam) ||
    parseOgLocale(opts.acceptLanguage) ||
    'vi'
  );
}

export function ogCopy(
  locale: OgLocale,
  name: string,
): { title: string; description: string } {
  const n = name.trim();
  if (n) {
    switch (locale) {
      case 'en':
        return {
          title: `In memory of ${n}`,
          description:
            'A white lotus offered in remembrance — recorded forever on eCash.',
        };
      case 'zh':
        return {
          title: `纪念 ${n}`,
          description: '一朵白莲献上追思——永远铭记于 eCash 链上。',
        };
      default:
        return {
          title: `Tưởng nhớ ${n}`,
          description:
            'Một đóa sen trắng dâng lên tưởng niệm — ghi mãi trên chuỗi eCash.',
        };
    }
  }

  switch (locale) {
    case 'en':
      return {
        title: 'White Lotus — Remembrance forever',
        description:
          'Offer an eternal lotus in remembrance of someone who has passed.',
      };
    case 'zh':
      return {
        title: 'White Lotus — 永恒追思',
        description: '献上一朵永恒白莲，追思逝去的亲人。',
      };
    default:
      return {
        title: 'White Lotus — Tưởng niệm vĩnh hằng',
        description:
          'Dâng một đóa sen vĩnh hằng tưởng nhớ người đã khuất.',
      };
  }
}

/** Display name from an on-chain memorial / altar note (empty if none). */
export function ogDisplayNameFromNote(raw: string | null | undefined): string {
  if (!raw) return '';
  return memorialDisplayName(raw).trim();
}

/** Optional short remembrance line for og:description when altar has a note. */
export function ogRemembranceLine(raw: string | null | undefined): string {
  if (!raw) return '';
  const altar = parseAltarNote(raw);
  if (altar) return altar.note.trim();
  // Plain notes double as the display name — skip repeating them in description.
  return '';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildOgHtml(opts: {
  siteOrigin: string;
  pathTxid: string;
  locale: OgLocale;
  /** Raw on-chain note for the dedication root (may be packed altar). */
  originalNote?: string | null;
  imagePath?: string;
}): string {
  const origin = opts.siteOrigin.replace(/\/$/, '');
  const txid = opts.pathTxid.toLowerCase();
  const pageUrl = `${origin}/${txid}`;
  const image = `${origin}${opts.imagePath || '/images/wlotus-icon-512.png'}`;
  const name = ogDisplayNameFromNote(opts.originalNote);
  const copy = ogCopy(opts.locale, name);
  const remembrance = ogRemembranceLine(opts.originalNote);
  const description = remembrance || copy.description;
  const localeTag =
    opts.locale === 'zh' ? 'zh_CN' : opts.locale === 'en' ? 'en_US' : 'vi_VN';
  const alternates = OG_LOCALES.filter(l => l !== opts.locale)
    .map(l => {
      const tag = l === 'zh' ? 'zh_CN' : l === 'en' ? 'en_US' : 'vi_VN';
      return `    <meta property="og:locale:alternate" content="${tag}" />`;
    })
    .join('\n');

  const title = escapeHtml(copy.title);
  const desc = escapeHtml(description);
  const url = escapeHtml(pageUrl);
  const img = escapeHtml(image);

  return `<!doctype html>
<html lang="${opts.locale === 'zh' ? 'zh-Hans' : opts.locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="White Lotus" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:locale" content="${localeTag}" />
${alternates}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${img}" />
  </head>
  <body>
    <p><a href="${url}">${title}</a></p>
  </body>
</html>
`;
}
