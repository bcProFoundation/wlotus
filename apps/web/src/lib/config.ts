/**
 * WLotus web app config.
 * Burn Prayer (ALP); pay fees in XEC. Postage server later.
 */

/** Live dryrun dPRAYER from deployments/mainnet-dryrun-prayer.json */
export const DEFAULT_PRAYER_TOKEN_ID =
  'a108b17f5050e354641c7de26d16d97e6a1019dd0a273e92bc8aced2fff74914';

export const PRAYER_TOKEN_ID =
  (import.meta.env.VITE_PRAYER_TOKEN_ID as string | undefined)?.trim() ||
  DEFAULT_PRAYER_TOKEN_ID;

export const PRAYER_TICKER =
  (import.meta.env.VITE_PRAYER_TICKER as string | undefined)?.trim() || 'dPRAYER';

export const CHRONIK_URLS = (
  (import.meta.env.VITE_CHRONIK_URLS as string | undefined)?.trim() ||
  'https://chronik.e.cash,https://chronik.pay2stay.com/xec,https://xec.paybutton.org'
)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

/** Offering tiers — Prayer atoms (same 1 / 10 / 100 ratios as legacy Lotus offerings). */
export const OFFERINGS = [
  {
    id: 'prayer',
    label: 'Prayer',
    atoms: 1n,
    blurb: 'A single Prayer.',
    icon: '/images/flowers.svg',
  },
  {
    id: 'incense',
    label: 'Incense',
    atoms: 10n,
    blurb: 'Ten Prayers.',
    icon: '/images/incense.svg',
  },
  {
    id: 'candle',
    label: 'Candle',
    atoms: 100n,
    blurb: 'One hundred Prayers.',
    icon: '/images/candle.svg',
  },
] as const;

export type OfferingId = (typeof OFFERINGS)[number]['id'];

/** EMPP memorial lokad (4 ASCII). Beside ALP BURN. */
export const WLBR_LOKAD = new TextEncoder().encode('WLBR');
export const WLBR_VERSION = 1;
