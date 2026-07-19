import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getOrCreateInstallId,
  LOCAL_OFFERS_KEY,
  PRAYER_TICKER,
} from './lib/config.js';
import {
  fetchChallenge,
  fetchStatus,
  shortTx,
  submitMinedOffer,
} from './lib/offerApi.js';
import { mineInWorker } from './lib/mineRunner.js';
import {
  estimatePrayerPow,
  formatActualDuration,
  formatHashrateLabel,
  measureDeviceHashrate,
} from './lib/powEstimate.js';

type Msg = { kind: 'ok' | 'err'; text: string } | null;

type Phase = 'idle' | 'challenge' | 'mining' | 'submit';

interface LocalOffer {
  remintTxid: string;
  burnTxid: string;
  note: string;
  at: string;
  powMs?: number;
  powAttempts?: number;
  hashrateHps?: number;
  bits?: number;
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
  const [phase, setPhase] = useState<Phase>('idle');
  const [msg, setMsg] = useState<Msg>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [maxOffersPerDay, setMaxOffersPerDay] = useState(20);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [baseZeroBits, setBaseZeroBits] = useState<number | null>(null);
  const [deviceHashrateHps, setDeviceHashrateHps] = useState<number | null>(
    null,
  );
  const [mineProgress, setMineProgress] = useState<{
    attempts: number;
    elapsedMs: number;
    hashrateHps: number;
    bits: number;
  } | null>(null);
  const [offers, setOffers] = useState<LocalOffer[]>(() => loadOffers());
  const abortRef = useRef<AbortController | null>(null);

  const busy = phase !== 'idle';
  const powEta = estimatePrayerPow({
    bits: baseZeroBits,
    hashesPerSec: deviceHashrateHps,
  });

  const refreshStatus = useCallback(async () => {
    try {
      const s = await fetchStatus(installId);
      setRemaining(s.remainingToday);
      setTokenId(s.tokenId);
      if (s.maxOffersPerDay > 0) setMaxOffersPerDay(s.maxOffersPerDay);
      if (s.baseZeroBits != null && Number.isFinite(s.baseZeroBits)) {
        setBaseZeroBits(s.baseZeroBits);
      }
    } catch {
      /* API may be down during local UI work */
    }
  }, [installId]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const hps = await measureDeviceHashrate();
        if (!cancelled) setDeviceHashrateHps(hps);
      } catch {
        /* keep phone-class fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function onOffer() {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setMsg(null);
    setMineProgress(null);
    setPhase('challenge');
    try {
      const challenge = await fetchChallenge(installId);
      if (ac.signal.aborted) return;

      setPhase('mining');
      setBaseZeroBits(challenge.bits);
      const mined = await mineInWorker({
        powPrefixHex: challenge.powPrefixHex,
        bits: challenge.bits,
        nonceLength: challenge.nonceLength,
        signal: ac.signal,
        onProgress: p => {
          setMineProgress({
            ...p,
            bits: challenge.bits,
          });
          setDeviceHashrateHps(p.hashrateHps);
        },
      });
      if (ac.signal.aborted) return;

      setMineProgress({
        attempts: mined.attempts,
        elapsedMs: mined.elapsedMs,
        hashrateHps: mined.hashrateHps,
        bits: challenge.bits,
      });
      setDeviceHashrateHps(mined.hashrateHps);

      setPhase('submit');
      const result = await submitMinedOffer({
        installId,
        challengeId: challenge.challengeId,
        nonceHex: mined.nonceHex,
        note: note.trim(),
        powMs: mined.elapsedMs,
        powAttempts: mined.attempts,
      });

      setOffers(
        pushOffer({
          remintTxid: result.remintTxid,
          burnTxid: result.burnTxid,
          note: note.trim(),
          at: new Date().toISOString(),
          powMs: result.powMs || mined.elapsedMs,
          powAttempts: result.powAttempts || mined.attempts,
          hashrateHps: result.hashrateHps || mined.hashrateHps,
          bits: result.bits,
        }),
      );
      setNote('');
      await refreshStatus();
      const powSec = (result.powMs || mined.elapsedMs) / 1000;
      const rate = formatHashrateLabel(
        result.hashrateHps || mined.hashrateHps,
      );
      setMsg({
        kind: 'ok',
        text: [
          `Prayer offered in ${formatActualDuration(powSec)}`,
          rate,
          `Burn ${shortTx(result.burnTxid)}`,
        ]
          .filter(Boolean)
          .join(' · '),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setMsg({
        kind: 'err',
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setPhase('idle');
      setMineProgress(null);
      if (abortRef.current === ac) abortRef.current = null;
    }
  }

  const canOffer = !busy && (remaining === null || remaining > 0);

  const buttonLabel =
    phase === 'challenge'
      ? 'Preparing…'
      : phase === 'mining'
        ? 'Mining on this device…'
        : phase === 'submit'
          ? 'Broadcasting…'
          : 'Offer Prayer';

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
          Mint {PRAYER_TICKER} with this device’s power and burn on-chain for
          memorial and dana. One token is burned; another helps top up fees.
          Limited to {maxOffersPerDay} offerings per day on this device.
        </p>
        <p className="hint eta" aria-live="off">
          {powEta.durationLabel} estimated · {powEta.hashrateLabel}
          {powEta.measured ? ' this device' : ' phone-class'} · bits{' '}
          {powEta.bits} · you mine here; server pays fees
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
            disabled={busy}
          />
        </div>

        <button
          className="btn btn-primary btn-offer"
          disabled={!canOffer}
          onClick={() => void onOffer()}
        >
          {buttonLabel}
        </button>

        {mineProgress ? (
          <p className="mine-progress" aria-live="polite">
            Mining · {formatActualDuration(mineProgress.elapsedMs / 1000)} ·{' '}
            {formatHashrateLabel(mineProgress.hashrateHps)} ·{' '}
            {mineProgress.attempts.toLocaleString()} hashes · bits{' '}
            {mineProgress.bits}
          </p>
        ) : null}

        <p className="meta">
          {remaining === null
            ? 'Connecting…'
            : `${remaining} left today on this device`}
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
                <span>
                  {o.note || 'Prayer'}
                  {o.powMs != null ? (
                    <span className="history-meta">
                      {' '}
                      · {formatActualDuration(o.powMs / 1000)}
                      {o.hashrateHps
                        ? ` · ${formatHashrateLabel(o.hashrateHps)}`
                        : ''}
                    </span>
                  ) : null}
                </span>
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
