import {
  DEFAULT_DANA_EXPLORER_ORIGIN,
  explorerTx as explorerTxAt,
} from '../../../../src/explorer.js';

/** Temple (Dana explorer). Override with VITE_DANA_EXPLORER_ORIGIN. */
export const DANA_EXPLORER_ORIGIN =
  (import.meta.env.VITE_DANA_EXPLORER_ORIGIN as string | undefined)?.trim() ||
  DEFAULT_DANA_EXPLORER_ORIGIN;

export function explorerTx(txid: string): string {
  return explorerTxAt(txid, DANA_EXPLORER_ORIGIN);
}
