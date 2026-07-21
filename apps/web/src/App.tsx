import { useCallback, useEffect, useRef, useState } from 'react';
import { LangSwitch } from './components/LangSwitch.js';
import {
  formatActualDurationLocale,
  formatElapsedTenthsMinLocale,
  formatEstimateDurationLocale,
} from './i18n/format.js';
import { useLocale } from './i18n/LocaleContext.js';
import {
  getMinPrayMs,
  getOrCreateInstallId,
  LOCAL_OFFERS_KEY,
  PRAYER_TICKER,
  TIP_POLL_MS,
} from './lib/config.js';
import {
  cancelOfferChallenge,
  completeOfferBurn,
  fetchChallenge,
  fetchStatus,
  shortTx,
  submitMinedOffer,
} from './lib/offerApi.js';

import { mineInWorker } from './lib/mineRunner.js';
import { MineElapsedClock } from './lib/mineElapsedClock.js';
import { waitMinPray } from './lib/minPrayMs.js';
import {
  isTipRaceLost,
  liveTipEpochFromStatus,
} from './lib/tipRace.js';
import {
  estimatePrayerPow,
  formatHashrateLabel,
  loadCachedHashrate,
  measureDeviceHashrate,
  saveCachedHashrate,
} from './lib/powEstimate.js';

type Msg = { kind: 'ok' | 'err'; text: string } | null;

type Phase = 'idle' | 'challenge' | 'mining' | 'submit' | 'holding' | 'burn';

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
  /** Immediate parent burn this re-offer links to (on-chain DANA v2). */
  parentBurnTxid?: string;
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
  const { locale, t } = useLocale();
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
  const [elapsedDisplay, setElapsedDisplay] = useState(() =>
    formatElapsedTenthsMinLocale(0, 'en'),
  );
  const [offers, setOffers] = useState<LocalOffer[]>(() => loadOffers());
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const challengeIdRef = useRef<string | null>(null);
  /** Remint awaiting memorial burn (soft pray); cancel abandons burn. */
  const pendingBurnRemintRef = useRef<string | null>(null);
  const pendingBurnTokenRef = useRef<string | null>(null);
  /** Bumps on cancel / new offer so a stale offer's finally cannot clobber UI. */
  const offerGenRef = useRef(0);
  /** Active elapsed (pauses when tab/app hidden; survives tip retries). */
  const elapsedClockRef = useRef(new MineElapsedClock());
  const tipMsgClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tRef = useRef(t);
  const localeRef = useRef(locale);
  tRef.current = t;
  localeRef.current = locale;

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
  /** Cancel during PoW search or soft-pray hold. */
  const showCancel = phase === 'mining' || phase === 'holding';
  const minPrayMs = getMinPrayMs();
  const powEta = estimatePrayerPow({
    bits: baseZeroBits,
    hashesPerSec: deviceHashrateHps,
  });
  /** ETA floor = max(PoW estimate, min pray) so early finds still feel ~1 min. */
  const etaSeconds = Math.max(powEta.seconds, minPrayMs / 1000);
  const etaLabel = formatEstimateDurationLocale(etaSeconds, locale);

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
    const timer = setInterval(() => void refreshStatus(), 15_000);
    return () => clearInterval(timer);
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
      if (tipMsgClearRef.current != null) {
        clearTimeout(tipMsgClearRef.current);
        tipMsgClearRef.current = null;
      }
    };
  }, []);

  /**
   * Tick elapsed from the active clock (pauses while document.hidden).
   * Tip retries do not reset the clock — only a new Offer does.
   */
  useEffect(() => {
    if (mineStartedAt == null) {
      setElapsedDisplay(formatElapsedTenthsMinLocale(0, locale));
      return;
    }
    const clock = elapsedClockRef.current;
    const tick = () => {
      setElapsedDisplay(formatElapsedTenthsMinLocale(clock.readMs(), locale));
    };
    tick();
    const timer = setInterval(tick, 1_000);

    const onVis = () => {
      if (document.hidden) clock.pause();
      else clock.resume();
      tick();
    };
    document.addEventListener('visibilitychange', onVis);
    if (document.hidden) clock.pause();

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [mineStartedAt, locale]);

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

  async function abandonPendingBurn(
    remintTxid: string | null,
    burnToken: string | null,
  ): Promise<void> {
    if (!remintTxid || !burnToken) return;
    if (pendingBurnRemintRef.current === remintTxid) {
      pendingBurnRemintRef.current = null;
      pendingBurnTokenRef.current = null;
    }
    try {
      await cancelOfferChallenge({ installId, remintTxid, burnToken });
    } catch {
      /* best-effort — TTL also drops pending burns */
    }
  }

  async function onCancelMine() {
    const id = challengeIdRef.current;
    const pendingRemint = pendingBurnRemintRef.current;
    const pendingToken = pendingBurnTokenRef.current;
    offerGenRef.current += 1;
    challengeIdRef.current = null;
    pendingBurnRemintRef.current = null;
    pendingBurnTokenRef.current = null;
    clearRememberedChallenge();
    abortRef.current?.abort();
    abortRef.current = null;
    elapsedClockRef.current.stop();
    setMineStartedAt(null);
    setPhase('idle');
    if (pendingRemint && pendingToken) {
      setMsg({ kind: 'ok', text: tRef.current('memorialCancelled') });
      await abandonPendingBurn(pendingRemint, pendingToken);
    } else {
      setMsg({ kind: 'ok', text: tRef.current('miningCancelled') });
      await releaseChallenge(id);
    }
  }

  async function onOffer(opts?: {
    parentBurnTxid?: string;
    /** Local label for history; on-chain note is empty when re-offering. */
    displayNote?: string;
  }) {
    const parentBurnTxid = opts?.parentBurnTxid?.trim() || undefined;
    const isReoffer = Boolean(parentBurnTxid);
    const challengeNote = isReoffer ? '' : note.trim();
    const historyNote = isReoffer
      ? (opts?.displayNote ?? '').trim()
      : note.trim();

    const prevId = challengeIdRef.current;
    const prevPending = pendingBurnRemintRef.current;
    const prevToken = pendingBurnTokenRef.current;
    offerGenRef.current += 1;
    const gen = offerGenRef.current;
    abortRef.current?.abort();
    challengeIdRef.current = null;
    pendingBurnRemintRef.current = null;
    pendingBurnTokenRef.current = null;
    clearRememberedChallenge();
    if (prevPending && prevToken) {
      await abandonPendingBurn(prevPending, prevToken);
    }
    if (prevId) await releaseChallenge(prevId);
    if (offerGenRef.current !== gen) return;

    setMsg(null);
    elapsedClockRef.current.resetAndStart();
    setMineStartedAt(Date.now());
    setPhase('challenge');

    let ac = new AbortController();
    abortRef.current = ac;

    try {
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
            note: challengeNote,
            parentBurnTxid,
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
          const prayStartedAt = Date.now();
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
                flashTipMsg(tRef.current('miningOnNewTip'));
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
              flashTipMsg(tRef.current('miningOnNewTip'));
              continue;
            }
            return;
          }

          rememberHashrate(mined.hashrateHps);
          setDeviceHashrateHps(mined.hashrateHps);
          // Remint immediately — soft pray must not delay the tip race.
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

          let burnTxid = result.burnTxid;
          if (result.burnPending) {
            const burnToken = result.burnToken?.trim() || '';
            if (!burnToken) {
              throw new Error('Mint API omit burnToken; cannot complete memorial');
            }
            pendingBurnRemintRef.current = result.remintTxid;
            pendingBurnTokenRef.current = burnToken;
            setPhase('holding');
            try {
              await waitMinPray({
                startedAtMs: prayStartedAt,
                minPrayMs: getMinPrayMs(),
                signal: ac.signal,
              });
            } catch (e) {
              if (e instanceof DOMException && e.name === 'AbortError') {
                // onCancelMine abandons pending burn
                return;
              }
              throw e;
            }
            if (offerGenRef.current !== gen || ac.signal.aborted) {
              return;
            }
            setPhase('burn');
            const burned = await completeOfferBurn({
              installId,
              remintTxid: result.remintTxid,
              burnToken,
            });
            burnTxid = burned.burnTxid;
            pendingBurnRemintRef.current = null;
            pendingBurnTokenRef.current = null;
          }

          if (offerGenRef.current !== gen) return;

          elapsedClockRef.current.stop();
          const activeMs = elapsedClockRef.current.readMs();
          const uiPowMs = Math.max(activeMs, result.powMs || mined.elapsedMs);

          setOffers(
            pushOffer({
              remintTxid: result.remintTxid,
              burnTxid,
              note: historyNote,
              at: new Date().toISOString(),
              powMs: uiPowMs,
              powAttempts: result.powAttempts || mined.attempts,
              hashrateHps: result.hashrateHps || mined.hashrateHps,
              bits: result.bits,
              parentBurnTxid,
            }),
          );
          setNote('');
          await refreshStatus();
          setMsg({
            kind: 'ok',
            text: [
              tRef.current('offeredIn', {
                duration: formatActualDurationLocale(
                  uiPowMs / 1000,
                  localeRef.current,
                ),
              }),
              shortTx(result.remintTxid),
            ].join(' · '),
          });
          return;
        } catch (e) {
          await releaseChallenge(mineChallengeId);
          mineChallengeId = null;
          if (offerGenRef.current !== gen) return;

          const errMsg = e instanceof Error ? e.message : String(e);
          if (isTipRaceLost(errMsg)) {
            flashTipMsg(tRef.current('miningOnNewTip'));
            continue;
          }
          if (e instanceof DOMException && e.name === 'AbortError') {
            return;
          }
          setMsg({ kind: 'err', text: errMsg });
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
      ? t('btnPreparing')
      : phase === 'mining'
        ? t('btnPraying')
        : phase === 'holding' || phase === 'submit' || phase === 'burn'
          ? t('btnOffering')
          : t('btnOffer');

  return (
    <div className="app">
      <header className="hero">
        <div className="brand-row">
          <div className="brand-main">
            <img
              className="brand-mark"
              src="/images/wlotus.png"
              alt=""
              width={56}
              height={56}
            />
            <h1 className="brand">{t('brand')}</h1>
          </div>
          <LangSwitch />
        </div>
        <p className="tagline">{t('tagline')}</p>
      </header>

      <section className="panel offer-panel">
        <h2>{t('offerTitle')}</h2>
        <p className="hint">
          {t('hintPrayMine', { ticker, max: maxOffersPerDay })}
        </p>
        <p className="hint">{t('hintKeepScreen')}</p>

        <p className="hint eta" aria-live="off">
          {t('etaEstimated', { eta: etaLabel })}
        </p>

        <div className="field">
          <label htmlFor="note">{t('noteLabel')}</label>
          <textarea
            id="note"
            rows={2}
            maxLength={80}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t('notePlaceholder')}
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
          {showCancel ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void onCancelMine()}
            >
              {t('btnCancel')}
            </button>
          ) : null}
        </div>

        {mineStartedAt != null ? (
          <p className="mine-progress" aria-live="polite">
            {t('miningElapsed', { elapsed: elapsedDisplay })}
          </p>
        ) : null}

        <details className="how-offer">
          <summary>{t('howTitle')}</summary>
          <ol>
            {[
              {
                title: t('howPrayTitle'),
                body: t('howPrayBody'),
              },
              {
                title: t('howMintTitle', { ticker }),
                body: t('howMintBody'),
              },
              {
                title: t('howWhyTitle'),
                body: t('howWhyBody'),
              },
            ]
              .filter(step => step.title.trim() || step.body.trim())
              .map((step, i) => (
                <li key={i}>
                  {step.title.trim() ? <strong>{step.title} </strong> : null}
                  {step.body}
                </li>
              ))}
          </ol>
        </details>

        <p className="meta">
          {apiOnline === null
            ? t('connecting')
            : apiOnline === false
              ? t('apiOffline')
              : t('leftToday', { n: remaining ?? '—' })}
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
          <h2>{t('recentTitle')}</h2>
          <p className="hint">{t('reofferHint')}</p>
          <ul className="history">
            {offers.map(o => (
              <li key={o.burnTxid}>
                <div className="history-main">
                  <span>
                    {o.note || t('offeringFallback')}
                    {o.parentBurnTxid ? (
                      <span className="history-meta">
                        {' '}
                        · {t('reofferBadge')}
                      </span>
                    ) : null}
                    {o.powMs != null ? (
                      <span className="history-meta">
                        {' '}
                        · {formatActualDurationLocale(o.powMs / 1000, locale)}
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
                </div>
                <button
                  type="button"
                  className="btn btn-reoffer"
                  disabled={!canOffer}
                  onClick={() =>
                    void onOffer({
                      parentBurnTxid: o.burnTxid,
                      displayNote: o.note,
                    })
                  }
                >
                  {t('btnReoffer')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="footer">
        {t('footerBrand')} · {ticker} ·{' '}
        <a href="https://wlotus.org">wlotus.org</a>
      </footer>
    </div>
  );
}
