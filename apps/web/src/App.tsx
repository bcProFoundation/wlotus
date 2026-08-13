import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { LangSwitch } from './components/LangSwitch.js';
import { AltarDetails, type RelatedAltarOption } from './components/AltarDetails.js';
import { AltarSetupModal } from './components/AltarSetupModal.js';
import { BrandMark } from './components/BrandMark.js';
import {
  OpenInBrowserGate,
  useShareInAppBrowserGate,
} from './components/OpenInBrowserGate.js';
import { SearchOverlay } from './components/SearchOverlay.js';
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
  encodeDeathDateNote,
  encodeRelationshipNote,
  formatAltarPersonName,
  isAltarPackedNote,
  memorialDisplayName,
  memorialNoteMaxBytes,
  mergeAltarFields,
  altarHasDeathDate,
  altarRelationships,
  normalizeAltarRelatedTxid,
  normalizeAltarRelationshipType,
  parseAltarNote,
  type AltarFields,
  type AltarRelationshipType,
} from './lib/altarFields.js';
import {
  cancelOfferChallenge,
  completeOfferBurn,
  fetchChallenge,
  fetchRootCreator,
  fetchStatus,
  shortTx,
  submitMinedOffer,
} from './lib/offerApi.js';
import {
  isLocalCreatedRoot,
  markLocalCreatedRoot,
} from './lib/createdRoots.js';

import { mineInWorker } from './lib/mineRunner.js';
import { MineElapsedClock } from './lib/mineElapsedClock.js';
import { waitMinPray } from './lib/minPraySeconds.js';
import {
  findSpecialForParent,
  specialOfferButtonKind,
  specialSessionTitle,
  specialStoryForLocale,
  specialHidesAltarSectionLabel,
  rankTempleSpecials,
  formatSpecialEventDateLabel,
  specialCountdown,
  filterSpecialsForViewer,
  type TempleSpecialsStatusUi,
} from './lib/specialsUi.js';
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
  searchIndexMemorials,
  type IndexMemorialGroup,
} from './lib/danaIndexApi.js';
import {
  mergeSearchResults,
  rankSearchCandidates,
  type SearchCandidate,
  type SearchResultRow,
} from './lib/searchAltars.js';
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
  const { locale, countryCode, t } = useLocale();
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
    /** Names for relationship links (Recent + index lookups). */
    relatedOptions: RelatedAltarOption[];
    /** Soft ownership — creator may first-offer with mandatory death date. */
    isCreator: boolean;
  } | null>(null);
  /**
   * Edit sheet for an EXISTING altar — relationship or death-date star
   * fragment under the same root. Open for now; see docs/ALTAR.md.
   */
  const [amendSheet, setAmendSheet] = useState<{
    parentBurnTxid: string;
    altar: AltarFields;
    kind: 'relationship' | 'death';
  } | null>(null);
  /** rootBurnTxid → this installId is soft creator (API + local cache). */
  const [creatorByRoot, setCreatorByRoot] = useState<Map<string, boolean>>(
    () => new Map(),
  );
  const [phase, setPhase] = useState<Phase>('idle');
  const [msg, setMsg] = useState<Msg>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [templeSpecials, setTempleSpecials] = useState<TempleSpecialsStatusUi | null>(null);
  /** profileId → offering count for home event ranking. */
  const [specialOfferCounts, setSpecialOfferCounts] = useState<
    Record<string, number>
  >({});
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
  /** Active offer overlay (new setup, re-offer, or amend) — keeps timer/cancel on screen. */
  const [session, setSession] = useState<{
    reoffer: boolean;
    /** Root Ban thờ setup (not a flower re-offer). */
    setup?: boolean;
    note: string;
    /** Structured altar shown during the offer session (new dedications). */
    altar?: AltarFields | null;
    /** Optional remembrance words on a re-offer (on-chain DANA v2 note). */
    extraNote?: string;
    /** Related-altar labels/titles for relationship rows during the session. */
    relatedOptions?: RelatedAltarOption[];
    /** Parent dedication burn when this session is a re-offer / special. */
    parentBurnTxid?: string;
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
  /**
   * After a root setup burn, if the relationship did not fit on the root note
   * (or would have forced dropping places), queue a relationship star fragment.
   */
  const pendingRelationshipFollowUpRef = useRef<{
    parentBurnTxid: string;
    relationshipType: Exclude<AltarRelationshipType, ''>;
    relatedTxid: string;
    displayNote: string;
    altar: AltarFields;
  } | null>(null);
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
  /** Search by name — icon to the left of the language switch. */
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchGenRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  /** EN stays dark; VI/ZH use temple browse (wood), dark during the offer ritual. */
  useEffect(() => {
    const warmBrowse = locale === 'vi' || locale === 'zh';
    const theme = warmBrowse && !busy ? 'temple' : 'dark';
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.locale = locale;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const color =
        theme !== 'temple' ? '#050505' : locale === 'zh' ? '#1c120c' : '#f3ebe0';
      meta.setAttribute('content', color);
    }
  }, [locale, busy]);

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
      setTempleSpecials(s.templeSpecials ?? null);
      setApiOnline(true);
    } catch {
      setApiOnline(false);
      setRemaining(null);
      setTempleSpecials(null);
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
    pendingRelationshipFollowUpRef.current = null;
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
    /**
     * Star-fragment under an existing altar (parent = root).
     * `relationship` = link only; `death` = death date for a living profile.
     */
    amend?: boolean | 'relationship' | 'death';
    /** Related-altar meta for session AltarDetails (names + honorifics). */
    relatedOptions?: RelatedAltarOption[];
  }) {
    const parentBurnTxid = opts?.parentBurnTxid?.trim() || undefined;
    const amendKind =
      opts?.amend === true
        ? 'relationship'
        : opts?.amend === 'relationship' || opts?.amend === 'death'
          ? opts.amend
          : null;
    const isAmend = Boolean(parentBurnTxid) && Boolean(amendKind);
    const isReoffer = Boolean(parentBurnTxid) && !isAmend;
    const extraNote = isReoffer
      ? (opts?.extraNote ?? '').trim()
      : undefined;
    let challengeNote: string;
    let historyNote: string;
    const activeAltar = !isReoffer ? (opts?.altar ?? altar) : null;

    // Death-date and relationship amends: same installId soft ownership as mint-api.
    if (isAmend && parentBurnTxid) {
      const rootKey = parentBurnTxid.toLowerCase();
      const allowed =
        creatorByRoot.get(rootKey) === true || isLocalCreatedRoot(rootKey);
      if (!allowed) {
        setMsg({
          kind: 'err',
          text:
            amendKind === 'death'
              ? t('firstOfferDeathHint')
              : t('amendRelationshipCreatorOnly'),
        });
        return;
      }
    }

    if (isReoffer) {
      if (opts?.altar && !altarHasDeathDate(opts.altar)) {
        setMsg({ kind: 'err', text: t('firstOfferDeathHint') });
        return;
      }
      // Re-offer: parent txid only + optional extra memorial message.
      challengeNote = extraNote ?? '';
      historyNote = (opts?.displayNote ?? '').trim();
    } else if (isAmend && amendKind === 'death' && activeAltar) {
      try {
        challengeNote = encodeDeathDateNote(
          {
            deathDate: activeAltar.deathDate,
            deathPlace: activeAltar.deathPlace,
            funeralPlace: activeAltar.funeralPlace,
          },
          { maxBytes: memorialNoteMaxBytes(true) },
        );
      } catch {
        setMsg({ kind: 'err', text: t('altarErrDeathDate') });
        return;
      }
      historyNote =
        formatAltarPersonName(activeAltar, locale) ||
        (opts?.displayNote ?? '').trim() ||
        t('offeringFallback');
    } else if (isAmend && activeAltar) {
      // Relationship fragment: do not re-pack name/places/dates.
      try {
        challengeNote = encodeRelationshipNote(
          {
            relationshipType: activeAltar.relationshipType,
            relatedTxid: activeAltar.relatedTxid,
          },
          { maxBytes: memorialNoteMaxBytes(true) },
        );
      } catch {
        setMsg({ kind: 'err', text: t('altarErrRelatedTxid') });
        return;
      }
      historyNote =
        formatAltarPersonName(activeAltar, locale) ||
        (opts?.displayNote ?? '').trim() ||
        t('offeringFallback');
    } else if (activeAltar) {
      const maxBytes = memorialNoteMaxBytes(Boolean(parentBurnTxid));
      const wantedType = normalizeAltarRelationshipType(
        activeAltar.relationshipType,
      );
      const wantedTxid = normalizeAltarRelatedTxid(activeAltar.relatedTxid);
      const wantsRel = Boolean(wantedType && wantedTxid);
      const rootOnly: AltarFields = {
        ...activeAltar,
        relationshipType: '',
        relatedTxid: '',
      };
      try {
        const packedRoot = encodeAltarNote(rootOnly, { maxBytes });
        let usePacked = packedRoot;
        let queueRelFollowUp = false;
        if (wantsRel) {
          const withRel = encodeAltarNote(activeAltar, { maxBytes });
          const parsedRel = parseAltarNote(withRel);
          const relKept =
            parsedRel?.relationshipType === wantedType &&
            parsedRel?.relatedTxid === wantedTxid;
          if (relKept) {
            const rootParsed = parseAltarNote(packedRoot);
            const placesLost =
              (rootParsed?.deathPlace || '') !==
                (parsedRel?.deathPlace || '') ||
              (rootParsed?.birthPlace || '') !==
                (parsedRel?.birthPlace || '') ||
              (rootParsed?.funeralPlace || '') !==
                (parsedRel?.funeralPlace || '') ||
              (rootParsed?.note || '') !== (parsedRel?.note || '');
            if (placesLost) {
              // Keep full places on the root; link via star fragment next.
              queueRelFollowUp = true;
            } else {
              usePacked = withRel;
            }
          } else {
            queueRelFollowUp = true;
          }
        }
        challengeNote = usePacked;
        if (queueRelFollowUp && wantedType && wantedTxid) {
          // parentBurnTxid filled after the root burn succeeds.
          pendingRelationshipFollowUpRef.current = {
            parentBurnTxid: '',
            relationshipType: wantedType,
            relatedTxid: wantedTxid,
            displayNote: '',
            altar: activeAltar,
          };
        } else {
          pendingRelationshipFollowUpRef.current = null;
        }
      } catch (e) {
        pendingRelationshipFollowUpRef.current = null;
        const raw = e instanceof Error ? e.message : '';
        const overBudget = raw.includes('OP_RETURN budget');
        setMsg({
          kind: 'err',
          text: overBudget
            ? t('altarErrOpreturn')
            : raw.includes('name')
              ? t('altarErrName')
              : t('altarErrDeathDate'),
        });
        return;
      }
      historyNote =
        formatAltarPersonName(activeAltar, locale) ||
        memorialDisplayName(challengeNote, locale);
      if (pendingRelationshipFollowUpRef.current) {
        pendingRelationshipFollowUpRef.current.displayNote = historyNote;
      }
    } else {
      challengeNote = note.trim();
      historyNote = note.trim();
    }

    setDedicationSheet(null);
    setCancelLoseConfirm(false);
    const sessionAltar =
      isReoffer
        ? (opts?.altar ?? null)
        : activeAltar
          ? {
              ...activeAltar,
              // Fold draft singular link into relationships so session UI shows it.
              relationships: altarRelationships(activeAltar),
            }
          : null;
    // Seed with caller options (dedication sheet may already have index names)
    // or Recent; hydrate missing related altars from dana-index like the detail page.
    const seedRelated = opts?.relatedOptions ?? relatedAltarOptions;
    setSession({
      reoffer: isReoffer,
      setup: !isReoffer && !isAmend,
      note: historyNote,
      altar: sessionAltar,
      extraNote: extraNote || undefined,
      relatedOptions: seedRelated,
      parentBurnTxid,
    });
    if (sessionAltar) {
      void resolveRelatedOptions(sessionAltar, seedRelated).then(related => {
        setSession(prev =>
          prev && prev.altar === sessionAltar
            ? { ...prev, relatedOptions: related }
            : prev,
        );
      });
    }
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
          if (!parentBurnTxid && burnTxid) {
            markLocalCreatedRoot(burnTxid);
            setCreatorByRoot(prev => {
              const next = new Map(prev);
              next.set(burnTxid.trim().toLowerCase(), true);
              return next;
            });
            const follow = pendingRelationshipFollowUpRef.current;
            if (follow && !follow.parentBurnTxid) {
              pendingRelationshipFollowUpRef.current = {
                ...follow,
                parentBurnTxid: burnTxid,
              };
            }
          } else if (isAmend && amendKind === 'relationship') {
            pendingRelationshipFollowUpRef.current = null;
            // Open profile/Ban thờ from local burns so the new link shows
            // immediately (dana-index may lag by minutes).
            if (parentBurnTxid) {
              const root = parentBurnTxid;
              const note = historyNote;
              queueMicrotask(() => {
                void openDedicationSheet({
                  parentBurnTxid: root,
                  memorialNote: note,
                });
              });
            }
          }
          setNote('');
          setAltar(null);
          void notifyIndexBurn(burnTxid);
          await refreshStatus();
          const offeredFor =
            memorialDisplayName(historyNote, localeRef.current) ||
            memorialDisplayName(challengeNote, localeRef.current) ||
            tRef.current('offeringFallback');
          const duration = formatActualDurationLocale(
            uiPowMs / 1000,
            localeRef.current,
          );
          setMsg({
            kind: 'success',
            text:
              !isReoffer && !isAmend
                ? tRef.current('setupDoneIn', {
                    duration,
                    name: offeredFor,
                  })
                : tRef.current('offeredIn', {
                    duration,
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
          if (!pendingRelationshipFollowUpRef.current?.parentBurnTxid) {
            pendingRelationshipFollowUpRef.current = null;
          }
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
        const follow = pendingRelationshipFollowUpRef.current;
        if (follow?.parentBurnTxid) {
          pendingRelationshipFollowUpRef.current = null;
          queueMicrotask(() => {
            void onOffer({
              parentBurnTxid: follow.parentBurnTxid,
              displayNote: follow.displayNote,
              altar: {
                ...follow.altar,
                relationshipType: follow.relationshipType,
                relatedTxid: follow.relatedTxid,
              },
              amend: 'relationship',
              relatedOptions: relatedAltarOptions,
            });
          });
        }
      }
    }
  }

  useEffect(() => {
    const lock = Boolean(
      busy ||
        dedicationSheet ||
        historyGroup ||
        altarOpen ||
        amendSheet ||
        searchOpen,
    );
    document.body.style.overflow = lock ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [busy, dedicationSheet, historyGroup, altarOpen, amendSheet, searchOpen]);

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

  /** Merged Ban thờ fields from local burns under a Recent group. */
  function altarFromOfferGroup(g: OfferGroup): AltarFields {
    const notes = g.burns
      .map(b => (b.note || '').trim())
      .filter(Boolean);
    return mergeAltarFields(notes) ?? altarFromMemorialNote(g.note);
  }

  /** Persist index burns for a dedication so Recent total matches History. */
  function persistMemorialSync(remote: IndexMemorialGroup): LocalOffer[] {
    const next = syncIndexMemorialIntoLocal(loadOffers(), remote);
    localStorage.setItem(LOCAL_OFFERS_KEY, JSON.stringify(next));
    setOffers(next);
    return next;
  }

  /**
   * Merge altar-packed burns under a star (latest-first). Relationship
   * fragments carry only the link; identity/places come from the root.
   * `remote.burns` is latest-first.
   */
  function pickDisplayAltarFields(
    remote: IndexMemorialGroup,
  ): AltarFields | null {
    const notes: string[] = [];
    for (const b of remote.burns) {
      const n = (b.note || '').trim();
      if (n) notes.push(n);
    }
    const original = (remote.originalNote || '').trim();
    if (original) notes.push(original);
    const latest = (remote.latestNote || '').trim();
    if (latest) notes.push(latest);
    return mergeAltarFields(notes);
  }

  function pickDisplayAltarNote(remote: IndexMemorialGroup): string {
    for (const b of remote.burns) {
      const n = (b.note || '').trim();
      if (isAltarPackedNote(n)) return n;
    }
    return (remote.originalNote || remote.latestNote || '').trim();
  }

  async function resolveRelatedOptions(
    altarFields: AltarFields,
    base: RelatedAltarOption[],
  ): Promise<RelatedAltarOption[]> {
    const byTxid = new Map(base.map(o => [o.txid, o]));
    for (const link of altarRelationships(altarFields)) {
      if (byTxid.has(link.relatedTxid)) continue;
      try {
        const g = await fetchIndexMemorial(link.relatedTxid);
        const fields = pickDisplayAltarFields(g);
        const label =
          (fields
            ? formatAltarPersonName(fields, locale)
            : memorialDisplayName(
                g.originalNote || g.latestNote || '',
                locale,
              )) || t('altarViewRelated');
        byTxid.set(link.relatedTxid, {
          txid: link.relatedTxid,
          label,
          title: fields?.title,
          birthYear: fields?.birthYear,
        });
      } catch {
        byTxid.set(link.relatedTxid, {
          txid: link.relatedTxid,
          label: t('altarViewRelated'),
        });
      }
    }
    return [...byTxid.values()];
  }

  /** Open re-offer / profile sheet; sync History burns into Recent; hydrate fields. */
  async function openDedicationSheet(opts: {
    parentBurnTxid: string;
    memorialNote: string;
  }) {
    let memorialNote = opts.memorialNote;
    const rootId = opts.parentBurnTxid.trim().toLowerCase();
    const localGroup = () =>
      groupOffersByOriginal(loadOffers()).find(
        g => g.original.burnTxid.trim().toLowerCase() === rootId,
      );
    const resolveLocal = (note: string): AltarFields => {
      const g = localGroup();
      return g ? altarFromOfferGroup(g) : altarFromMemorialNote(note);
    };

    // Show device burns immediately (relationship fragments are local before
    // dana-index catches up — often minutes later).
    let resolved = resolveLocal(memorialNote);
    let isCreator =
      isLocalCreatedRoot(rootId) || creatorByRoot.get(rootId) === true;
    setDedicationSheet({
      parentBurnTxid: opts.parentBurnTxid,
      altar: resolved,
      extraNote: '',
      relatedOptions: relatedAltarOptions,
      isCreator,
    });

    try {
      const remote = await fetchIndexMemorial(opts.parentBurnTxid);
      // Union into localStorage — keeps device-only relationship / death
      // fragments that the index has not indexed yet.
      persistMemorialSync(remote);
      resolved = resolveLocal(memorialNote);
    } catch {
      // Test / offline index: still hydrate full Ban thờ from chain.
      try {
        const { lookupDedication } = await import('./lib/lookupDedication.js');
        const d = await lookupDedication(opts.parentBurnTxid);
        const chainNote = d.note.trim();
        if (chainNote) {
          memorialNote = chainNote;
          if (!localGroup()) resolved = altarFromMemorialNote(memorialNote);
        }
      } catch {
        /* keep local */
      }
    }

    const relatedOptions = await resolveRelatedOptions(
      resolved,
      relatedAltarOptions,
    );
    try {
      const own = await fetchRootCreator({
        installId,
        rootBurnTxid: rootId,
      });
      isCreator = own.isCreator || isLocalCreatedRoot(rootId);
      setCreatorByRoot(prev => {
        const next = new Map(prev);
        next.set(rootId, isCreator);
        return next;
      });
    } catch {
      /* offline mint-api — local cache only */
    }
    setDedicationSheet(prev =>
      prev &&
      prev.parentBurnTxid.trim().toLowerCase() === rootId
        ? {
            ...prev,
            altar: resolved,
            relatedOptions,
            isCreator,
          }
        : prev,
    );
  }

  /** Follow a relationship link (Spouse / Parent / Child) to the linked altar. */
  async function viewRelatedAltar(relatedTxid: string) {
    setDedicationSheet(null);
    setAmendSheet(null);
    await openDedicationSheet({
      parentBurnTxid: relatedTxid,
      memorialNote: '',
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
  // Offering counts for temple specials (home top-5 ranking).
  useEffect(() => {
    const profiles = templeSpecials?.profiles ?? [];
    if (profiles.length === 0) {
      setSpecialOfferCounts({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const localByRoot = new Map<string, number>();
      for (const g of groupOffersByOriginal(offers)) {
        localByRoot.set(
          g.original.burnTxid.trim().toLowerCase(),
          g.totalBurns,
        );
      }
      const next: Record<string, number> = {};
      await Promise.all(
        profiles.map(async p => {
          const id = p.profileId.trim().toLowerCase();
          let n = localByRoot.get(id) ?? 0;
          try {
            const remote = await fetchIndexMemorial(p.profileId);
            if (
              typeof remote.totalBurns === 'number' &&
              remote.totalBurns > n
            ) {
              n = remote.totalBurns;
            }
          } catch {
            /* offline index — local only */
          }
          next[id] = n;
        }),
      );
      if (!cancelled) setSpecialOfferCounts(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [templeSpecials, offers]);

  const rankedHomeEvents = rankTempleSpecials(
    filterSpecialsForViewer(templeSpecials?.profiles, {
      countryCode,
      locale,
    }),
    specialOfferCounts,
    5,
  );

  const recentGroups = groupOffersByOriginal(offers).filter(
    g => !isRecentRootHidden(g.original.burnTxid, hiddenRecent),
  );

  // Soft-ownership prefetch for living profiles in Recent (creator sees Dâng hoa).
  useEffect(() => {
    let cancelled = false;
    const livingRoots = recentGroups
      .filter(g => !altarHasDeathDate(altarFromOfferGroup(g)))
      .map(g => g.original.burnTxid.trim().toLowerCase())
      .filter(txid => /^[0-9a-f]{64}$/.test(txid));
    void (async () => {
      for (const rootId of livingRoots) {
        if (cancelled) return;
        if (creatorByRoot.has(rootId)) continue;
        let isCreator = isLocalCreatedRoot(rootId);
        if (!isCreator) {
          try {
            const own = await fetchRootCreator({
              installId,
              rootBurnTxid: rootId,
            });
            isCreator = own.isCreator || isLocalCreatedRoot(rootId);
          } catch {
            /* keep local */
          }
        }
        if (cancelled) return;
        setCreatorByRoot(prev => {
          if (prev.has(rootId)) return prev;
          const next = new Map(prev);
          next.set(rootId, isCreator);
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Prefetch when the living-root set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    recentGroups
      .filter(g => !altarHasDeathDate(altarFromOfferGroup(g)))
      .map(g => g.original.burnTxid)
      .join('|'),
    installId,
  ]);

  /**
   * Relationship links only pick from this device's Recent list (no free-text
   * txid entry) — simpler and keeps the link to something the user actually
   * offered to. See docs/ALTAR.md "Relationships — open for now, restrict later".
   */
  const relatedAltarOptions = recentGroups.map(g => {
    const a = altarFromOfferGroup(g);
    return {
      txid: g.original.burnTxid,
      label: memorialDisplayName(g.note, locale) || t('offeringFallback'),
      title: a.title,
      birthYear: a.birthYear,
    };
  });

  /**
   * Search by name, ordered by relevance then offering score (`totalBurns`).
   * Prefers the public dana-index search (all users); falls back to / merges
   * with this device's Recent when the index is offline or has not indexed
   * a fresh burn yet.
   */
  async function fetchNameSearchRows(
    query: string,
  ): Promise<{ rows: SearchResultRow[]; indexUnavailable: boolean }> {
    const localCandidates: SearchCandidate[] = recentGroups.map(g => {
      const a = altarFromOfferGroup(g);
      const bareName = (a.name || a.note || '').trim();
      const name =
        formatAltarPersonName(a, locale) ||
        memorialDisplayName(g.note, locale) ||
        g.note.trim();
      return {
        txid: g.original.burnTxid,
        name,
        bareName: bareName || undefined,
        totalBurns: g.totalBurns,
        atMs: Date.parse(g.latest.at) || 0,
      };
    });
    const localRows = rankSearchCandidates(localCandidates, query);

    try {
      const indexGroups = await searchIndexMemorials(query, 20);
      const indexRows: SearchResultRow[] = indexGroups.map(g => ({
        txid: g.originalBurnTxid,
        label:
          memorialDisplayName(g.originalNote, locale) ||
          g.originalNote.trim() ||
          g.originalBurnTxid,
        totalBurns: g.totalBurns,
      }));
      return {
        rows: mergeSearchResults(indexRows, localRows),
        indexUnavailable: false,
      };
    } catch {
      return { rows: localRows, indexUnavailable: true };
    }
  }

  async function runSearch(query: string): Promise<void> {
    const gen = ++searchGenRef.current;
    setSearchLoading(true);
    setSearchError('');

    const { rows, indexUnavailable } = await fetchNameSearchRows(query);
    if (searchGenRef.current !== gen) return;
    setSearchResults(rows);
    setSearchError(indexUnavailable ? t('searchIndexUnavailable') : '');
    setSearchLoading(false);
  }

  function openSearch() {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError('');
    setSearchLoading(false);
    setSearchOpen(true);
  }

  function closeSearch() {
    searchGenRef.current += 1;
    if (searchTimerRef.current != null) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    setSearchOpen(false);
  }

  function onSearchQueryChange(value: string) {
    setSearchQuery(value);
    if (searchTimerRef.current != null) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    const q = value.trim();
    if (!q) {
      searchGenRef.current += 1;
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError('');
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      searchTimerRef.current = null;
      void runSearch(q);
    }, 350);
  }

  function onSearchSelect(txid: string) {
    closeSearch();
    void openDedicationSheet({ parentBurnTxid: txid, memorialNote: '' });
  }

  function onSearchAdd() {
    closeSearch();
    setAltarOpen(true);
  }

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
    const rootKey = g.original.burnTxid.trim().toLowerCase();
    setHistoryGroup(g);
    setHistoryError('');
    setHistoryLoading(true);
    try {
      const remote = await fetchIndexMemorial(g.original.burnTxid);
      const next = persistMemorialSync(remote);
      // mergeIndexAndLocalOffers returns ALL local groups sorted by latest —
      // pick this dedication, not merged[0] (that was always the newest altar).
      const merged = mergeIndexAndLocalOffers([remote], next);
      const match =
        merged.find(
          m => m.original.burnTxid.trim().toLowerCase() === rootKey,
        ) ?? g;
      setHistoryGroup(match);
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

  const activeSpecialForParent = findSpecialForParent(
    templeSpecials,
    linkedParentBurnTxid ?? session?.parentBurnTxid,
  );
  const specialBtn = specialOfferButtonKind(
    activeSpecialForParent?.active ? activeSpecialForParent : null,
  );
  const buttonLabel =
    phase === 'challenge' || phase === 'mining'
      ? t('btnPraying')
      : phase === 'holding' || phase === 'submit' || phase === 'burn'
        ? session?.setup
          ? t('btnSettingUp')
          : specialBtn === 'cung'
            ? t('btnCung')
            : t('btnOffering')
        : linkedParentBurnTxid
          ? specialBtn === 'cung'
            ? t('btnCung')
            : t('btnReoffer')
          : altar
            ? t('btnSetup')
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
            <BrandMark />
            <h1 className="brand">{t('brandWithLogo')}</h1>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="header-icon-btn"
              aria-label={t('searchTitle')}
              onClick={openSearch}
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
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm10 17-5.6-5.6"
                />
              </svg>
            </button>
            <LangSwitch />
          </div>
        </div>
        <p className="tagline">{t('tagline')}</p>
      </header>

      <section className="panel offer-panel">
        <h2>{t('offerTitle')}</h2>
        <p className="hint">
          {t('hintPrayMine', { ticker, max: maxOffersPerDay })}
        </p>

        <div className="field">
          {altar ? (
            <>
              <div className="field-label-row">
                <label>
                  {altarHasDeathDate(altar)
                    ? t('altarLabel')
                    : t('profileLabel')}
                </label>
                {!linkedParentBurnTxid ? (
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
                ) : null}
              </div>
              <AltarDetails
                altar={altar}
                specialKind={
                  findSpecialForParent(
                    templeSpecials,
                    linkedParentBurnTxid,
                  )?.kind ?? null
                }
                relatedAltarOptions={relatedAltarOptions}
              />
            </>
          ) : (
            <button
              type="button"
              className="btn btn-search-cta"
              disabled={busy || apiOnline === false}
              onClick={openSearch}
            >
              <svg
                className="btn-icon-svg"
                viewBox="0 0 24 24"
                width="22"
                height="22"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm10 17-5.6-5.6"
                />
              </svg>
              <span>{t('searchCta')}</span>
            </button>
          )}
        </div>

        {rankedHomeEvents.length > 0 ? (
          <div className="home-events" aria-label={t('homeEventsTitle')}>
            <h3 className="home-events-title">{t('homeEventsTitle')}</h3>
            <ul className="home-events-list">
              {rankedHomeEvents.map((ev, idx) => (
                <li key={ev.profileId} className="home-events-item">
                  <button
                    type="button"
                    className="home-events-btn"
                    disabled={busy || apiOnline === false}
                    onClick={() =>
                      void openDedicationSheet({
                        parentBurnTxid: ev.profileId,
                        memorialNote: ev.name || '',
                      })
                    }
                  >
                    <span className="home-events-rank">{idx + 1}</span>
                    <span className="home-events-main">
                      <span className="home-events-name">
                        {ev.name || ev.profileId.slice(0, 8)}
                      </span>
                      {(() => {
                        const cd = specialCountdown(ev);
                        // Active window: only status (“happening” / today)
                        if (cd.kind === 'ongoing') {
                          return (
                            <span className="home-events-date">
                              {t('homeEventsOngoing')}
                            </span>
                          );
                        }
                        if (cd.kind === 'today') {
                          return (
                            <span className="home-events-date">
                              {t('homeEventsToday')}
                            </span>
                          );
                        }
                        const dateLabel = formatSpecialEventDateLabel(
                          ev,
                          locale,
                        );
                        let when = '';
                        if (cd.kind === 'days') {
                          when = t('homeEventsDaysUntil', { n: cd.days });
                        } else if (cd.kind === 'past') {
                          when = t('homeEventsDaysPast', { n: cd.days });
                        }
                        if (!dateLabel && !when) return null;
                        return (
                          <span className="home-events-date">
                            {dateLabel}
                            {dateLabel && when ? ' · ' : ''}
                            {when}
                          </span>
                        );
                      })()}
                    </span>
                    <span className="home-events-count">
                      {t('homeEventsOfferings', { n: ev.offerCount })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {altar ? (
          <div className="offer-actions">
            <button
              id="offer-flower-btn"
              className="btn btn-primary btn-offer"
              disabled={!canOffer || shareLookingUp}
              onClick={() => {
                if (linkedParentBurnTxid) {
                  let memorialNote = note;
                  try {
                    memorialNote = encodeAltarNote(altar);
                  } catch {
                    memorialNote = altar.name;
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
        ) : null}

        {!busy && msg?.kind === 'success' ? (
          <div
            id="offer-success-msg"
            className={`msg ${msg.kind}`}
            role="status"
          >
            {msg.text}
          </div>
        ) : null}

        {shareLookingUp || linkedParentBurnTxid ? (
          <p className="hint share-hint">
            {shareLookingUp
              ? t('shareLookingUp')
              : t('shareLinked', {
                  name:
                    (altar
                      ? formatAltarPersonName(altar, locale)
                      : memorialDisplayName(note, locale)) ||
                    t('offeringFallback'),
                })}
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
              {
                title: t('howEternalTitle'),
                body: t('howEternalBody'),
              },
              {
                title: t('howEcashTitle'),
                body: t('howEcashBody'),
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

        {apiOnline === null || apiOnline === false ? (
          <p className="meta">
            {apiOnline === null ? t('connecting') : t('apiOffline')}
          </p>
        ) : null}

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
              const groupAltar = altarFromOfferGroup(g);
              const canReoffer = altarHasDeathDate(groupAltar);
              const rootKey = rootId.trim().toLowerCase();
              const isCreator =
                creatorByRoot.get(rootKey) === true ||
                isLocalCreatedRoot(rootKey);
              const showFirstOffer = !canReoffer && isCreator;
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
                        <button
                          type="button"
                          className="history-meta history-burns-link"
                          disabled={busy}
                          onClick={() => void openMemorialHistory(g)}
                        >
                          {canReoffer
                            ? t('burnTotal', { n: g.totalBurns })
                            : t('activityTotal', { n: g.totalBurns })}
                        </button>
                        <div className="history-row-actions">
                          {canReoffer ? (
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
                              <BrandMark badge width={28} height={28} />
                              <span>{t('btnReoffer')}</span>
                            </button>
                          ) : showFirstOffer ? (
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
                              <BrandMark badge width={28} height={28} />
                              <span>{t('btnOffer')}</span>
                            </button>
                          ) : null}
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
          relatedAltarOptions={relatedAltarOptions}
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
            void onOffer({
              altar: fields,
              relatedOptions: relatedAltarOptions,
            });
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
          <div className="offer-modal-card altar-setup-card altar-detail-card">
            <button
              type="button"
              className="offer-modal-close"
              aria-label={t('btnClose')}
              onClick={() => setDedicationSheet(null)}
            >
              ×
            </button>
            <h2 id="altar-detail-title">
              {(() => {
                const sp = findSpecialForParent(
                  templeSpecials,
                  dedicationSheet.parentBurnTxid,
                );
                if (sp && (sp.kind === 'event' || sp.kind === 'ghost')) {
                  return sp.name || t('altarDetailTitle');
                }
                return altarHasDeathDate(dedicationSheet.altar)
                  ? t('altarDetailTitle')
                  : t('profileDetailTitle');
              })()}
            </h2>
            <AltarDetails
              altar={dedicationSheet.altar}
              specialKind={
                findSpecialForParent(
                  templeSpecials,
                  dedicationSheet.parentBurnTxid,
                )?.kind ?? null
              }
              onViewRelated={txid => void viewRelatedAltar(txid)}
              relatedAltarOptions={dedicationSheet.relatedOptions}
            />
            {altarHasDeathDate(dedicationSheet.altar) ? (
              <>
                <div className="field dedication-extra-note-field">
                  <label htmlFor="dedication-extra-note">
                    {(() => {
                      const sp = findSpecialForParent(
                        templeSpecials,
                        dedicationSheet.parentBurnTxid,
                      );
                      if (sp && (sp.kind === 'ghost' || sp.kind === 'event')) {
                        return t('specialPrayerNoteLabel');
                      }
                      return t('reofferExtraNoteLabel');
                    })()}
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
                <p className="hint eta">
                  {t('etaEstimated', { eta: etaLabel })}
                </p>
                <div className="offer-actions offer-session-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-offer"
                    disabled={!canOffer}
                    onClick={() =>
                      void onOffer({
                        parentBurnTxid: dedicationSheet.parentBurnTxid,
                        displayNote:
                          formatAltarPersonName(
                            dedicationSheet.altar,
                            locale,
                          ) || t('offeringFallback'),
                        altar: dedicationSheet.altar,
                        extraNote: dedicationSheet.extraNote,
                        relatedOptions: dedicationSheet.relatedOptions,
                      })
                    }
                  >
                    {(() => {
                      const sp = findSpecialForParent(
                        templeSpecials,
                        dedicationSheet.parentBurnTxid,
                      );
                      if (sp?.kind === 'ghost' && sp.active) {
                        return t('btnCung');
                      }
                      return t('btnOffer');
                    })()}
                  </button>
                  {dedicationSheet.isCreator ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={!canOffer}
                      onClick={() =>
                        setAmendSheet({
                          parentBurnTxid: dedicationSheet.parentBurnTxid,
                          altar: dedicationSheet.altar,
                          kind: 'relationship',
                        })
                      }
                    >
                      {t('btnAmendAltar')}
                    </button>
                  ) : null}
                </div>
              </>
            ) : dedicationSheet.isCreator ? (
              <>
                <p className="hint">{t('firstOfferDeathHint')}</p>
                <p className="hint eta">
                  {t('etaEstimated', { eta: etaLabel })}
                </p>
                <div className="offer-actions offer-session-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-offer"
                    disabled={!canOffer}
                    onClick={() =>
                      setAmendSheet({
                        parentBurnTxid: dedicationSheet.parentBurnTxid,
                        altar: dedicationSheet.altar,
                        kind: 'death',
                      })
                    }
                  >
                    {t('btnOffer')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={!canOffer}
                    onClick={() =>
                      setAmendSheet({
                        parentBurnTxid: dedicationSheet.parentBurnTxid,
                        altar: dedicationSheet.altar,
                        kind: 'relationship',
                      })
                    }
                  >
                    {t('btnAmendAltar')}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {amendSheet && !busy ? (
        <AltarSetupModal
          variant={amendSheet.kind === 'death' ? 'death' : 'relationship'}
          initial={amendSheet.altar}
          etaLabel={etaLabel}
          offerDisabled={!canOffer || shareLookingUp}
          relatedAltarOptions={
            // Prefer dedication-sheet enriched names, then device Recent.
            (dedicationSheet?.parentBurnTxid === amendSheet.parentBurnTxid
              ? dedicationSheet.relatedOptions
              : relatedAltarOptions
            ).filter(o => o.txid !== amendSheet.parentBurnTxid)
          }
          onClose={() => setAmendSheet(null)}
          onSave={() => {}}
          onOffer={fields => {
            const parentBurnTxid = amendSheet.parentBurnTxid;
            const kind = amendSheet.kind;
            const sessionRelatedOptions = (
              dedicationSheet?.parentBurnTxid === amendSheet.parentBurnTxid
                ? dedicationSheet.relatedOptions
                : relatedAltarOptions
            ).filter(o => o.txid !== amendSheet.parentBurnTxid);
            setAmendSheet(null);
            setDedicationSheet(null);
            if (kind === 'death') {
              void onOffer({
                parentBurnTxid,
                displayNote:
                  formatAltarPersonName(amendSheet.altar, locale) ||
                  t('offeringFallback'),
                altar: {
                  ...amendSheet.altar,
                  deathDate: fields.deathDate,
                  deathPlace: fields.deathPlace,
                  funeralPlace: fields.funeralPlace,
                },
                amend: 'death',
                relatedOptions: sessionRelatedOptions,
              });
              return;
            }
            void onOffer({
              parentBurnTxid,
              displayNote:
                formatAltarPersonName(amendSheet.altar, locale) ||
                t('offeringFallback'),
              altar: {
                ...amendSheet.altar,
                relationshipType: fields.relationshipType,
                relatedTxid: fields.relatedTxid,
              },
              amend: 'relationship',
              relatedOptions: sessionRelatedOptions,
            });
          }}
        />
      ) : null}

      {searchOpen ? (
        <SearchOverlay
          query={searchQuery}
          onQueryChange={onSearchQueryChange}
          results={searchResults}
          loading={searchLoading}
          error={searchError}
          onSelect={onSearchSelect}
          onAdd={onSearchAdd}
          addDisabled={busy || apiOnline === false}
          onClose={closeSearch}
        />
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
            <h2 id="memorial-history-title">
              {altarHasDeathDate(altarFromOfferGroup(historyGroup))
                ? t('historyTitle')
                : t('historyActivityTitle')}
            </h2>
            <p className="offer-session-note offer-session-original">
              {memorialDisplayName(historyGroup.note, locale) ||
                t('offeringFallback')}
            </p>
            <p className="hint">
              {altarHasDeathDate(altarFromOfferGroup(historyGroup))
                ? t('burnTotal', { n: historyGroup.totalBurns })
                : t('activityTotal', { n: historyGroup.totalBurns })}
              {historyLoading ? ` · ${t('historyLoading')}` : ''}
            </p>
            {historyError ? (
              <div className="msg hint-inline">{historyError}</div>
            ) : null}
            <ul className="memorial-history-list">
              {historyGroup.burns.map(b => {
                const noteText = (b.note || '').trim()
                  ? memorialDisplayName(b.note, locale)
                  : !b.parentBurnTxid
                    ? memorialDisplayName(historyGroup.note, locale) ||
                      t('offeringFallback')
                    : '';
                return (
                  <li key={b.burnTxid}>
                    <div className="memorial-history-main">
                      <span className="memorial-history-note">
                        <BrandMark badge width={28} height={28} />
                        {noteText ? (
                          <span className="memorial-history-note-text">
                            {noteText}
                          </span>
                        ) : null}
                      </span>
                      <ExplorerLinkIcon
                        txid={b.burnTxid}
                        label={t('openOnExplorer')}
                      />
                    </div>
                    <span className="history-meta">
                      {new Date(b.at).toLocaleString(locale)}
                      {!b.parentBurnTxid
                        ? ` · ${t('originalBurnBadge')}`
                        : ''}
                    </span>
                  </li>
                );
              })}
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
          <div className="offer-modal-card offer-session-card">
            <button
              type="button"
              className="offer-modal-close"
              aria-label={t('btnClose')}
              onClick={() => requestCancelOffer()}
            >
              ×
            </button>
            <h2 id="offer-session-title" className="offer-session-title">
              <BrandMark badge className="offer-session-title-mark" width={28} height={28} />
              <span>{
                specialSessionTitle(
                  findSpecialForParent(templeSpecials, session?.parentBurnTxid),
                  locale,
                ) || t('offerSessionTitle')
              }</span>
            </h2>
            <div className="offer-session-body">
              {(() => {
                const st = specialStoryForLocale(
                  findSpecialForParent(
                    templeSpecials,
                    session.parentBurnTxid,
                  ),
                  locale,
                );
                if (!st) return null;
                return (
                  <div className="temple-story" key="temple-story">
                    <p className="temple-story-heading">{t('specialStoryHeading')}</p>
                    <p className="temple-story-hint">{t('specialStoryHint')}</p>
                    {st.title ? (
                      <h3 className="temple-story-title">{st.title}</h3>
                    ) : null}
                    {st.body.split('\n').map((para, i) =>
                      para.trim() ? (
                        <p key={i} className="temple-story-para">
                          {para}
                        </p>
                      ) : null,
                    )}
                  </div>
                );
              })()}
              {session.altar ? (
                <>
                  {(() => {
                    const sp = findSpecialForParent(
                      templeSpecials,
                      session.parentBurnTxid,
                    );
                    const hideLabel = specialHidesAltarSectionLabel(sp);
                    return (
                      <>
                        {!hideLabel ? (
                          <p className="offer-session-label">
                            {session.altar &&
                            !altarHasDeathDate(session.altar)
                              ? t('profileLabel')
                              : t('altarLabel')}
                          </p>
                        ) : null}
                        <AltarDetails
                          altar={session.altar}
                          specialKind={sp?.kind ?? null}
                          relatedAltarOptions={
                            session.relatedOptions ?? relatedAltarOptions
                          }
                        />
                      </>
                    );
                  })()}
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
            </div>
            <div className="offer-session-footer">
              <div className="offer-session-status-row" aria-live="polite">
                <p className="offer-session-status">{buttonLabel}</p>
                {mineStartedAt != null ? (
                  <p className="mine-progress offer-session-elapsed">
                    {t('miningElapsed', { elapsed: elapsedDisplay })}
                  </p>
                ) : null}
              </div>
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
              ) : null}
              {msg ? <div className={`msg ${msg.kind}`}>{msg.text}</div> : null}
            </div>
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
          <div className="offer-modal-card offer-session-card">
            <button
              type="button"
              className="offer-modal-close"
              aria-label={t('btnClose')}
              onClick={() => requestCancelOffer()}
            >
              ×
            </button>
            <h2 id="offer-session-title" className="offer-session-title">
              <BrandMark badge className="offer-session-title-mark" width={28} height={28} />
              <span>
                {session.setup
                  ? t('setupSessionTitle')
                  : specialSessionTitle(
                      findSpecialForParent(
                        templeSpecials,
                        session.parentBurnTxid,
                      ),
                      locale,
                    ) || t('offerSessionTitle')}
              </span>
            </h2>
            <div className="offer-session-body">
              {session.altar ? (
                <>
                  {(() => {
                    const sp = findSpecialForParent(
                      templeSpecials,
                      session.parentBurnTxid,
                    );
                    const hideLabel = specialHidesAltarSectionLabel(sp);
                    return (
                      <>
                        {!hideLabel ? (
                          <p className="offer-session-label">
                            {session.altar &&
                            !altarHasDeathDate(session.altar)
                              ? t('profileLabel')
                              : t('altarLabel')}
                          </p>
                        ) : null}
                        <AltarDetails
                          altar={session.altar}
                          specialKind={sp?.kind ?? null}
                          relatedAltarOptions={
                            session.relatedOptions ?? relatedAltarOptions
                          }
                        />
                      </>
                    );
                  })()}
                </>
              ) : (
                <>
                  <p className="offer-session-label">{t('sessionNoteLabel')}</p>
                  <p className="offer-session-note">
                    {session.note.trim() || t('offeringFallback')}
                  </p>
                </>
              )}
            </div>
            <div className="offer-session-footer">
              <div className="offer-session-status-row" aria-live="polite">
                <p className="offer-session-status">{buttonLabel}</p>
                {mineStartedAt != null ? (
                  <p className="mine-progress offer-session-elapsed">
                    {t('miningElapsed', { elapsed: elapsedDisplay })}
                  </p>
                ) : null}
              </div>
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
              ) : null}
              {msg ? <div className={`msg ${msg.kind}`}>{msg.text}</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      <footer className="footer">
        <span className="brand brand--footer">
          <span className="brand-letter">{t('footerBrand').charAt(0)}</span>
          {t('footerBrand').slice(1)}
        </span>{' '}
        ·{' '}
        <a href="https://wlotus.org">wlotus.org</a>
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
      </footer>
    </div>
  );
}
