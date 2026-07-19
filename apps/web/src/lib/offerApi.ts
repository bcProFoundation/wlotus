import { MINT_API_BASE } from './config.js';

export interface ChallengeOk {
  ok: true;
  challengeId: string;
  expiresAt: string;
  tokenId: string;
  bits: number;
  commit: 'sha256-preimage';
  nonceLength: number;
  preimageHex: string;
  powPrefixHex: string;
  locktime: number;
  tipLocktime: number;
  mintAtoms: string;
  note: string;
}

export interface OfferOk {
  ok: true;
  remintTxid: string;
  burnTxid: string;
  tokenId: string;
  bits: number;
  powAttempts: number;
  powMs: number;
  hashrateHps: number;
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
  baseZeroBits?: number | null;
  clientPow?: boolean;
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
  if (trimmed.startsWith('<')) {
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

export async function fetchChallenge(opts: {
  installId: string;
  note: string;
}): Promise<ChallengeOk> {
  const res = await fetch(apiUrl('/api/challenge'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      installId: opts.installId,
      note: opts.note,
    }),
  });
  const body = await readApiJson<ChallengeOk & { error?: string; ok?: boolean }>(
    res,
  );
  if (!res.ok || !body.ok) {
    throw new Error(body.error || `Challenge failed (${res.status})`);
  }
  return body as ChallengeOk;
}

export async function submitMinedOffer(opts: {
  installId: string;
  challengeId: string;
  nonceHex: string;
  powMs: number;
  powAttempts: number;
}): Promise<OfferOk> {
  const res = await fetch(apiUrl('/api/submit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      installId: opts.installId,
      challengeId: opts.challengeId,
      nonceHex: opts.nonceHex,
      powMs: opts.powMs,
      powAttempts: opts.powAttempts,
    }),
  });
  const body = await readApiJson<OfferOk & { error?: string; ok?: boolean }>(
    res,
  );
  if (!res.ok || !body.ok) {
    throw new Error(body.error || `Submit failed (${res.status})`);
  }
  return body as OfferOk;
}

export async function cancelOfferChallenge(opts: {
  installId: string;
  challengeId?: string;
}): Promise<{ ok: true; cancelled: number }> {
  const res = await fetch(apiUrl('/api/cancel'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      installId: opts.installId,
      challengeId: opts.challengeId,
    }),
  });
  const body = await readApiJson<{ ok: true; cancelled: number; error?: string }>(
    res,
  );
  if (!res.ok || !body.ok) {
    throw new Error(body.error || `Cancel failed (${res.status})`);
  }
  return body;
}

export function shortTx(txid: string): string {
  return `${txid.slice(0, 8)}…${txid.slice(-6)}`;
}
