/**
 * Public Chronik endpoints for eCash mainnet (failover order).
 * Prefer ClosestFirst at runtime; AsOrdered is available for deterministic tests.
 */
export const MAINNET_CHRONIK_URLS = [
  'https://chronik.e.cash',
  'https://xec.paybutton.org',
  'https://chronik.pay2stay.com/xec',
] as const;
