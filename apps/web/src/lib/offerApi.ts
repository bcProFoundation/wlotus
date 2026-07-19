import { MINT_API_BASE } from './config.js';

export interface OfferOk {
  ok: true;
  remintTxid: string;
  burnTxid: string;
  tokenId: string;
  bits: number;
  powAttempts: number;
  deskAtomsKept: number;
  explorerRemint: string;
  explorerBurn: string;
}

export interface StatusOk {
  tokenId: string | null;
  mintAtoms: string | null;
  ticker: string;
  maxOffersPerDay: number;
  remainingToday: number | null;
}

function apiUrl(path: string): string {
  const base = MINT_API_BASE.replace(/\/$/, '');
  return `${base}${path}`;
}

export async function fetchStatus(installId: string): Promise<StatusOk> {
  const q = encodeURIComponent(installId);
  const res = await fetch(apiUrl(`/api/status?installId=${q}`));
  const body = (await res.json()) as StatusOk & { error?: string };
  if (!res.ok) throw new Error(body.error || `Status ${res.status}`);
  return body;
}

export async function submitOffer(opts: {
  installId: string;
  note: string;
}): Promise<OfferOk> {
  const res = await fetch(apiUrl('/api/offer'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      installId: opts.installId,
      note: opts.note,
    }),
  });
  const body = (await res.json()) as OfferOk & { error?: string; ok?: boolean };
  if (!res.ok || !body.ok) {
    throw new Error(body.error || `Offer failed (${res.status})`);
  }
  return body as OfferOk;
}

export function shortTx(txid: string): string {
  return `${txid.slice(0, 8)}…${txid.slice(-6)}`;
}
