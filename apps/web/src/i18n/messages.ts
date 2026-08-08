import type { Locale } from './types.js';

/** Flat UI strings. Use `{name}` placeholders. */
export type MessageKey =
  | 'brand'
  /** Wordmark next to the W logo — omit the leading W (it is in the mark). */
  | 'brandWithLogo'
  | 'tagline'
  | 'offerTitle'
  | 'hintPrayMine'
  | 'hintKeepScreen'
  | 'howTitle'
  | 'howPrayTitle'
  | 'howPrayBody'
  | 'howMintTitle'
  | 'howMintBody'
  | 'howWhyTitle'
  | 'howWhyBody'
  | 'howEternalTitle'
  | 'howEternalBody'
  | 'howEcashTitle'
  | 'howEcashBody'
  | 'etaEstimated'
