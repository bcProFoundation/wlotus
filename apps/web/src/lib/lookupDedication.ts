/**
 * Look up a dedication from an on-chain memorial burn via Chronik + DANA EMPP.
 */

import { ChronikClient } from 'chronik-client';
import { memorialFromOutputScriptHex } from './memorialParse.js';
import type { MemorialFields } from '../../../../src/offering/wlbrMemorial.js';

const DEFAULT_CHRONIK_URLS = [
  'https://chronik.e.cash',
  'https://xec.paybutton.org',
  'https://chronik.pay2stay.com/xec',
] as const;

export interface DedicationLookup {
  /** Root dedication burn txid (share / re-offer parent). */
  originalBurnTxid: string;
  /** Resolved memorial note (may be empty → UI fallback). */
  note: string;
  /** Txid that was requested (may be a re-offer tip). */
  lookedUpTxid: string;
  memorial: MemorialFields;
}

function chronikUrls(): string[] {
  const raw = (import.meta.env.VITE_CHRONIK_URLS as string | undefined)?.trim();
  if (raw) {
    const list = raw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (list.length) return list;
  }
  return [...DEFAULT_CHRONIK_URLS];
}

let client: ChronikClient | null = null;

function getChronik(): ChronikClient {
  if (!client) client = new ChronikClient(chronikUrls());
  return client;
}

async function fetchMemorialForTxid(
  chronik: ChronikClient,
  txid: string,
): Promise<MemorialFields> {
  const tx = await chronik.tx(txid);
  for (const out of tx.outputs) {
    const hex = out.outputScript;
    if (!hex || typeof hex !== 'string') continue;
    const memorial = memorialFromOutputScriptHex(hex);
    if (memorial) return memorial;
  }
  throw new Error('No DANA memorial found on this transaction');
}

/**
 * Resolve a burn txid (original or re-offer) to the dedication root + note.
 * Re-offer tips have parentBurnTxid → walk once to the root for the dedication name.
 */
export async function lookupDedication(
  burnTxid: string,
): Promise<DedicationLookup> {
  const lookedUpTxid = burnTxid.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(lookedUpTxid)) {
    throw new Error('Invalid burn transaction id');
  }

  const chronik = getChronik();
  const memorial = await fetchMemorialForTxid(chronik, lookedUpTxid);

  if (memorial.parentBurnTxid) {
    const originalBurnTxid = memorial.parentBurnTxid.toLowerCase();
    const root = await fetchMemorialForTxid(chronik, originalBurnTxid);
    return {
      originalBurnTxid,
      note: root.note.trim(),
      lookedUpTxid,
      memorial: root,
    };
  }

  return {
    originalBurnTxid: lookedUpTxid,
    note: memorial.note.trim(),
    lookedUpTxid,
    memorial,
  };
}
