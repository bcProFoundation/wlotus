import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Wallet } from 'ecash-wallet';
import {
  OFFERINGS,
  PRAYER_TICKER,
  PRAYER_TOKEN_ID,
  type OfferingId,
} from './lib/config.js';
import {
  burnPrayerOffering,
  explorerTx,
  shortTx,
} from './lib/burn.js';
import {
  clearStoredSk,
  createChronik,
  loadStoredSkHex,
  prayerAtoms,
  randomSkHex,
  storeSkHex,
  walletFromSkHex,
  xecSats,
} from './lib/wallet.js';

type Msg = { kind: 'ok' | 'err'; text: string } | null;

interface LocalBurn {
  txid: string;
  offeringId: OfferingId;
  atoms: string;
  at: string;
}

const LOCAL_BURNS_KEY = 'wlotus.web.burns';

function loadLocalBurns(): LocalBurn[] {
  try {
    const raw = localStorage.getItem(LOCAL_BURNS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalBurn[];
  } catch {
    return [];
  }
}

function pushLocalBurn(b: LocalBurn): LocalBurn[] {
  const next = [b, ...loadLocalBurns()].slice(0, 40);
  localStorage.setItem(LOCAL_BURNS_KEY, JSON.stringify(next));
  return next;
}

export default function App() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [skInput, setSkInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [selected, setSelected] = useState<OfferingId>('prayer');
  const [note, setNote] = useState('');
  const [burns, setBurns] = useState<LocalBurn[]>(() => loadLocalBurns());
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    await wallet.sync();
    setTick(t => t + 1);
  }, [wallet]);

  useEffect(() => {
    const sk = loadStoredSkHex();
    if (!sk) return;
    let cancelled = false;
    (async () => {
      try {
        setBusy(true);
        const chronik = await createChronik();
        const w = await walletFromSkHex(sk, chronik);
        if (!cancelled) {
          setWallet(w);
          setMsg({
            kind: 'ok',
            text: 'Wallet restored from this browser.',
          });
        }
      } catch (e) {
        if (!cancelled) {
          clearStoredSk();
          setMsg({
            kind: 'err',
            text: e instanceof Error ? e.message : String(e),
          });
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const xec = useMemo(
    () => (wallet ? Number(xecSats(wallet)) / 100 : 0),
    [wallet, tick],
  );
  const prayer = useMemo(
    () => (wallet ? prayerAtoms(wallet, PRAYER_TOKEN_ID) : 0n),
    [wallet, tick],
  );

  async function unlock(skHex: string) {
    setBusy(true);
    setMsg(null);
    try {
      const chronik = await createChronik();
      const w = await walletFromSkHex(skHex, chronik);
      storeSkHex(skHex);
      setWallet(w);
      setSkInput('');
      setMsg({ kind: 'ok', text: `Ready — ${w.address}` });
    } catch (e) {
      setMsg({
        kind: 'err',
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function onCreate() {
    const sk = randomSkHex();
    await unlock(sk);
    setMsg({
      kind: 'ok',
      text: `New wallet created. Fund it with XEC (fees) and ${PRAYER_TICKER}, then offer. Secret key is stored in this browser only.`,
    });
  }

  function onLock() {
    clearStoredSk();
    setWallet(null);
    setMsg({ kind: 'ok', text: 'Wallet locked on this device.' });
  }

  async function onOffer() {
    if (!wallet) return;
    setBusy(true);
    setMsg(null);
    try {
      const offering = OFFERINGS.find(o => o.id === selected)!;
      if (prayer < offering.atoms) {
        throw new Error(
          `Need ${offering.atoms} ${PRAYER_TICKER}; you have ${prayer}`,
        );
      }
      if (xecSats(wallet) < 2000n) {
        throw new Error('Need a little XEC for the network fee (postage later).');
      }
      const { txids } = await burnPrayerOffering({
        wallet,
        offeringId: selected,
        note,
      });
      const txid = txids[0]!;
      setBurns(
        pushLocalBurn({
          txid,
          offeringId: selected,
          atoms: offering.atoms.toString(),
          at: new Date().toISOString(),
        }),
      );
      setNote('');
      await refresh();
      setMsg({
        kind: 'ok',
        text: `Offered ${offering.atoms} ${PRAYER_TICKER}. ${shortTx(txid)}`,
      });
    } catch (e) {
      setMsg({
        kind: 'err',
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="brand-row">
          <img
            className="brand-mark"
            src="/images/white-lotus.svg"
            alt=""
            width={56}
            height={46}
          />
          <h1 className="brand">White Lotus</h1>
        </div>
        <p className="tagline">
          Offer a white lotus. Remember someone. Give something up for all.
          Prayer burns on eCash; fees in XEC for now.
        </p>
      </header>

      <section className="panel">
        <h2>Wallet</h2>
        {!wallet ? (
          <>
            <p className="hint">
              Create a browser wallet or paste a 32-byte secret key (hex). Keep a
              backup — we do not hold keys for you.
            </p>
            <div className="field">
              <label htmlFor="sk">Secret key (64 hex)</label>
              <input
                id="sk"
                value={skInput}
                onChange={e => setSkInput(e.target.value.trim())}
                placeholder="optional — leave blank to create new"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="row">
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  skInput ? void unlock(skInput) : void onCreate()
                }
              >
                {skInput ? 'Unlock' : 'Create wallet'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="balances">
              <div className="stat">
                <span className="label">XEC (fees)</span>
                <div className="value">{xec.toFixed(2)}</div>
              </div>
              <div className="stat">
                <span className="label">{PRAYER_TICKER}</span>
                <div className="value">{prayer.toString()}</div>
              </div>
            </div>
            <p className="addr">{wallet.address}</p>
            <div className="row" style={{ marginTop: '0.85rem' }}>
              <button className="btn" disabled={busy} onClick={() => void refresh()}>
                Refresh
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={onLock}>
                Lock
              </button>
            </div>
            <p className="hint">
              Token{' '}
              <a
                href={`https://explorer.e.cash/tx/${PRAYER_TOKEN_ID}`}
                target="_blank"
                rel="noreferrer"
              >
                {shortTx(PRAYER_TOKEN_ID)}
              </a>
            </p>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Offer</h2>
        <p className="hint">
          Choose an amount of {PRAYER_TICKER} to burn. Same 1 / 10 / 100 steps as
          the old Lotus offerings — settled as ALP burn, not native coin.
        </p>
        <div className="offer-grid">
          {OFFERINGS.map(o => (
            <button
              key={o.id}
              type="button"
              className={`offer${selected === o.id ? ' selected' : ''}`}
              onClick={() => setSelected(o.id)}
              disabled={!wallet || busy}
            >
              <img src={o.icon} alt="" />
              <p className="name">{o.label}</p>
              <p className="atoms">
                {o.atoms.toString()} {PRAYER_TICKER}
              </p>
              <p className="blurb">{o.blurb}</p>
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="note">Note (optional, on-chain memorial)</label>
          <textarea
            id="note"
            rows={2}
            maxLength={80}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="In memory of…"
            disabled={!wallet || busy}
          />
        </div>
        <button
          className="btn btn-primary"
          disabled={!wallet || busy}
          onClick={() => void onOffer()}
        >
          {busy ? 'Working…' : `Burn ${OFFERINGS.find(o => o.id === selected)?.atoms} ${PRAYER_TICKER}`}
        </button>
        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
      </section>

      <section className="panel">
        <h2>Recent offerings (this device)</h2>
        {burns.length === 0 ? (
          <p className="hint">No local burns yet.</p>
        ) : (
          <ul className="history">
            {burns.map(b => (
              <li key={b.txid}>
                <span>
                  {b.atoms} · {b.offeringId}
                </span>
                <a href={explorerTx(b.txid)} target="_blank" rel="noreferrer">
                  {shortTx(b.txid)}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="footer">
        White Lotus · Prayer ALP burn · XEC fees ·{' '}
        <a href="https://github.com/bcProFoundation/wlotus">wlotus</a>
      </footer>
    </div>
  );
}
