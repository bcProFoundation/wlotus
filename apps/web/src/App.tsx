import { useCallback, useEffect, useState } from 'react';
import {
  getOrCreateInstallId,
  LOCAL_OFFERS_KEY,
  PRAYER_TICKER,
} from './lib/config.js';
import {
  fetchStatus,
  shortTx,
  submitOffer,
  type OfferOk,
} from './lib/offerApi.js';

type Msg = { kind: 'ok' | 'err'; text: string } | null;

interface LocalOffer {
  remintTxid: string;
  burnTxid: string;
  note: string;
  at: string;
}

function loadOffers(): LocalOffer[] {
  try {
    const raw = localStorage.getItem(LOCAL_OFFERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalOffer[];
  } catch {
    return [];
  }
}

function pushOffer(o: LocalOffer): LocalOffer[] {
  const next = [o, ...loadOffers()].slice(0, 40);
  localStorage.setItem(LOCAL_OFFERS_KEY, JSON.stringify(next));
  return next;
}

export default function App() {
  const [installId] = useState(() => getOrCreateInstallId());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [offers, setOffers] = useState<LocalOffer[]>(() => loadOffers());

  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await fetchStatus(installId);
      setRemaining(s.remainingToday);
      setTokenId(s.tokenId);
      setApiOnline(true);
    } catch {
      setApiOnline(false);
      setRemaining(null);
    }
  }, [installId]);

  useEffect(() => {
    void refreshStatus();
    const t = setInterval(() => void refreshStatus(), 15_000);
    return () => clearInterval(t);
  }, [refreshStatus]);

  async function onOffer() {
    setBusy(true);
    setMsg(null);
    try {
      const result: OfferOk = await submitOffer({
        installId,
        note: note.trim(),
      });
      setOffers(
        pushOffer({
          remintTxid: result.remintTxid,
          burnTxid: result.burnTxid,
          note: note.trim(),
          at: new Date().toISOString(),
        }),
      );
      setNote('');
      await refreshStatus();
      setMsg({
        kind: 'ok',
        text: `Prayer offered. Burn ${shortTx(result.burnTxid)}`,
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

  const canOffer =
    !busy && apiOnline === true && (remaining === null || remaining > 0);

  return (
    <div className="app">
      <header className="hero">
        <div className="brand-row">
          <img
            className="brand-mark"
            src="/images/wlotus.png"
            alt=""
            width={56}
            height={56}
          />
          <h1 className="brand">White Lotus</h1>
        </div>
        <p className="tagline">
          Offer a white lotus. Remember someone. Give something up for all.
        </p>
      </header>

      <section className="panel offer-panel">
        <h2>Prayer</h2>
        <p className="hint">
          One {PRAYER_TICKER} is burned on-chain (memorial + dana). Dual mint:
          the other atom stays with White Lotus for vault top-up. Limited to 2
          offerings per day on this device.
        </p>

        <div className="field">
          <label htmlFor="note">In memory of… (optional)</label>
          <textarea
            id="note"
            rows={2}
            maxLength={80}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Name or dedication"
            disabled={busy || apiOnline === false}
          />
        </div>

        <button
          className="btn btn-primary btn-offer"
          disabled={!canOffer}
          onClick={() => void onOffer()}
        >
          {busy ? 'Offering…' : 'Offer Prayer'}
        </button>

        <p className="meta">
          {apiOnline === null
            ? 'Connecting…'
            : apiOnline === false
              ? 'Mint API offline — start mint-api on Contabo and proxy /api → :8787'
              : `${remaining ?? '—'} left today on this device`}
          {tokenId ? (
            <>
              {' · '}
              <a
                href={`https://explorer.e.cash/tx/${tokenId}`}
                target="_blank"
                rel="noreferrer"
              >
                {shortTx(tokenId)}
              </a>
            </>
          ) : null}
        </p>

        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
      </section>

      {offers.length > 0 ? (
        <section className="panel">
          <h2>Recent</h2>
          <ul className="history">
            {offers.map(o => (
              <li key={o.burnTxid}>
                <span>{o.note || 'Prayer'}</span>
                <a
                  href={`https://explorer.e.cash/tx/${o.burnTxid}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortTx(o.burnTxid)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="footer">
        White Lotus · Prayer ·{' '}
        <a href="https://github.com/bcProFoundation/wlotus">wlotus</a>
      </footer>
    </div>
  );
}
