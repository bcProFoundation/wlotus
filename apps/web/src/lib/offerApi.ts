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

export async function fetchStatus(installId: string): Promise<StatusOk> {
  const q = encodeURIComponent(installId);
  const res = await fetch(apiUrl(`/api/status?installId=${q}`));
  const body = (await res.json()) as StatusOk & { error?: string };
  if (!res.ok) throw new Error(body.error || `Status ${res.status}`);
  return body;
}

export async function fetchChallenge(installId: string): Promise<ChallengeOk> {
  const res = await fetch(apiUrl('/api/challenge'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ installId }),
  });
  const body = (await res.json()) as ChallengeOk & { error?: string; ok?: boolean };
  if (!res.ok || !body.ok) {
    throw new Error(body.error || `Challenge failed (${res.status})`);
  }
  return body as ChallengeOk;
}

export async function submitMinedOffer(opts: {
  installId: string;
  challengeId: string;
  nonceHex: string;
  note: string;
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
      note: opts.note,
      powMs: opts.powMs,
      powAttempts: opts.powAttempts,
    }),
  });
  const body = (await res.json()) as OfferOk & { error?: string; ok?: boolean };
  if (!res.ok || !body.ok) {
    throw new Error(body.error || `Submit failed (${res.status})`);
  }
  return body as OfferOk;
}

export function shortTx(txid: string): string {
  return `${txid.slice(0, 8)}…${txid.slice(-6)}`;
}
