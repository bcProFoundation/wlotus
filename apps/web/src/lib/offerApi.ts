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

async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Mint API empty response (${res.status})`);
  }
  if (trimmed.startsWith('<') || trimmed.startsWith('<!')) {
    throw new Error(
      'Mint API not reachable (got HTML). On Contabo: proxy /api → :8787 and start mint-api.',
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      `Mint API returned non-JSON (${res.status}): ${trimmed.slice(0, 120)}`,
    );
  }
}

export async function fetchStatus(installId: string): Promise<StatusOk> {
  const q = encodeURIComponent(installId);
  const res = await fetch(apiUrl(`/api/status?installId=${q}`));
  const body = await readApiJson<StatusOk & { error?: string }>(res);
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
  const body = await readApiJson<OfferOk & { error?: string; ok?: boolean }>(
    res,
  );
  if (!res.ok || !body.ok) {
    throw new Error(body.error || `Offer failed (${res.status})`);
  }
  return body as OfferOk;
}

export function shortTx(txid: string): string {
  return `${txid.slice(0, 8)}…${txid.slice(-6)}`;
}
