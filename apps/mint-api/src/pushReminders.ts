/**
 * Web Push subscriptions + morning giỗ / event reminders.
 *
 * VAPID keys: env VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT,
 * else generated once into data/vapid.json (same durability as root-creators).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import webpush from 'web-push';
import {
  hourInTimeZone,
  memorialOccursOnYmd,
  ymdInTimeZone,
} from '../../../src/lib/memorialDay.js';

const TXID_RE = /^[0-9a-f]{64}$/;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const ENDPOINT_MAX = 2048;

export interface RemindAltar {
  txid: string;
  name: string;
  deathYmd: string;
  kind: 'event' | 'person';
}

interface PushKeys {
  p256dh: string;
  auth: string;
}

interface StoredSub {
  installId: string;
  endpoint: string;
  keys: PushKeys;
  locale: string;
  timeZone: string;
  altars: RemindAltar[];
  /** `${txid}:${ymd}` already delivered. */
  sent: string[];
}

type StoreFile = { version: 1; subscriptions: StoredSub[] };
type VapidFile = { publicKey: string; privateKey: string; subject: string };

function storePath(): string {
  const fromEnv = process.env.MINT_PUSH_STORE_PATH?.trim();
  return fromEnv
    ? resolve(fromEnv)
    : resolve(process.cwd(), 'data/push-subscriptions.json');
}

function vapidPath(): string {
  const fromEnv = process.env.MINT_VAPID_PATH?.trim();
  return fromEnv ? resolve(fromEnv) : resolve(process.cwd(), 'data/vapid.json');
}

function emptyStore(): StoreFile {
  return { version: 1, subscriptions: [] };
}

function loadStore(): StoreFile {
  const path = storePath();
  if (!existsSync(path)) return emptyStore();
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as StoreFile;
    if (!raw || raw.version !== 1 || !Array.isArray(raw.subscriptions)) {
      return emptyStore();
    }
    return { version: 1, subscriptions: raw.subscriptions };
  } catch {
    return emptyStore();
  }
}

function saveStore(store: StoreFile): void {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`);
}

function normLocale(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s.startsWith('en')) return 'en';
  if (s.startsWith('zh')) return 'zh';
  return 'vi';
}

function publicOrigin(): string {
  return (
    process.env.MINT_PUBLIC_ORIGIN?.trim().replace(/\/$/, '') ||
    'https://wlotus.org'
  );
}

function remindHour(): number {
  const n = Number(process.env.MINT_PUSH_REMIND_HOUR?.trim() || '7');
  return Number.isFinite(n) ? Math.min(23, Math.max(0, Math.trunc(n))) : 7;
}

function loadOrCreateVapid(): VapidFile | null {
  const envPub = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPriv = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() || 'mailto:hello@wlotus.org';
  if (envPub && envPriv) {
    return { publicKey: envPub, privateKey: envPriv, subject };
  }
  const path = vapidPath();
  if (existsSync(path)) {
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8')) as VapidFile;
      if (raw?.publicKey && raw?.privateKey) {
        return {
          publicKey: raw.publicKey,
          privateKey: raw.privateKey,
          subject: raw.subject || subject,
        };
      }
    } catch {
      /* regenerate */
    }
  }
  try {
    const keys = webpush.generateVAPIDKeys();
    const created: VapidFile = {
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      subject,
    };
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(created, null, 2)}\n`);
    return created;
  } catch {
    return null;
  }
}

let vapidReady = false;

function ensureVapid(): VapidFile | null {
  const keys = loadOrCreateVapid();
  if (!keys) return null;
  if (!vapidReady) {
    webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
    vapidReady = true;
  }
  return keys;
}

export function vapidPublicKey(): string | null {
  return ensureVapid()?.publicKey ?? null;
}

function parseAltar(raw: unknown): RemindAltar | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const txid = String(o.txid || '').trim().toLowerCase();
  const name = String(o.name || '').trim().slice(0, 80);
  const deathYmd = String(o.deathYmd || '').trim();
  const kind = o.kind === 'event' ? 'event' : 'person';
  if (!TXID_RE.test(txid) || !name || !YMD_RE.test(deathYmd)) return null;
  return { txid, name, deathYmd, kind };
}

export function savePushSubscription(body: {
  installId: string;
  endpoint: string;
  keys: { p256dh?: string; auth?: string };
  locale?: string;
  timeZone?: string;
  altars?: unknown;
}): { ok: true } {
  ensureVapid();
  const endpoint = String(body.endpoint || '').trim();
  if (!/^https:\/\//i.test(endpoint) || endpoint.length > ENDPOINT_MAX) {
    throw new Error('push endpoint required');
  }
  const p256dh = String(body.keys?.p256dh || '').trim();
  const auth = String(body.keys?.auth || '').trim();
  if (!p256dh || !auth) throw new Error('push keys required');
  const installId = String(body.installId || '').trim();
  if (installId.length < 8) throw new Error('installId required (8–128 chars)');
  const altars = (Array.isArray(body.altars) ? body.altars : [])
    .map(parseAltar)
    .filter((a): a is RemindAltar => a != null)
    .slice(0, 40);
  const timeZone = String(body.timeZone || 'Asia/Ho_Chi_Minh').trim().slice(0, 64)
    || 'Asia/Ho_Chi_Minh';
  const locale = normLocale(String(body.locale || 'vi'));
  const store = loadStore();
  const existing = store.subscriptions.find(s => s.endpoint === endpoint);
  const row: StoredSub = {
    installId,
    endpoint,
    keys: { p256dh, auth },
    locale,
    timeZone,
    altars,
    sent: existing?.sent ?? [],
  };
  store.subscriptions = [
    ...store.subscriptions.filter(s => s.endpoint !== endpoint),
    row,
  ];
  saveStore(store);
  return { ok: true };
}

export function deletePushSubscription(endpoint: string): { ok: true } {
  const ep = String(endpoint || '').trim();
  if (!ep) throw new Error('push endpoint required');
  const store = loadStore();
  store.subscriptions = store.subscriptions.filter(s => s.endpoint !== ep);
  saveStore(store);
  return { ok: true };
}

export interface DueReminder {
  txid: string;
  name: string;
  kind: 'event' | 'person';
  ymd: string;
}

export function dueRemindersForSub(
  sub: {
    altars: RemindAltar[];
    locale: string;
    timeZone: string;
    sent?: string[];
  },
  now: Date,
  hour = remindHour(),
): DueReminder[] {
  if (hourInTimeZone(now, sub.timeZone) !== hour) return [];
  const ymd = ymdInTimeZone(now, sub.timeZone);
  const sent = new Set(sub.sent ?? []);
  const out: DueReminder[] = [];
  const seen = new Set<string>();
  for (const altar of sub.altars) {
    if (seen.has(altar.txid)) continue;
    if (!memorialOccursOnYmd(altar.deathYmd, ymd, sub.locale)) continue;
    const key = `${altar.txid}:${ymd}`;
    if (sent.has(key)) continue;
    seen.add(altar.txid);
    out.push({
      txid: altar.txid,
      name: altar.name,
      kind: altar.kind,
      ymd,
    });
  }
  return out;
}

function copyForLocale(
  locale: string,
  item: DueReminder,
): { title: string; body: string } {
  const name = item.name;
  if (locale.startsWith('en')) {
    return {
      title: name,
      body:
        item.kind === 'event'
          ? `Today is ${name}.`
          : `Today is ${name}'s memorial day.`,
    };
  }
  if (locale.startsWith('zh')) {
    return {
      title: name,
      body: item.kind === 'event' ? `今天是${name}。` : `今天是${name}的忌日。`,
    };
  }
  return {
    title: name,
    body:
      item.kind === 'event' ? `Hôm nay là ${name}.` : `Hôm nay là ngày giỗ của ${name}.`,
  };
}

function pruneSent(sent: string[], ymd: string): string[] {
  const year = ymd.slice(0, 4);
  const prev = String(Number(year) - 1);
  return sent.filter(k => k.endsWith(`:${ymd}`) || k.includes(`:${year}`) || k.includes(`:${prev}`));
}

async function sendOne(sub: StoredSub, item: DueReminder): Promise<boolean> {
  const { title, body } = copyForLocale(sub.locale, item);
  const origin = publicOrigin();
  const payload = JSON.stringify({
    title,
    body,
    url: `${origin}/${item.txid}`,
    tag: `memorial:${item.txid}:${item.ymd}`,
  });
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: sub.keys,
      },
      payload,
      { TTL: 12 * 60 * 60 },
    );
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      deletePushSubscription(sub.endpoint);
    }
    return false;
  }
}

export async function dispatchMorningReminders(now = new Date()): Promise<number> {
  if (!ensureVapid()) return 0;
  const store = loadStore();
  let sentCount = 0;
  for (const sub of store.subscriptions) {
    const due = dueRemindersForSub(sub, now);
    if (!due.length) continue;
    let changed = false;
    for (const item of due) {
      const ok = await sendOne(sub, item);
      if (!ok) continue;
      sentCount += 1;
      const key = `${item.txid}:${item.ymd}`;
      sub.sent = pruneSent([...(sub.sent || []), key], item.ymd);
      changed = true;
    }
    if (changed) {
      const next = loadStore();
      const idx = next.subscriptions.findIndex(s => s.endpoint === sub.endpoint);
      if (idx >= 0) next.subscriptions[idx] = sub;
      saveStore(next);
    }
  }
  return sentCount;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startMorningReminderLoop(): void {
  if (timer) return;
  ensureVapid();
  const tickMs = Number(process.env.MINT_PUSH_TICK_MS?.trim() || 15 * 60 * 1000);
  const ms = Number.isFinite(tickMs) ? Math.max(60_000, tickMs) : 15 * 60 * 1000;
  void dispatchMorningReminders().catch(() => {
    /* first tick */
  });
  timer = setInterval(() => {
    void dispatchMorningReminders().catch(err => {
      console.warn('push reminders:', err instanceof Error ? err.message : err);
    });
  }, ms);
  timer.unref?.();
}
