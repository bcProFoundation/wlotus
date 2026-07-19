import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getOrCreateInstallId,
  LOCAL_OFFERS_KEY,
  PRAYER_TICKER,
} from './lib/config.js';
import {
  cancelOfferChallenge,
  fetchChallenge,
  fetchStatus,
  shortTx,
  submitMinedOffer,
} from './lib/offerApi.js';
import { mineInWorker } from './lib/mineRunner.js';
import {
  estimatePrayerPow,
  formatActualDuration,
  formatElapsedTenthsMin,
  formatHashrateLabel,
  measureDeviceHashrate,
} from './lib/powEstimate.js';

type Msg = { kind: 'ok' | 'err'; text: string } | null;

type Phase = 'idle' | 'challenge' | 'mining' | 'submit';

const ACTIVE_CHALLENGE_KEY = 'wlotus.activeChallenge';

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

interface StoredChallenge {
  challengeId: string;
  installId: string;
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

function rememberChallenge(c: StoredChallenge): void {
  try {
    sessionStorage.setItem(ACTIVE_CHALLENGE_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

function clearRememberedChallenge(): void {
  try {
    sessionStorage.removeItem(ACTIVE_CHALLENGE_KEY);
  } catch {
    /* ignore */
  }
}

function readRememberedChallenge(): StoredChallenge | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_CHALLENGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredChallenge;
  } catch {
    return null;
  }
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
  const [mineStartedAt, setMineStartedAt] = useState<number | null>(null);
  const [elapsedDisplay, setElapsedDisplay] = useState('0.0 min');
  const [offers, setOffers] = useState<LocalOffer[]>(() => loadOffers());
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const challengeIdRef = useRef<string | null>(null);

  const busy = phase !== 'idle';
  const mining = phase === 'mining';
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

  /** If the tab was killed mid-mine, release the server challenge on reload. */
  useEffect(() => {
    const stale = readRememberedChallenge();
    if (!stale || stale.installId !== installId) return;
    void cancelOfferChallenge({
      installId,
      challengeId: stale.challengeId,
    })
      .catch(() => undefined)
      .finally(() => clearRememberedChallenge());
  }, [installId]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  /** Tick elapsed every 10s → 0.1, 0.2, … min */
  useEffect(() => {
    if (mineStartedAt == null) {
      setElapsedDisplay('0.0 min');
      return;
    }
    const tick = () => {
      setElapsedDisplay(formatElapsedTenthsMin(Date.now() - mineStartedAt));
    };
    tick();
    const t = setInterval(tick, 10_000);
    return () => clearInterval(t);
  }, [mineStartedAt]);

  async function releaseChallenge(challengeId: string | null): Promise<void> {
    if (!challengeId) return;
    try {
      await cancelOfferChallenge({ installId, challengeId });
    } catch {
      /* best-effort */
    }
    if (challengeIdRef.current === challengeId) challengeIdRef.current = null;
    clearRememberedChallenge();
  }

  function onCancelMine() {
    const id = challengeIdRef.current;
    abortRef.current?.abort();
    void releaseChallenge(id);
    setMineStartedAt(null);
    setPhase('idle');
    setMsg({ kind: 'ok', text: 'Mining cancelled.' });
  }

  async function onOffer() {
    // Kill any in-progress mine before starting a new one.
    const prevId = challengeIdRef.current;
    abortRef.current?.abort();
    if (prevId) await releaseChallenge(prevId);

    const ac = new AbortController();
    abortRef.current = ac;
    challengeIdRef.current = null;

    setMsg(null);
    setMineStartedAt(null);
    setPhase('challenge');
    try {
      const challenge = await fetchChallenge({
        installId,
        note: note.trim(),
      });
      if (ac.signal.aborted) {
        await releaseChallenge(challenge.challengeId);
        return;
      }

      challengeIdRef.current = challenge.challengeId;
      rememberChallenge({
        challengeId: challenge.challengeId,
        installId,
      });

      setPhase('mining');
      setMineStartedAt(Date.now());
      setBaseZeroBits(challenge.bits);
      const mined = await mineInWorker({
        powPrefixHex: challenge.powPrefixHex,
        bits: challenge.bits,
        nonceLength: challenge.nonceLength,
        signal: ac.signal,
        onProgress: p => {
          setDeviceHashrateHps(p.hashrateHps);
        },
      });
      if (ac.signal.aborted) {
        await releaseChallenge(challenge.challengeId);
        return;
      }

      setDeviceHashrateHps(mined.hashrateHps);
      setPhase('submit');
      const result = await submitMinedOffer({
        installId,
        challengeId: challenge.challengeId,
        nonceHex: mined.nonceHex,
        powMs: mined.elapsedMs,
        powAttempts: mined.attempts,
      });

      challengeIdRef.current = null;
      clearRememberedChallenge();

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
      setMsg({
        kind: 'ok',
        text: [
          `Prayer offered in ${formatActualDuration(powSec)}`,
          shortTx(result.remintTxid),
        ].join(' · '),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        await releaseChallenge(challengeIdRef.current);
        return;
      }
      await releaseChallenge(challengeIdRef.current);
      setMsg({
        kind: 'err',
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setPhase('idle');
      setMineStartedAt(null);
      if (abortRef.current === ac) abortRef.current = null;
    }
  }

  const canOffer =
    !busy && apiOnline === true && (remaining === null || remaining > 0);

  const buttonLabel =
    phase === 'challenge'
      ? 'Preparing…'
      : phase === 'mining'
        ? 'Mining…'
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
          Mint {PRAYER_TICKER} with this device’s power — time given for
          memorial and dana. The dedication is written on-chain in the mint.
          Limited to {maxOffersPerDay} offerings per day on this device.
        </p>
        <p className="hint eta" aria-live="off">
          {powEta.durationLabel} estimated
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

        <div className="offer-actions">
          <button
            className="btn btn-primary btn-offer"
            disabled={!canOffer}
            onClick={() => void onOffer()}
          >
            {buttonLabel}
          </button>
          {mining ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={onCancelMine}
            >
              Cancel
            </button>
          ) : null}
        </div>

        {mineStartedAt != null ? (
          <p className="mine-progress" aria-live="polite">
            Mining · {elapsedDisplay}
          </p>
        ) : null}

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
