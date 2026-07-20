import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getOrCreateInstallId,
  LOCAL_OFFERS_KEY,
  PRAYER_TICKER,
  TIP_POLL_MS,
} from './lib/config.js';
import {
  cancelOfferChallenge,
  fetchChallenge,
  fetchStatus,
  shortTx,
  submitMinedOffer,
} from './lib/offerApi.js';
import { mineInWorker } from './lib/mineRunner.js';
import { MineElapsedClock } from './lib/mineElapsedClock.js';
import {
  isTipRaceLost,
  liveTipEpochFromStatus,
} from './lib/tipRace.js';
import {
  estimatePrayerPow,
  formatActualDuration,
  formatElapsedTenthsMin,
  formatHashrateLabel,
  loadCachedHashrate,
  measureDeviceHashrate,
  saveCachedHashrate,
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

/** Prefer explicit cache, else last successful mine hashrate from history. */
function initialHashrateHps(): number | null {
  const cached = loadCachedHashrate();
  if (cached != null) return cached;
  for (const o of loadOffers()) {
    if (o.hashrateHps != null && o.hashrateHps > 0) {
      saveCachedHashrate(o.hashrateHps);
      return Math.round(o.hashrateHps);
    }
  }
  return null;
}

function rememberHashrate(hps: number): void {
  if (!Number.isFinite(hps) || hps <= 0) return;
  saveCachedHashrate(hps);
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
  const [ticker, setTicker] = useState(PRAYER_TICKER);
  const [baseZeroBits, setBaseZeroBits] = useState<number | null>(null);
  const [deviceHashrateHps, setDeviceHashrateHps] = useState<number | null>(
    () => initialHashrateHps(),
  );
  const [mineStartedAt, setMineStartedAt] = useState<number | null>(null);
  const [elapsedDisplay, setElapsedDisplay] = useState('0.0 min');
  const [offers, setOffers] = useState<LocalOffer[]>(() => loadOffers());
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const challengeIdRef = useRef<string | null>(null);
  /** Bumps on cancel / new offer so a stale offer's finally cannot clobber UI. */
  const offerGenRef = useRef(0);
  /** Active elapsed (pauses when tab/app hidden; survives tip retries). */
  const elapsedClockRef = useRef(new MineElapsedClock());
  const tipMsgClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashTipMsg = useCallback((text: string) => {
    if (tipMsgClearRef.current != null) {
      clearTimeout(tipMsgClearRef.current);
      tipMsgClearRef.current = null;
    }
    setMsg({ kind: 'ok', text });
    tipMsgClearRef.current = setTimeout(() => {
      tipMsgClearRef.current = null;
      setMsg(m => (m?.kind === 'ok' && m.text === text ? null : m));
    }, 2200);
  }, []);

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
      if (s.ticker?.trim()) setTicker(s.ticker.trim());
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

  /** Probe once if we have no cached rate; otherwise reuse localStorage. */
  useEffect(() => {
    if (deviceHashrateHps != null && deviceHashrateHps > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const hps = await measureDeviceHashrate();
        if (cancelled) return;
        rememberHashrate(hps);
        setDeviceHashrateHps(hps);
      } catch {
        /* keep phone-class fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceHashrateHps]);

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

  /**
   * Tick elapsed from the active clock (pauses while document.hidden).
   * Tip retries do not reset the clock — only a new Offer does.
   */
  useEffect(() => {
    if (mineStartedAt == null) {
      setElapsedDisplay('0.0 min');
      return;
    }
    const clock = elapsedClockRef.current;
    const tick = () => {
      setElapsedDisplay(formatElapsedTenthsMin(clock.readMs()));
    };
    tick();
    const t = setInterval(tick, 1_000);

    const onVis = () => {
      if (document.hidden) clock.pause();
      else clock.resume();
      tick();
    };
    document.addEventListener('visibilitychange', onVis);
    // If we mount already hidden (rare), pause immediately.
    if (document.hidden) clock.pause();

    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [mineStartedAt]);

  async function releaseChallenge(challengeId: string | null): Promise<void> {
    if (!challengeId) return;
    if (challengeIdRef.current === challengeId) challengeIdRef.current = null;
    clearRememberedChallenge();
    try {
      await cancelOfferChallenge({ installId, challengeId });
    } catch {
      /* best-effort — server also replaces same-device challenges on /api/challenge */
    }
  }

  async function onCancelMine() {
    const id = challengeIdRef.current;
    offerGenRef.current += 1;
    challengeIdRef.current = null;
    clearRememberedChallenge();
    abortRef.current?.abort();
    abortRef.current = null;
    elapsedClockRef.current.stop();
    setMineStartedAt(null);
    setPhase('idle');
    setMsg({ kind: 'ok', text: 'Prayer cancelled.' });
    // Await so a quick re-Offer sees a free baton on the server.
    await releaseChallenge(id);
  }

  async function onOffer() {
    // Kill any in-progress mine before starting a new one.
    const prevId = challengeIdRef.current;
    offerGenRef.current += 1;
    const gen = offerGenRef.current;
    abortRef.current?.abort();
    challengeIdRef.current = null;
    clearRememberedChallenge();
    if (prevId) await releaseChallenge(prevId);
    if (offerGenRef.current !== gen) return;

    setMsg(null);
    elapsedClockRef.current.resetAndStart();
    setMineStartedAt(Date.now());
    setPhase('challenge');

    /** Fresh controller per attempt so tip-race abort can retry. */
    let ac = new AbortController();
    abortRef.current = ac;

    try {
      // Open race: if another device wins our tip, silently take a new challenge.
      // Never surface "someone else offered / pull to refresh" as a hard stop.
      while (offerGenRef.current === gen) {
        ac = new AbortController();
        abortRef.current = ac;
        let mineChallengeId: string | null = null;
        let tipMoved = false;
        let tipWatch: ReturnType<typeof setInterval> | null = null;

        try {
          setPhase('challenge');
          const challenge = await fetchChallenge({
            installId,
            note: note.trim(),
          });
          if (offerGenRef.current !== gen || ac.signal.aborted) {
            await releaseChallenge(challenge.challengeId);
            return;
          }

          mineChallengeId = challenge.challengeId;
          challengeIdRef.current = challenge.challengeId;
          rememberChallenge({
            challengeId: challenge.challengeId,
            installId,
          });

          setPhase('mining');
          // Tip retries must not reset the elapsed clock.
          if (!elapsedClockRef.current.isRunning) {
            elapsedClockRef.current.resetAndStart();
            setMineStartedAt(Date.now());
          } else if (!document.hidden) {
            elapsedClockRef.current.resume();
          }
          setBaseZeroBits(challenge.bits);

          const tipEpoch = challenge.tipEpoch ?? null;
          const tipIndex = challenge.tipIndex;
          if (tipEpoch != null) {
            let tipPollInFlight = false;
            const checkTip = async () => {
              if (tipPollInFlight || ac.signal.aborted) return;
              tipPollInFlight = true;
              try {
                const s = await fetchStatus(installId);
                const live = liveTipEpochFromStatus(s, tipIndex, tipEpoch);
                if (live && live !== tipEpoch) {
                  tipMoved = true;
                  ac.abort();
                }
              } catch {
                /* ignore transient status errors while mining */
              } finally {
                tipPollInFlight = false;
              }
            };
            void checkTip();
            tipWatch = setInterval(() => void checkTip(), TIP_POLL_MS);
          }

          let mined;
          try {
            mined = await mineInWorker({
              powPrefixHex: challenge.powPrefixHex,
              bits: challenge.bits,
              nonceLength: challenge.nonceLength,
              signal: ac.signal,
              onProgress: p => {
                rememberHashrate(p.hashrateHps);
                setDeviceHashrateHps(p.hashrateHps);
              },
            });
          } catch (e) {
            if (
              tipMoved ||
              (e instanceof DOMException && e.name === 'AbortError')
            ) {
              await releaseChallenge(challenge.challengeId);
              mineChallengeId = null;
              if (offerGenRef.current !== gen) return;
              if (tipMoved) {
                flashTipMsg('Mining on new tip');
                continue;
              }
              return;
            }
            throw e;
          } finally {
            if (tipWatch) clearInterval(tipWatch);
            tipWatch = null;
          }

          if (offerGenRef.current !== gen || ac.signal.aborted) {
            await releaseChallenge(challenge.challengeId);
            mineChallengeId = null;
            if (tipMoved && offerGenRef.current === gen) {
              flashTipMsg('Mining on new tip');
              continue;
            }
            return;
          }

          rememberHashrate(mined.hashrateHps);
          setDeviceHashrateHps(mined.hashrateHps);
          setPhase('submit');
          const result = await submitMinedOffer({
            installId,
            challengeId: challenge.challengeId,
            nonceHex: mined.nonceHex,
            powMs: mined.elapsedMs,
            powAttempts: mined.attempts,
          });

          if (offerGenRef.current !== gen) return;

          challengeIdRef.current = null;
          clearRememberedChallenge();
          mineChallengeId = null;

          elapsedClockRef.current.stop();
          const activeMs = elapsedClockRef.current.readMs();
          // UI duration = active session time (paused while hidden; includes tip retries).
          // API powMs stays the winning attempt's PoW timer (hashrate math).
          const uiPowMs = Math.max(activeMs, result.powMs || mined.elapsedMs);

          setOffers(
            pushOffer({
              remintTxid: result.remintTxid,
              burnTxid: result.burnTxid,
              note: note.trim(),
              at: new Date().toISOString(),
              powMs: uiPowMs,
              powAttempts: result.powAttempts || mined.attempts,
              hashrateHps: result.hashrateHps || mined.hashrateHps,
              bits: result.bits,
            }),
          );
          setNote('');
          await refreshStatus();
          setMsg({
            kind: 'ok',
            text: [
              `Offered in ${formatActualDuration(uiPowMs / 1000)}`,
              shortTx(result.remintTxid),
            ].join(' · '),
          });
          return;
        } catch (e) {
          await releaseChallenge(mineChallengeId);
          mineChallengeId = null;
          if (offerGenRef.current !== gen) return;

          const msg = e instanceof Error ? e.message : String(e);
          if (isTipRaceLost(msg)) {
            flashTipMsg('Mining on new tip');
            continue;
          }
          if (e instanceof DOMException && e.name === 'AbortError') {
            return;
          }
          setMsg({ kind: 'err', text: msg });
          return;
        } finally {
          if (tipWatch) clearInterval(tipWatch);
        }
      }
    } finally {
      if (offerGenRef.current === gen) {
        elapsedClockRef.current.stop();
        setPhase('idle');
        setMineStartedAt(null);
        if (abortRef.current === ac) abortRef.current = null;
      }
    }
  }

  const canOffer =
    !busy && apiOnline === true && (remaining === null || remaining > 0);

  const buttonLabel =
    phase === 'challenge'
      ? 'Preparing…'
      : phase === 'mining'
        ? 'PRAYING…'
        : phase === 'submit'
          ? 'Offering…'
          : 'Offer';

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
        <h2>Offer</h2>
        <p className="hint">
          Pray on this device while it mines {ticker}, then burn the presence
          atom — memorial and dana on-chain. Limited to {maxOffersPerDay}{' '}
          offerings per day here.
        </p>
        <p className="hint">
          Keep this screen on while you pray. Leaving the app or locking the
          phone pauses the offering (iPhone and Android).
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
            onClick={() => void onCancelMine()}
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
                  {o.note || 'Offering'}
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
        White Lotus · {ticker} ·{' '}
        <a href="https://github.com/bcProFoundation/wlotus">wlotus</a>
      </footer>
    </div>
  );
}
