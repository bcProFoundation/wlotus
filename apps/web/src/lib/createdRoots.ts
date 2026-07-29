/** Local soft cache of root dedications created on this device (installId). */

const CREATED_ROOTS_KEY = 'wlotus.createdRoots';

function loadCreatedRoots(): Set<string> {
  try {
    const raw = localStorage.getItem(CREATED_ROOTS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(
      arr
        .filter((x): x is string => typeof x === 'string')
        .map(x => x.trim().toLowerCase())
        .filter(x => /^[0-9a-f]{64}$/.test(x)),
    );
  } catch {
    return new Set();
  }
}

function saveCreatedRoots(set: Set<string>): void {
  try {
    localStorage.setItem(CREATED_ROOTS_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore quota / private mode */
  }
}

export function markLocalCreatedRoot(rootBurnTxid: string): void {
  const txid = rootBurnTxid.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(txid)) return;
  const set = loadCreatedRoots();
  if (set.has(txid)) return;
  set.add(txid);
  saveCreatedRoots(set);
}

export function isLocalCreatedRoot(rootBurnTxid: string): boolean {
  const txid = rootBurnTxid.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(txid)) return false;
  return loadCreatedRoots().has(txid);
}
