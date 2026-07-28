import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
} from 'react';
import { LangSwitch } from './components/LangSwitch.js';
import { AltarDetails } from './components/AltarDetails.js';
import { AltarSetupModal } from './components/AltarSetupModal.js';
import {
  OpenInBrowserGate,
  useShareInAppBrowserGate,
} from './components/OpenInBrowserGate.js';
import { SwipeReveal } from './components/SwipeReveal.js';
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
  emptyAltarFields,
  encodeAltarNote,
  formatAltarPersonName,
  isAltarPackedNote,
  memorialDisplayName,
  MEMORIAL_NOTE_MAX_CHARS,
  parseAltarNote,
  type AltarFields,
} from './lib/altarFields.js';
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
import { waitMinPray } from './lib/minPraySeconds.js';
import {
  isTipRaceLost,
  liveTipEpochFromStatus,
} from './lib/tipRace.js';
import {
  groupOffersByOriginal,
  resolveOriginalTxid,
  seedLocalRootIfMissing,
  type LocalOffer,
  type OfferGroup,
} from './lib/groupOffers.js';
import {
  fetchIndexMemorial,
  notifyIndexBurn,
  type IndexMemorialGroup,
} from './lib/danaIndexApi.js';
import {
  hideRecentRoot,
  isRecentRootHidden,
  loadHiddenRecentRoots,
  stripOffersForRoot,
  unhideRecentRoot,
} from './lib/hiddenRecent.js';
import { mergeIndexAndLocalOffers, syncIndexMemorialIntoLocal } from './lib/mergeRecentOffers.js';
import {
  burnTxidFromLocation,
  clearDedicationPath,
  dedicationShareUrl,
  extractBurnTxid,
  looksLikeShareInput,
} from './lib/shareLink.js';
import {
  estimatePrayerPow,
  loadCachedHashrate,
  OFFER_DESK_OVERHEAD_SECONDS,
  saveCachedHashrate,
} from './lib/powEstimate.js';
import { measureDeviceHashrate } from './lib/powMeasure.js';

type Msg = { kind: 'ok' | 'err' | 'success'; text: string } | null;

type Phase = 'idle' | 'challenge' | 'mining' | 'submit' | 'holding' | 'burn';

const ACTIVE_CHALLENGE_KEY = 'wlotus.activeChallenge';

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

/** Compact external-link glyph for explorer tx (no hash column). */
function ExplorerLinkIcon({
  txid,
  label,
}: {
  txid: string;
  label: string;
}) {
  return (
    <a
      className="explorer-link-icon"
      href={`https://explorer.e.cash/tx/${txid}`}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM5 5h6v2H7v10h10v-4h2v6H5V5z"
        />
      </svg>
    </a>
  );
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
  const shareInAppBrowserGate = useShareInAppBrowserGate();
  const [installId] = useState(() => getOrCreateInstallId());
  const [note, setNote] = useState('');
  /** Structured altar fields; packed into the on-chain note when offering. */
  const [altar, setAltar] = useState<AltarFields | null>(null);
  const [altarOpen, setAltarOpen] = useState(false);
  /** Read-only Ban thờ sheet (Recent name / Dâng lại) — same screen. */
  const [dedicationSheet, setDedicationSheet] = useState<{
    parentBurnTxid: string;
    altar: AltarFields;
    extraNote: string;
  } | null>(null);
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
  /** Roots hidden from Recent on this device only (on-chain burns remain). */
  const [hiddenRecent, setHiddenRecent] = useState<Set<string>>(() =>
    loadHiddenRecentRoots(),
  );
  const [swipeOpenRoot, setSwipeOpenRoot] = useState<string | null>(null);
  const [historyGroup, setHistoryGroup] = useState<OfferGroup | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  /** Active offer overlay (new or re-offer) — keeps timer/cancel on screen. */
  const [session, setSession] = useState<{
    reoffer: boolean;
    note: string;
    /** Structured altar shown during the offer session (new dedications). */
    altar?: AltarFields | null;
    /** Optional remembrance words on a re-offer (on-chain DANA v2 note). */
    extraNote?: string;
  } | null>(null);
  /** Confirm before closing an active offer session (X / Cancel). */
  const [cancelLoseConfirm, setCancelLoseConfirm] = useState(false);
  /**
   * React mirror of pending memorial burn (soft pray after remint).
   * Drives cancel-confirm copy; refs stay authoritative for API calls.
   */
  const [pendingMemorial, setPendingMemorial] = useState(false);
  /** On-chain original burn when note was resolved from a share link / path. */
  const [linkedParentBurnTxid, setLinkedParentBurnTxid] = useState<
    string | null
  >(null);
  const [shareLookingUp, setShareLookingUp] = useState(false);
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
  const shareLookupGenRef = useRef(0);
  const shareLookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  /** Path deeplink: auto-start re-offer once mint-api is online. */
  const [pendingDeeplinkOffer, setPendingDeeplinkOffer] = useState<{
    parentBurnTxid: string;
    displayNote: string;
  } | null>(null);
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
  /**
   * Keep Cancel mounted for the whole offer session (except final burn).
   * Hiding it only in `mining`|`holding` flickered: with bits=0, mining is
   * instant → submit hides Cancel for the remint RTT → holding shows it again.
   */
  const showCancel =
    phase === 'challenge' ||
    phase === 'mining' ||
    phase === 'submit' ||
    phase === 'holding';
  const minPrayMs = getMinPrayMs();
  const powEta = estimatePrayerPow({
    bits: baseZeroBits,
    hashesPerSec: deviceHashrateHps,
  });
  /** ETA = max(PoW, min pray) + desk overhead so low-diff sessions match wall time. */
  const etaSeconds =
    Math.max(powEta.seconds, minPrayMs / 1000) + OFFER_DESK_OVERHEAD_SECONDS;
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

  const applyDedicationLink = useCallback(
    async (raw: string, opts?: { autoStart?: boolean }) => {
      const txid = extractBurnTxid(raw);
      if (!txid) return false;
      const gen = ++shareLookupGenRef.current;
      setShareLookingUp(true);
      setMsg({ kind: 'ok', text: tRef.current('shareLookingUp') });
      try {
        const { lookupDedication } = await import('./lib/lookupDedication.js');
        const d = await lookupDedication(txid);
        if (shareLookupGenRef.current !== gen) return true;
        const displayNote = d.note.trim();
        const packed = parseAltarNote(displayNote);
        if (packed) {
          setAltar(packed);
          setNote(packed.note || packed.name);
        } else {
          setAltar(null);
          setNote(displayNote);
        }
        setLinkedParentBurnTxid(d.originalBurnTxid);
        setMsg({
          kind: 'ok',
          text: tRef.current('shareLinked', {
            name:
              memorialDisplayName(displayNote, localeRef.current) ||
              tRef.current('offeringFallback'),
          }),
        });
        // Share / paste / path: go straight to the re-offer (Dâng Hoa) sheet —
        // never leave the user on Ban thờ with Sửa/Xóa.
        if (opts?.autoStart !== false) {
          setPendingDeeplinkOffer({
            parentBurnTxid: d.originalBurnTxid,
            displayNote,
          });
        }
        return true;
      } catch {
        if (shareLookupGenRef.current !== gen) return true;
        setLinkedParentBurnTxid(null);
        setMsg({ kind: 'err', text: tRef.current('shareLookupFailed') });
        return true;
      } finally {
        if (shareLookupGenRef.current === gen) setShareLookingUp(false);
      }
    },
    [],
  );

  /** Deeplink: /<original-burn-txid> → lookup note → auto re-offer when online.
   * Skip while a messenger WebView gate is up (avoid consuming the path there). */
  useEffect(() => {
    if (shareInAppBrowserGate.active) return;
    const txid = burnTxidFromLocation();
    if (!txid) return;
    clearDedicationPath();
    void applyDedicationLink(txid);
  }, [applyDedicationLink, shareInAppBrowserGate.active]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (tipMsgClearRef.current != null) {
        clearTimeout(tipMsgClearRef.current);
        tipMsgClearRef.current = null;
      }
      if (shareLookupTimerRef.current != null) {
        clearTimeout(shareLookupTimerRef.current);
        shareLookupTimerRef.current = null;
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
      clearPendingMemorial();
    }
    try {
      await cancelOfferChallenge({ installId, remintTxid, burnToken });
    } catch {
      /* best-effort — TTL also drops pending burns */
    }
  }

  function clearPendingMemorial(): void {
    pendingBurnRemintRef.current = null;
    pendingBurnTokenRef.current = null;
    setPendingMemorial(false);
  }

  async function onCancelMine() {
    setCancelLoseConfirm(false);
    const id = challengeIdRef.current;
    const pendingRemint = pendingBurnRemintRef.current;
    const pendingToken = pendingBurnTokenRef.current;
    offerGenRef.current += 1;
    challengeIdRef.current = null;
    clearPendingMemorial();
    clearRememberedChallenge();
    abortRef.current?.abort();
    abortRef.current = null;
    elapsedClockRef.current.stop();
    setMineStartedAt(null);
    setPhase('idle');
    setSession(null);
    if (pendingRemint && pendingToken) {
      setMsg({ kind: 'ok', text: tRef.current('memorialCancelled') });
      await abandonPendingBurn(pendingRemint, pendingToken);
    } else {
      setMsg({ kind: 'ok', text: tRef.current('miningCancelled') });
      await releaseChallenge(id);
    }
  }

  /** X / Cancel during an active offer — always confirm (copy depends on remint). */
  function requestCancelOffer() {
    if (cancelLoseConfirm) {
      // Second tap on × dismisses the confirm and keeps offering.
      setCancelLoseConfirm(false);
      return;
    }
    setCancelLoseConfirm(true);
  }

  async function onOffer(opts?: {
    parentBurnTxid?: string;
    /** Local label for history grouping (original dedication name). */
    displayNote?: string;
    /** Ban thờ for this offer (first offer from setup popup, or re-offer session). */
    altar?: AltarFields | null;
    /** Additional remembrance words — on-chain for re-offers (DANA v2 note). */
    extraNote?: string;
  }) {
    const parentBurnTxid = opts?.parentBurnTxid?.trim() || undefined;
    const isReoffer = Boolean(parentBurnTxid);
    const extraNote = isReoffer
      ? (opts?.extraNote ?? '').trim()
      : undefined;
    let challengeNote: string;
    let historyNote: string;
    const activeAltar = !isReoffer ? (opts?.altar ?? altar) : null;
    if (isReoffer) {
      challengeNote = extraNote ?? '';
      historyNote = (opts?.displayNote ?? '').trim();
    } else if (activeAltar) {
      try {
        challengeNote = encodeAltarNote(activeAltar);
      } catch {
        setMsg({ kind: 'err', text: t('altarErrDeathDate') });
        return;
      }
      historyNote =
        formatAltarPersonName(activeAltar, locale) ||
        memorialDisplayName(challengeNote, locale);
    } else {
      challengeNote = note.trim();
      historyNote = note.trim();
    }

    setDedicationSheet(null);
    setCancelLoseConfirm(false);
    setSession({
      reoffer: isReoffer,
      note: historyNote,
      altar: isReoffer
        ? (opts?.altar ?? null)
        : activeAltar,
      extraNote: extraNote || undefined,
    });
    setLinkedParentBurnTxid(null);

    const prevId = challengeIdRef.current;
    const prevPending = pendingBurnRemintRef.current;
    const prevToken = pendingBurnTokenRef.current;
    offerGenRef.current += 1;
    const gen = offerGenRef.current;
    abortRef.current?.abort();
    challengeIdRef.current = null;
    clearPendingMemorial();
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

          if (offerGenRef.current !== gen) {
            // Cancelled during submit — remint may already be pending memorial.
            if (result.burnPending) {
              const tok = result.burnToken?.trim();
              if (tok) await abandonPendingBurn(result.remintTxid, tok);
            }
            return;
          }

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
            setPendingMemorial(true);
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
            clearPendingMemorial();
          }

          if (offerGenRef.current !== gen) return;

          elapsedClockRef.current.stop();
          const activeMs = elapsedClockRef.current.readMs();
          const uiPowMs = Math.max(activeMs, result.powMs || mined.elapsedMs);

          const saved: LocalOffer = {
            remintTxid: result.remintTxid,
            burnTxid,
            // On-chain memorial for this burn (packed altar / plain / re-offer extra).
            note: challengeNote,
            at: new Date().toISOString(),
            powMs: uiPowMs,
            powAttempts: result.powAttempts || mined.attempts,
            hashrateHps: result.hashrateHps || mined.hashrateHps,
            bits: result.bits,
            parentBurnTxid,
          };
          // Share-link re-offer: original may not be on this device — seed a
          // named root (prefer packed Ban thờ wire) so Recent can open full details.
          if (parentBurnTxid) {
            let rootNote = historyNote.trim();
            const altarForRoot = opts?.altar;
            if (altarForRoot) {
              try {
                rootNote = encodeAltarNote(altarForRoot);
              } catch {
                /* keep historyNote */
              }
            }
            if (rootNote) {
              const seeded = seedLocalRootIfMissing(
                loadOffers(),
                parentBurnTxid,
                rootNote,
              );
              localStorage.setItem(LOCAL_OFFERS_KEY, JSON.stringify(seeded));
            }
          }
          setOffers(pushOffer(saved));
          // Offering again restores a previously hidden dedication on this device.
          setHiddenRecent(prev =>
            unhideRecentRoot(resolveOriginalTxid(saved), prev),
          );
          setNote('');
          setAltar(null);
          void notifyIndexBurn(burnTxid);
          await refreshStatus();
          const offeredFor =
            memorialDisplayName(historyNote, localeRef.current) ||
            memorialDisplayName(challengeNote, localeRef.current) ||
            tRef.current('offeringFallback');
          setMsg({
            kind: 'success',
            text: tRef.current('offeredIn', {
              duration: formatActualDurationLocale(
                uiPowMs / 1000,
                localeRef.current,
              ),
              name: offeredFor,
            }),
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
        setSession(null);
        if (abortRef.current === ac) abortRef.current = null;
      }
    }
  }

  useEffect(() => {
    const lock = Boolean(
      busy || dedicationSheet || historyGroup || altarOpen,
    );
    document.body.style.overflow = lock ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [busy, dedicationSheet, historyGroup, altarOpen]);

  useEffect(() => {
    if (busy || msg?.kind !== 'success') return;
    const el = document.getElementById('offer-success-msg');
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [busy, msg]);

  const canOffer =
    !busy && apiOnline === true && (remaining === null || remaining > 0);

  function altarFromMemorialNote(raw: string): AltarFields {
    const packed = parseAltarNote(raw);
    if (packed) return packed;
    const name = raw.trim();
    return { ...emptyAltarFields(), name };
  }

  /** Persist index burns for a dedication so Recent total matches History. */
  function persistMemorialSync(remote: IndexMemorialGroup): LocalOffer[] {
    const next = syncIndexMemorialIntoLocal(loadOffers(), remote);
    localStorage.setItem(LOCAL_OFFERS_KEY, JSON.stringify(next));
    setOffers(next);
    return next;
  }

  /** Open re-offer sheet; sync History burns into Recent; hydrate Ban thờ. */
  async function openDedicationSheet(opts: {
    parentBurnTxid: string;
    memorialNote: string;
  }) {
    let memorialNote = opts.memorialNote;
    try {
      const remote = await fetchIndexMemorial(opts.parentBurnTxid);
      persistMemorialSync(remote);
      const remoteNote = (
        remote.originalNote ||
        remote.latestNote ||
        ''
      ).trim();
      if (
        remoteNote &&
        (!isAltarPackedNote(memorialNote) || isAltarPackedNote(remoteNote))
      ) {
        memorialNote = remoteNote;
      }
    } catch {
      /* keep local note; index may be offline */
    }
    setDedicationSheet({
      parentBurnTxid: opts.parentBurnTxid,
      altar: altarFromMemorialNote(memorialNote),
      extraNote: '',
    });
  }

  /** Path deeplink: open Ban thờ / re-offer sheet once the desk is reachable. */
  useEffect(() => {
    if (!canOffer || !pendingDeeplinkOffer) return;
    const pending = pendingDeeplinkOffer;
    setPendingDeeplinkOffer(null);
    void openDedicationSheet({
      parentBurnTxid: pending.parentBurnTxid,
      memorialNote: pending.displayNote,
    });
  }, [canOffer, pendingDeeplinkOffer]);

  function onNoteInput(value: string) {
    setNote(value.slice(0, MEMORIAL_NOTE_MAX_CHARS));
    setLinkedParentBurnTxid(null);
    if (shareLookupTimerRef.current != null) {
      clearTimeout(shareLookupTimerRef.current);
      shareLookupTimerRef.current = null;
    }
    if (!looksLikeShareInput(value)) return;
    shareLookupTimerRef.current = setTimeout(() => {
      shareLookupTimerRef.current = null;
      void applyDedicationLink(value);
    }, 450);
  }

  function onNotePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const text = e.clipboardData.getData('text');
    if (!looksLikeShareInput(text)) return;
    e.preventDefault();
    void applyDedicationLink(text);
  }

  async function shareDedication(originalBurnTxid: string, label: string) {
    // Embed sender locale so OG crawlers show the sharer's language preview.
    const url = dedicationShareUrl(originalBurnTxid, undefined, locale);
    // Clear any leftover banner from a prior share / clipboard attempt.
    setMsg(null);

    // Prefer the system share sheet. On dismiss/failure do not fall through —
    // many mobile browsers reject with a non-DOMException AbortError (or
    // similar), and clipboard fallthrough was putting the raw URL on screen.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: label || t('offeringFallback'),
          url,
        });
      } catch {
        /* dismissed or failed — stay silent */
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setMsg({ kind: 'ok', text: t('shareCopied') });
    } catch {
      /* no clipboard — stay silent; never dump the raw URL into the layout */
    }
  }

  /** Device-local Recent only — dana-index is for History / share lookup. */
  const recentGroups = groupOffersByOriginal(offers).filter(
    g => !isRecentRootHidden(g.original.burnTxid, hiddenRecent),
  );

  function removeRecentGroup(g: OfferGroup) {
    const root = g.original.burnTxid;
    setHiddenRecent(prev => hideRecentRoot(root, prev));
    const nextOffers = stripOffersForRoot(loadOffers(), root);
    localStorage.setItem(LOCAL_OFFERS_KEY, JSON.stringify(nextOffers));
    setOffers(nextOffers);
    setSwipeOpenRoot(null);
    if (historyGroup?.original.burnTxid === root) setHistoryGroup(null);
    if (dedicationSheet?.parentBurnTxid === root) setDedicationSheet(null);
  }

  async function openMemorialHistory(g: OfferGroup) {
    setHistoryGroup(g);
    setHistoryError('');
    setHistoryLoading(true);
    try {
      const remote = await fetchIndexMemorial(g.original.burnTxid);
      const next = persistMemorialSync(remote);
      const merged = mergeIndexAndLocalOffers([remote], next);
      setHistoryGroup(merged[0] ?? g);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      // Local burns already shown — only surface a soft hint when index is down.
      if (
        raw === 'INDEX_HTML' ||
        raw === 'INDEX_BAD_JSON' ||
        /Failed to fetch|NetworkError|fetch/i.test(raw)
      ) {
        setHistoryError(t('historyIndexUnavailable'));
      } else {
        setHistoryError(raw);
      }
    } finally {
      setHistoryLoading(false);
    }
  }

  const buttonLabel =
    phase === 'challenge' || phase === 'mining'
      ? t('btnPraying')
      : phase === 'holding' || phase === 'submit' || phase === 'burn'
        ? t('btnOffering')
        : linkedParentBurnTxid
          ? t('btnReoffer')
          : t('btnOffer');

  if (shareInAppBrowserGate.active) {
    return (
      <div className="app">
        <OpenInBrowserGate
          href={window.location.href}
          hostApp={shareInAppBrowserGate.hostApp}
          onContinue={shareInAppBrowserGate.continueInHost}
        />
      </div>
    );
  }

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
          <div className="field-label-row">
            <label>{altar ? t('altarLabel') : t('noteLabel')}</label>
            {altar && !linkedParentBurnTxid ? (
              <div className="field-label-links">
                <button
                  type="button"
                  className="link-more"
                  disabled={busy || apiOnline === false}
                  onClick={() => setAltarOpen(true)}
                >
                  {t('btnAltarEdit')}
                </button>
                <button
                  type="button"
                  className="link-more"
                  disabled={busy}
                  onClick={() => {
                    setAltar(null);
                    setNote('');
                    setLinkedParentBurnTxid(null);
                  }}
                >
                  {t('btnAltarDelete')}
                </button>
              </div>
            ) : !altar ? (
              <button
                type="button"
                className="link-more"
                disabled={busy || apiOnline === false}
                onClick={() => setAltarOpen(true)}
              >
                {t('btnAltarMore')}
              </button>
            ) : null}
          </div>
          {altar ? (
            <AltarDetails altar={altar} />
          ) : (
            <textarea
              id="note"
              rows={2}
              maxLength={MEMORIAL_NOTE_MAX_CHARS}
              value={note}
              onChange={e => onNoteInput(e.target.value)}
              onPaste={onNotePaste}
              placeholder={t('notePlaceholder')}
              disabled={busy || apiOnline === false || shareLookingUp}
            />
          )}
        </div>

        <div className="offer-actions">
          <button
            id="offer-flower-btn"
            className="btn btn-primary btn-offer"
            disabled={!canOffer || shareLookingUp}
            onClick={() => {
              if (linkedParentBurnTxid) {
                let memorialNote = note;
                if (altar) {
                  try {
                    memorialNote = encodeAltarNote(altar);
                  } catch {
                    memorialNote = altar.name;
                  }
                }
                void openDedicationSheet({
                  parentBurnTxid: linkedParentBurnTxid,
                  memorialNote,
                });
                return;
              }
              void onOffer();
            }}
          >
            {buttonLabel}
          </button>
        </div>

        {!busy && msg?.kind === 'success' ? (
          <div
            id="offer-success-msg"
            className={`msg ${msg.kind}`}
            role="status"
          >
            {msg.text}
          </div>
        ) : null}

        <p className="hint share-hint">
          {shareLookingUp
            ? t('shareLookingUp')
            : linkedParentBurnTxid
              ? t('shareLinked', {
                  name:
                    (altar
                      ? formatAltarPersonName(altar, locale)
                      : memorialDisplayName(note, locale)) ||
                    t('offeringFallback'),
                })
              : t('shareHint')}
        </p>

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
              {
                title: t('howEternalTitle'),
                body: t('howEternalBody'),
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
                {ticker} {shortTx(tokenId)}
              </a>
            </>
          ) : null}
        </p>

        {!busy &&
        msg &&
        msg.kind !== 'success' &&
        !looksLikeShareInput(msg.text) ? (
          <div className={`msg ${msg.kind}`}>{msg.text}</div>
        ) : null}
      </section>

      {recentGroups.length > 0 ? (
        <section className="panel">
          <h2>{t('recentTitle')}</h2>
          <p className="hint">{t('reofferHint')}</p>
          <ul className="history">
            {recentGroups.map(g => {
              const last = g.latest;
              const originalText =
                memorialDisplayName(g.note, locale) || t('offeringFallback');
              const latestText = memorialDisplayName(
                last.note || '',
                locale,
              ).trim();
              const showLatestMessage =
                Boolean(latestText) &&
                (last.burnTxid !== g.original.burnTxid ||
                  latestText !== originalText);
              const lastWhen = new Date(last.at).toLocaleString(locale);
              const rootId = g.original.burnTxid;
              return (
                <li key={rootId}>
                  <SwipeReveal
                    open={swipeOpenRoot === rootId}
                    onOpenChange={open =>
                      setSwipeOpenRoot(open ? rootId : null)
                    }
                    disabled={busy}
                    actions={[
                      {
                        key: 'history',
                        label: t('btnHistory'),
                        onClick: () => void openMemorialHistory(g),
                      },
                      {
                        key: 'open',
                        label: t('btnSwipeOpen'),
                        onClick: () => {
                          window.open(
                            `https://explorer.e.cash/tx/${last.burnTxid}`,
                            '_blank',
                            'noopener,noreferrer',
                          );
                        },
                      },
                      {
                        key: 'delete',
                        label: t('btnRemoveRecent'),
                        danger: true,
                        onClick: () => removeRecentGroup(g),
                      },
                    ]}
                  >
                    <div className="history-item">
                      <div className="history-row history-row-primary">
                        <button
                          type="button"
                          className="history-original history-original-btn"
                          onClick={() =>
                            void openDedicationSheet({
                              parentBurnTxid: rootId,
                              memorialNote: g.note,
                            })
                          }
                        >
                          {originalText}
                        </button>
                        <div className="history-row-actions">
                          <button
                            type="button"
                            className="btn btn-icon-action"
                            aria-label={t('btnShare')}
                            title={t('btnShare')}
                            disabled={busy}
                            onClick={() =>
                              void shareDedication(rootId, originalText)
                            }
                          >
                            <svg
                              className="btn-icon-svg"
                              viewBox="0 0 24 24"
                              width="18"
                              height="18"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <path
                                fill="currentColor"
                                d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="history-row history-row-secondary">
                        <span className="history-meta">
                          {t('burnTotal', { n: g.totalBurns })}
                        </span>
                        <div className="history-row-actions">
                          <button
                            type="button"
                            className="btn btn-reoffer-lotus"
                            disabled={!canOffer}
                            onClick={() =>
                              void openDedicationSheet({
                                parentBurnTxid: rootId,
                                memorialNote: g.note,
                              })
                            }
                          >
                            <img
                              src="/images/wlotus.png"
                              alt=""
                              width={22}
                              height={22}
                              draggable={false}
                            />
                            <span>{t('btnReoffer')}</span>
                          </button>
                        </div>
                      </div>
                      <span className="history-meta">
                        {t('lastOfferedAt', { when: lastWhen })}
                      </span>
                      {showLatestMessage ? (
                        <span className="history-latest">
                          {t('latestMessageLabel', { msg: latestText })}
                        </span>
                      ) : null}
                    </div>
                  </SwipeReveal>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {altarOpen ? (
        <AltarSetupModal
          initial={altar}
          fallbackName={altar ? undefined : note.trim()}
          etaLabel={etaLabel}
          offerDisabled={!canOffer || shareLookingUp}
          onClose={() => setAltarOpen(false)}
          onSave={fields => {
            setAltar(fields);
            setNote(fields.note);
            setLinkedParentBurnTxid(null);
          }}
          onOffer={fields => {
            setAltar(fields);
            setNote(fields.note);
            setLinkedParentBurnTxid(null);
            setAltarOpen(false);
            void onOffer({ altar: fields });
          }}
        />
      ) : null}

      {dedicationSheet && !busy ? (
        <div
          className="offer-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="altar-detail-title"
        >
          <div className="offer-modal-card altar-setup-card">
            <button
              type="button"
              className="offer-modal-close"
              aria-label={t('btnClose')}
              onClick={() => setDedicationSheet(null)}
            >
              ×
            </button>
            <h2 id="altar-detail-title">{t('altarDetailTitle')}</h2>
            <AltarDetails altar={dedicationSheet.altar} />
            <div className="field">
              <label htmlFor="dedication-extra-note">
                {t('reofferExtraNoteLabel')}
              </label>
              <textarea
                id="dedication-extra-note"
                rows={2}
                maxLength={80}
                value={dedicationSheet.extraNote}
                onChange={e =>
                  setDedicationSheet(d =>
                    d
                      ? { ...d, extraNote: e.target.value.slice(0, 80) }
                      : d,
                  )
                }
                placeholder={t('reofferExtraNotePlaceholder')}
              />
            </div>
            <p className="hint eta">{t('etaEstimated', { eta: etaLabel })}</p>
            <p className="hint">{t('hintKeepScreen')}</p>
            <div className="offer-actions offer-session-actions">
              <button
                type="button"
                className="btn btn-primary btn-offer"
                disabled={!canOffer}
                onClick={() =>
                  void onOffer({
                    parentBurnTxid: dedicationSheet.parentBurnTxid,
                    displayNote:
                      formatAltarPersonName(dedicationSheet.altar, locale) ||
                      t('offeringFallback'),
                    altar: dedicationSheet.altar,
                    extraNote: dedicationSheet.extraNote,
                  })
                }
              >
                {t('btnOffer')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {historyGroup ? (
        <div
          className="offer-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memorial-history-title"
        >
          <div className="offer-modal-card">
            <button
              type="button"
              className="offer-modal-close"
              aria-label={t('btnClose')}
              onClick={() => setHistoryGroup(null)}
            >
              ×
            </button>
            <h2 id="memorial-history-title">{t('historyTitle')}</h2>
            <p className="offer-session-note offer-session-original">
              {memorialDisplayName(historyGroup.note, locale) ||
                t('offeringFallback')}
            </p>
            <p className="hint">
              {t('burnTotal', { n: historyGroup.totalBurns })}
              {historyLoading ? ` · ${t('historyLoading')}` : ''}
            </p>
            {historyError ? (
              <div className="msg hint-inline">{historyError}</div>
            ) : null}
            <ul className="memorial-history-list">
              {historyGroup.burns.map((b, i) => (
                <li key={b.burnTxid}>
                  <div className="memorial-history-main">
                    <span className="memorial-history-note">
                      {(b.note || '').trim()
                        ? memorialDisplayName(b.note, locale)
                        : i === historyGroup.burns.length - 1
                          ? memorialDisplayName(historyGroup.note, locale) ||
                            t('offeringFallback')
                          : t('latestMemorialFallback')}
                    </span>
                    <ExplorerLinkIcon
                      txid={b.burnTxid}
                      label={t('openOnExplorer')}
                    />
                  </div>
                  <span className="history-meta">
                    {new Date(b.at).toLocaleString(locale)}
                    {b.parentBurnTxid ? ` · ${t('reofferBadge')}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {busy && session?.reoffer ? (
        <div
          className="offer-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="offer-session-title"
        >
          <div className="offer-modal-card">
            <button
              type="button"
              className="offer-modal-close"
              aria-label={t('btnClose')}
              onClick={() => requestCancelOffer()}
            >
              ×
            </button>
            <h2 id="offer-session-title">{t('offerSessionTitle')}</h2>
            {session.altar ? (
              <>
                <p className="offer-session-label">{t('altarLabel')}</p>
                <AltarDetails altar={session.altar} />
              </>
            ) : (
              <p className="offer-session-note offer-session-original">
                {session.note.trim() || t('offeringFallback')}
              </p>
            )}
            {session.extraNote ? (
              <>
                <p className="offer-session-label">
                  {t('reofferExtraNoteLabel')}
                </p>
                <p className="offer-session-note offer-session-extra">
                  {session.extraNote}
                </p>
              </>
            ) : null}
            <p className="offer-session-status" aria-live="polite">
              {buttonLabel}
            </p>
            {mineStartedAt != null ? (
              <p
                className="mine-progress offer-session-elapsed"
                aria-live="polite"
              >
                {t('miningElapsed', { elapsed: elapsedDisplay })}
              </p>
            ) : null}
            <p className="hint eta">{t('etaEstimated', { eta: etaLabel })}</p>
            <p className="hint">{t('hintKeepScreen')}</p>
            {cancelLoseConfirm ? (
              <div className="offer-cancel-confirm" role="alertdialog">
                <p>
                  {pendingMemorial
                    ? t('cancelLoseOfferMsg')
                    : t('cancelOfferMsg')}
                </p>
                <div className="offer-cancel-confirm-actions">
                  <button
                    type="button"
                    className="btn btn-session-cancel"
                    onClick={() => setCancelLoseConfirm(false)}
                  >
                    {t('btnKeepOffering')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-confirm-lose"
                    onClick={() => void onCancelMine()}
                  >
                    {pendingMemorial
                      ? t('btnConfirmLoseOffer')
                      : t('btnConfirmCancel')}
                  </button>
                </div>
              </div>
            ) : showCancel ? (
              <div className="offer-actions offer-session-actions">
                <button
                  type="button"
                  className="btn btn-session-cancel"
                  onClick={() => requestCancelOffer()}
                >
                  {t('btnCancel')}
                </button>
              </div>
            ) : null}
            {msg ? <div className={`msg ${msg.kind}`}>{msg.text}</div> : null}
          </div>
        </div>
      ) : null}

      {busy && session && !session.reoffer ? (
        <div
          className="offer-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="offer-session-title"
        >
          <div className="offer-modal-card">
            <button
              type="button"
              className="offer-modal-close"
              aria-label={t('btnClose')}
              onClick={() => requestCancelOffer()}
            >
              ×
            </button>
            <h2 id="offer-session-title">{t('offerSessionTitle')}</h2>
            {session.altar ? (
              <>
                <p className="offer-session-label">{t('altarLabel')}</p>
                <AltarDetails altar={session.altar} />
              </>
            ) : (
              <>
                <p className="offer-session-label">{t('sessionNoteLabel')}</p>
                <p className="offer-session-note">
                  {session.note.trim() || t('offeringFallback')}
                </p>
              </>
            )}
            <p className="offer-session-status" aria-live="polite">
              {buttonLabel}
            </p>
            {mineStartedAt != null ? (
              <p
                className="mine-progress offer-session-elapsed"
                aria-live="polite"
              >
                {t('miningElapsed', { elapsed: elapsedDisplay })}
              </p>
            ) : null}
            <p className="hint eta">{t('etaEstimated', { eta: etaLabel })}</p>
            <p className="hint">{t('hintKeepScreen')}</p>
            {cancelLoseConfirm ? (
              <div className="offer-cancel-confirm" role="alertdialog">
                <p>
                  {pendingMemorial
                    ? t('cancelLoseOfferMsg')
                    : t('cancelOfferMsg')}
                </p>
                <div className="offer-cancel-confirm-actions">
                  <button
                    type="button"
                    className="btn btn-session-cancel"
                    onClick={() => setCancelLoseConfirm(false)}
                  >
                    {t('btnKeepOffering')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-confirm-lose"
                    onClick={() => void onCancelMine()}
                  >
                    {pendingMemorial
                      ? t('btnConfirmLoseOffer')
                      : t('btnConfirmCancel')}
                  </button>
                </div>
              </div>
            ) : showCancel ? (
              <div className="offer-actions offer-session-actions">
                <button
                  type="button"
                  className="btn btn-session-cancel"
                  onClick={() => requestCancelOffer()}
                >
                  {t('btnCancel')}
                </button>
              </div>
            ) : null}
            {msg ? <div className={`msg ${msg.kind}`}>{msg.text}</div> : null}
          </div>
        </div>
      ) : null}

      <footer className="footer">
        {t('footerBrand')} ·{' '}
        <a href="https://wlotus.org">wlotus.org</a>
      </footer>
    </div>
  );
}
