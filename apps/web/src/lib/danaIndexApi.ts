/** Client for the DANA memorial index (`/index-api`). */

export interface IndexBurn {
  burnTxid: string;
  tokenId: string;
  note: string;
  offeringId: string;
  version: number;
  parentBurnTxid?: string;
  originalBurnTxid: string;
  blockHeight: number | null;
  blockTimestamp: number | null;
  timeFirstSeen: string;
}

export interface IndexMemorialGroup {
  originalBurnTxid: string;
  originalNote: string;
  latestBurnTxid: string;
  latestNote: string;
  totalBurns: number;
  at: string;
  burns: IndexBurn[];
}

/** Empty = same origin `/index-api` (Vite proxy / nginx). */
export const DANA_INDEX_BASE =
  (import.meta.env.VITE_DANA_INDEX_BASE as string | undefined)?.trim() ||
  '';

function indexUrl(path: string): string {
  const base = DANA_INDEX_BASE.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!base) return `/index-api${p}`;
  return `${base}${p}`;
}

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function fetchIndexRecent(
  limit = 40,
): Promise<IndexMemorialGroup[]> {
  const res = await fetch(indexUrl(`/api/recent?limit=${limit}`));
  const body = await readJson<{
    ok?: boolean;
    items?: IndexMemorialGroup[];
    error?: string;
  }>(res);
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `Index recent ${res.status}`);
  }
  return body.items ?? [];
}

export async function fetchIndexMemorial(
  txid: string,
): Promise<IndexMemorialGroup> {
  const id = txid.trim().toLowerCase();
  const res = await fetch(indexUrl(`/api/memorial/${id}`));
  const body = await readJson<IndexMemorialGroup & { ok?: boolean; error?: string }>(
    res,
  );
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `Index memorial ${res.status}`);
  }
  return body;
}

/** Best-effort: ask index to pull a burn tx now. */
export async function notifyIndexBurn(burnTxid: string): Promise<void> {
  try {
    await fetch(indexUrl('/api/notify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ burnTxid }),
    });
  } catch {
    /* index may be offline */
  }
}
