/**
 * Soft ownership of altar/profile root burns by installId.
 * Cached on disk for death-date / first-flower gates until a real ownership
 * transaction from the desk exists. installId is a weak bearer — never
 * expose stored ids to clients; only return isCreator for the caller.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const TXID_RE = /^[0-9a-f]{64}$/;

type RootEntry = { installId: string; at: string };
type StoreFile = { version: 1; roots: Record<string, RootEntry> };

function storePath(): string {
  const fromEnv = process.env.MINT_ROOT_CREATORS_PATH?.trim();
  return fromEnv
    ? resolve(fromEnv)
    : resolve(process.cwd(), 'data/root-creators.json');
}

function emptyStore(): StoreFile {
  return { version: 1, roots: {} };
}

function loadStore(): StoreFile {
  const path = storePath();
  if (!existsSync(path)) return emptyStore();
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as StoreFile;
    if (!raw || raw.version !== 1 || typeof raw.roots !== 'object') {
      return emptyStore();
    }
    return { version: 1, roots: raw.roots ?? {} };
  } catch {
    return emptyStore();
  }
}

function saveStore(store: StoreFile): void {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`);
}

function normTxid(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  return TXID_RE.test(t) ? t : null;
}

function normInstallId(raw: string): string {
  return String(raw || '').trim();
}

/** Record the creating device for a root dedication burn (idempotent). */
export function rememberRootCreator(
  rootBurnTxid: string,
  installId: string,
): void {
  const txid = normTxid(rootBurnTxid);
  const id = normInstallId(installId);
  if (!txid || id.length < 8) return;
  const store = loadStore();
  if (store.roots[txid]) return; // first writer wins
  store.roots[txid] = { installId: id, at: new Date().toISOString() };
  saveStore(store);
}

/**
 * Whether this installId created the root.
 * `null` = no record yet (pre-feature roots or other desk).
 */
export function rootCreatorMatch(
  rootBurnTxid: string,
  installId: string,
): boolean | null {
  const txid = normTxid(rootBurnTxid);
  const id = normInstallId(installId);
  if (!txid || id.length < 8) return null;
  const entry = loadStore().roots[txid];
  if (!entry) return null;
  return entry.installId === id;
}

export function isKnownRootCreator(
  rootBurnTxid: string,
  installId: string,
): boolean {
  return rootCreatorMatch(rootBurnTxid, installId) === true;
}
