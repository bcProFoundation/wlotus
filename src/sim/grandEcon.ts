/**
 * Two-tier elastic family (ELOTUS v4 research simulator) — PURE.
 *
 * Production-intent family: ELOTUS base (1x) + Grand Lotus GLOTUS
 * (1000x). Demand is ONE fungible pool (base-$); tickets route by
 * size (whaleShare exogenous — fee-efficient rails, big tickets to
 * grand) with shortfall-pattern spillover between rails (1-slot info lag,
 * capped by receiving-side miner slack AND baton caps: tokens are
 * free, miners and listed batons aren't). Deployment is INSTANT
 * (seconds << 10-min slot, per user: tokens "issued when needed,
 * then stay there") — capacity always meets need same-slot, tokens
 * persist (count never decreases). The honest frictions left: slot
 * granularity + miner REACTION lag (large miners re-route cross-tier
 * with tauReact delay) + miner population bounds (hardware sticky
 * short-run — fixture).
 *
 * Entry responds to EXPECTED TRADE price (D/races), never par: thin
 * tiers solo-mine profitably (grand's $10 flow staffs M*=1 at +$2.86,
 * not M*=139 at −$288 — par-implied staffing is collective suicide
 * and large miners rationally abandon it). Shortage races staff
 * UP (premium-chasing entry, partial self-correction). Large miners
 * route greedily by absolute $/miner (grand-first while rents last,
 * reaction-lagged); small miners are base-only (float-locked).
 * Within a tier: pro-rata rationing + water-fill spread (large extras
 * fill from race 0 up, small extras from the top down — never double
 * cover while races sit empty). Pricing clears P = D_eff/blocks per
 * tier (two-pass: native allocation, then spill top-up).
 *
 * VINTAGE ROTATION (emergent headline): miners always mine the
 * cheapest-Wc token, and instant deployment means fresh-at-Wc0 clones
 * are always available — so the family NEVER treadmills (aggregate
 * Wc stays ~Wc0, M* ~139 forever, inclusion preserved). Per-token
 * treadmill still kills stale instances (abandoned dust); the family
 * outlives it by rotation. Rotation ALSO scales (need beyond listed
 * tokens spills to implicit fresh clones). The G6b control (rotation
 * banned) rederives v2's premium regime as the no-deployment limit:
 * permanent 3.21x wall + thin grand standby-idle with $~3.1M
 * unfilled
 * (no room to spill — wall binds all). G6c (roomy listed base) shows
 * the spill rescue instead ($3.1M carried, par holds). Premium =
 * f(friction), unified across v2-v4. Par-gating makes discounts
 * structurally impossible: premium-only above par, never below.
 *
 * SOUND-DEPLOYER ASSUMPTION (boundary, not derived): fresh clones
 * launch at Wc0-hash (norm). Permissionless deployment otherwise
 * admits a race-to-bottom (cheap clone drains par family —
 * Gresham/Bretton-Woods) and hardware gains deflate the Wc0 anchor
 * (deploy-time difficulty indexing needed for a stable nominal $1:
 * open problem, v5 admission game). Par is market-earned in reality
 * (liquidity-gated); modeled as fiat within the sound family.
 * Per-baton idle/backlog = v2 kernels (not re-modeled).
 */
import {
  energyPerEntrant,
  feeUsd,
  microStep,
} from './pacingEcon.js';

export type Tier = 'base' | 'grand';

export const TIER_SCALES: Record<Tier, number> = { base: 1, grand: 1000 };

/** Capital deploys top-down every slot. */
export const TIERS: Tier[] = ['grand', 'base'];

export interface GrandParams {
  slots: number;
  /** Fungible demand pool, base-$/slot. */
  demandUsd: (slot: number) => number;
  /** Whale-ticket share routed to the grand rail (0-1). */
  whaleShare: (slot: number) => number;
  designUsd?: number;
  genesisBatons?: Partial<Record<Tier, number>>;
  /** False bans fresh clones (G6b/G6c controls: listed-only). */
  allowFreshClones?: boolean;
  smallMiners?: number;
  smallFloat?: number;
  largeMiners?: number;
  largeFloat?: number;
  /** Large-miner cross-tier reaction lag in slots (default 3). */
  tauReact?: number;
  feeSats?: number;
  xecUsd?: number;
  energyShare?: number;
  opportunityUsd?: number;
  genesisTarget?: number;
}

export interface TierResult {
  blocks: number;
  races: number;
  unfilledRaces: number;
  thinRaces: number;
  issuanceNative: number;
  issuanceBase: number;
  energyUsd: number;
  profitUsd: number;
  avgEntrants: number;
  avgSmallM: number;
  avgLargeM: number;
  endSmallM: number;
  endLargeM: number;
  endActive: number;
  endNeed: number;
  endBlocks: number;
  tokensEver: number;
  maxBatons: number;
  unfilledDemandUsd: number;
  spillSentUsd: number;
  spillGotUsd: number;
}

export interface GrandResult {
  slots: number;
  byTier: Record<Tier, TierResult>;
  meanPremium: number;
  maxPremium: number;
  premiumSlots15: number;
  grandIdleSlots: number;
  baseIdleSlots: number;
  tokensBase: number;
  tokensGrand: number;
  blocksTotal: number;
  issuanceBase: number;
  energyUsd: number;
  profitUsd: number;
  spillUsd: number;
  unfilledD: number;
}

interface TokenState {
  target: number;
  blocks: number;
  batons: number;
}

const zeroTier = (): TierResult => ({
  blocks: 0,
  races: 0,
  unfilledRaces: 0,
  thinRaces: 0,
  issuanceNative: 0,
  issuanceBase: 0,
  energyUsd: 0,
  profitUsd: 0,
  avgEntrants: 0,
  avgSmallM: 0,
  avgLargeM: 0,
  endSmallM: 0,
  endLargeM: 0,
  endActive: 0,
  endNeed: 0,
  endBlocks: 0,
  tokensEver: 0,
  maxBatons: 0,
  unfilledDemandUsd: 0,
  spillSentUsd: 0,
  spillGotUsd: 0,
});

export function runGrandSim(p: GrandParams): GrandResult {
  const design = p.designUsd ?? 1;
  const smallN = p.smallMiners ?? 10000;
  const smallFloat = p.smallFloat ?? 0.01;
  const largeN = p.largeMiners ?? 100;
  const largeFloat = p.largeFloat ?? 10;
  const tauR = p.tauReact ?? 3;
  const freshOk = p.allowFreshClones ?? true;
  const share = p.energyShare ?? 0.3;
  const o = p.opportunityUsd ?? 0.005;
  const genesis = p.genesisTarget ?? 2 ** 24;
  const F = feeUsd(p.feeSats ?? 1750, p.xecUsd ?? 0.000007);

  const listed: Record<Tier, TokenState[]> = { base: [], grand: [] };
  for (const t of TIERS) {
    let g = p.genesisBatons?.[t] ?? 1;
    while (g > 0) {
      listed[t].push({ target: genesis, blocks: 0, batons: 0 });
      g -= 28;
    }
    if (listed[t].length === 0)
      listed[t].push({ target: genesis, blocks: 0, batons: 0 });
  }
  const implicit: Record<Tier, TokenState | null> = {
    base: null,
    grand: null,
  };
  const hw: Record<Tier, number> = {
    base: Math.max(1, p.genesisBatons?.base ?? 1),
    grand: Math.max(1, p.genesisBatons?.grand ?? 1),
  };

  const byTier: Record<Tier, TierResult> = {
    base: zeroTier(),
    grand: zeroTier(),
  };
  const mSum: Record<Tier, number> = { base: 0, grand: 0 };
  const smallSum: Record<Tier, number> = { base: 0, grand: 0 };
  const largeSum: Record<Tier, number> = { base: 0, grand: 0 };
  const filledSum: Record<Tier, number> = { base: 0, grand: 0 };
  let premiumNum = 0;
  let premiumDen = 0;
  let maxPremium = 0;
  let premiumSlots15 = 0;
  let grandIdle = 0;
  let baseIdle = 0;
  let spillUsd = 0;

  const parOf = (t: Tier): number => design * TIER_SCALES[t];

  const reactQueue: Array<{ apply: number; toGrand: number }> = [];
  let appliedToGrand = largeN; // grand-first prior
  let prevPrem: Record<Tier, number> = { base: 1, grand: 1 };
  let prevShort: Record<Tier, number> = { base: 0, grand: 0 };
  let prevPm: Record<Tier, number> = { base: 0, grand: 1e9 };

  const cheapestWc = (t: Tier): number => {
    const od = o * TIER_SCALES[t];
    if (freshOk) return energyPerEntrant(share, od, genesis, genesis);
    let best = 0;
    for (const tok of listed[t]) if (tok.target > best) best = tok.target;
    if (implicit[t] && implicit[t].target > best) best = implicit[t].target;
    if (best === 0) best = genesis;
    return energyPerEntrant(share, od, genesis, best);
  };

  for (let slot = 1; slot <= p.slots; slot++) {
    const D = p.demandUsd(slot);
    const w = Math.min(1, Math.max(0, p.whaleShare(slot)));
    const native: Record<Tier, number> = { grand: w * D, base: (1 - w) * D };

    // Spill direction by SHORTFALL pattern (latent demand included:
    // idle tiers print no premium, so premium-gap gating would miss
    // exactly the standby cases spill exists for).
    let spillDir: 'G2B' | 'B2G' | null = null;
    let spillTent = 0;
    if (prevShort.grand > 0 && prevShort.base === 0) {
      spillDir = 'G2B';
      spillTent = prevShort.grand;
    } else if (prevShort.base > 0 && prevShort.grand === 0) {
      spillDir = 'B2G';
      spillTent = prevShort.base;
    }

    // Native needs + M* at expected TRADE price (D/races).
    const need: Record<Tier, number> = { base: 0, grand: 0 };
    const mStar: Record<Tier, number> = { base: 0, grand: 0 };
    const wcOf: Record<Tier, number> = { base: 0, grand: 0 };
    for (const t of TIERS) {
      const P = parOf(t);
      const wc = cheapestWc(t);
      wcOf[t] = wc;
      const C = wc + o * TIER_SCALES[t];
      // PAR-GATING (strict): a tier mines only when native flow covers
      // a full par block. Thin flow idles (base dust waits, grand thin
      // spills) — never mines at a discount. Par is a FLOOR.
      const viable = P - F >= C;
      let n =
        viable && native[t] >= P
          ? Math.max(1, Math.ceil(native[t] / P))
          : 0;
      if (!freshOk) n = Math.min(n, listed[t].length * 28);
      need[t] = n;
      const pExp = n > 0 ? native[t] / n : 0;
      mStar[t] = n > 0 ? Math.max(0, Math.floor((pExp - F) / C)) : 0;
    }

    // Large-miner routing intent (absolute $/miner), reaction-lagged.
    const seatsG = need.grand * mStar.grand;
    const seatsB = need.base * mStar.base;
    const grandFirst = prevPm.grand >= prevPm.base;
    const intent = grandFirst
      ? Math.min(largeN, seatsG)
      : Math.max(0, largeN - seatsB);
    reactQueue.push({ apply: slot + tauR, toGrand: intent });
    while (reactQueue.length > 0 && reactQueue[0].apply <= slot) {
      appliedToGrand = reactQueue.shift()!.toGrand;
    }
    let largeLeft = largeN;
    let smallLeft = smallN;

    const alloc: Record<
      Tier,
      { races: number; m: number[]; ms: number[]; ml: number[] }
    > = {
      base: { races: 0, m: [], ms: [], ml: [] },
      grand: { races: 0, m: [], ms: [], ml: [] },
    };
    const fillTier = (
      t: Tier,
      races: number,
      lPool: number,
      sPool: number,
      m: number,
    ): { filled: number } => {
      const seats = races * m;
      let lIn = 0;
      let sIn = 0;
      if (lPool + sPool >= seats && lPool + sPool > 0) {
        lIn = Math.round((seats * lPool) / (lPool + sPool));
        sIn = seats - lIn;
      } else {
        lIn = lPool;
        sIn = sPool;
      }
      largeLeft -= lIn;
      smallLeft -= sIn;
      const a = alloc[t];
      a.races += races;
      const bL = races > 0 ? Math.floor(lIn / races) : 0;
      const rL = races > 0 ? lIn % races : 0;
      const bS = races > 0 ? Math.floor(sIn / races) : 0;
      const rS = races > 0 ? sIn % races : 0;
      let filled = 0;
      for (let k = 0; k < races; k++) {
        const ml = bL + (k < rL ? 1 : 0);
        const ms = bS + (k >= races - rS ? 1 : 0);
        a.m.push(ms + ml);
        a.ms.push(ms);
        a.ml.push(ml);
        if (ms + ml >= 1) filled++;
      }
      return { filled };
    };

    // Pass 1: native allocation (grand takes applied large first).
    const lG =
      wcOf.grand <= largeFloat ? Math.min(appliedToGrand, largeLeft) : 0;
    const sG = wcOf.grand <= smallFloat ? smallLeft : 0;
    fillTier('grand', need.grand, lG, sG, mStar.grand);
    const lB = wcOf.base <= largeFloat ? largeLeft : 0;
    const sB = wcOf.base <= smallFloat ? smallLeft : 0;
    fillTier('base', need.base, lB, sB, mStar.base);
    const natFilled: Record<Tier, number> = {
      base: alloc.base.m.filter(m => m >= 1).length,
      grand: alloc.grand.m.filter(m => m >= 1).length,
    };

    // Pass 2: spill top-up from miner slack (mStar at pass-1 price;
    // respects listed baton caps when rotation is banned).
    const deff: Record<Tier, number> = { ...native };
    if (spillDir !== null && spillTent > 0) {
      const recv: Tier = spillDir === 'G2B' ? 'base' : 'grand';
      const send: Tier = spillDir === 'G2B' ? 'grand' : 'base';
      const wantRaces = Math.ceil(spillTent / parOf(recv));
      const cRecv = wcOf[recv] + o * TIER_SCALES[recv];
      // M* at expected spill-trade price (dust staffs M*=0: unserved).
      const pSpill = spillTent / Math.max(1, wantRaces);
      const mSpill = Math.max(0, Math.floor((pSpill - F) / cRecv));
      const slackL =
        (recv === 'grand'
          ? wcOf.grand <= largeFloat
          : wcOf.base <= largeFloat)
          ? largeLeft
          : 0;
      const slackS =
        (recv === 'grand' ? wcOf.grand <= smallFloat : wcOf.base <= smallFloat)
          ? smallLeft
          : 0;
      const slackRaces =
        mSpill > 0 ? Math.floor((slackL + slackS) / mSpill) : 0;
      const capAvail = freshOk
        ? Infinity
        : Math.max(0, listed[recv].length * 28 - need[recv]);
      const spillRaces = Math.min(wantRaces, slackRaces, capAvail);
      if (spillRaces > 0 && mSpill > 0) {
        const before = alloc[recv].m.length;
        fillTier(recv, spillRaces, slackL, slackS, mSpill);
        const filled = alloc[recv].m
          .slice(before)
          .filter(m => m >= 1).length;
        const realized = (filled / wantRaces) * spillTent;
        deff[recv] += realized;
        deff[send] -= realized;
        spillUsd += realized;
        byTier[send].spillSentUsd += realized;
        byTier[recv].spillGotUsd += realized;
      }
    }

    // Pass 3: clear, aggregate, step vintages.
    let slotHigh = false;
    for (const t of TIERS) {
      const r = byTier[t];
      const P = parOf(t);
      const a = alloc[t];
      const filledIdx: number[] = [];
      for (let k = 0; k < a.m.length; k++) if (a.m[k] >= 1) filledIdx.push(k);
      const blocks = filledIdx.length;
      r.races += a.races;
      r.unfilledRaces += a.races - blocks;
      r.endActive = need[t];
      r.endNeed = need[t];
      r.endBlocks = blocks;
      const activeNow = need[t] + Math.max(0, a.races - need[t]);
      if (activeNow > hw[t]) hw[t] = activeNow;
      if (hw[t] > r.maxBatons) r.maxBatons = hw[t];
      if (need[t] === 0 && blocks === 0) {
        if (t === 'grand') grandIdle++;
        else baseIdle++;
        if (deff[t] > 0) r.unfilledDemandUsd += deff[t];
        prevShort[t] = native[t];
        prevPrem[t] = 1;
        continue;
      }
      if (blocks === 0) {
        r.unfilledDemandUsd += deff[t];
        prevShort[t] = native[t];
        prevPrem[t] = 1;
        continue;
      }
      const Pd = deff[t] / blocks;
      const premium = Pd / P;
      premiumNum += premium * deff[t];
      premiumDen += deff[t];
      if (premium > maxPremium) maxPremium = premium;
      if (premium > 1.5) slotHigh = true;
      prevShort[t] = Math.max(0, need[t] - natFilled[t]) * Pd;

      let eSlot = 0;
      let msSlot = 0;
      let mlSlot = 0;
      for (const k of filledIdx) {
        eSlot += a.m[k] * wcOf[t];
        msSlot += a.ms[k];
        mlSlot += a.ml[k];
        mSum[t] += a.m[k];
        smallSum[t] += a.ms[k];
        largeSum[t] += a.ml[k];
        filledSum[t]++;
        if (a.m[k] < mStar[t]) r.thinRaces++;
      }
      const profitSlot = blocks * Pd - blocks * F - eSlot;
      r.blocks += blocks;
      r.issuanceNative += blocks * 100;
      r.issuanceBase += blocks * 100 * TIER_SCALES[t];
      r.energyUsd += eSlot;
      r.profitUsd += profitSlot;
      r.endSmallM = msSlot / blocks;
      r.endLargeM = mlSlot / blocks;
      prevPm[t] = profitSlot / Math.max(1, msSlot + mlSlot);

      // Vintage fill: cheapest-first across listed, overflow to implicit.
      const order = [...listed[t]].sort((x, y) => y.target - x.target);
      let remaining = blocks;
      for (const tok of order) {
        if (remaining <= 0) break;
        const take = Math.min(28, remaining);
        tok.blocks += take;
        tok.batons = Math.min(28, tok.batons + take);
        remaining -= take;
      }
      if (remaining > 0 && freshOk) {
        if (implicit[t] === null)
          implicit[t] = { target: genesis, blocks: 0, batons: 0 };
        implicit[t].blocks += remaining;
        implicit[t].batons += remaining;
      }
      const stepTok = (tok: TokenState): void => {
        const steps = Math.max(
          1,
          Math.round(tok.blocks / Math.max(1, tok.batons)),
        );
        for (let s = 0; s < steps && tok.blocks > 0; s++)
          tok.target = microStep(tok.target);
        tok.blocks = 0;
        tok.batons = 0;
      };
      for (const tok of listed[t]) if (tok.blocks > 0) stepTok(tok);
      if (implicit[t] && implicit[t].blocks > 0) stepTok(implicit[t]);

      prevPrem[t] = premium;
    }
    if (slotHigh) premiumSlots15++;
  }

  for (const t of TIERS) {
    const r = byTier[t];
    if (filledSum[t] > 0) {
      r.avgEntrants = mSum[t] / filledSum[t];
      r.avgSmallM = smallSum[t] / filledSum[t];
      r.avgLargeM = largeSum[t] / filledSum[t];
    }
    r.tokensEver = Math.max(listed[t].length, Math.ceil(hw[t] / 28));
  }

  const blocksTotal = byTier.base.blocks + byTier.grand.blocks;
  const issuanceBase = byTier.base.issuanceBase + byTier.grand.issuanceBase;
  const energyUsd = byTier.base.energyUsd + byTier.grand.energyUsd;
  const profitUsd = byTier.base.profitUsd + byTier.grand.profitUsd;
  const unfilledD =
    byTier.base.unfilledDemandUsd + byTier.grand.unfilledDemandUsd;

  return {
    slots: p.slots,
    byTier,
    meanPremium: premiumDen > 0 ? premiumNum / premiumDen : 0,
    maxPremium,
    premiumSlots15,
    grandIdleSlots: grandIdle,
    baseIdleSlots: baseIdle,
    tokensBase: byTier.base.tokensEver,
    tokensGrand: byTier.grand.tokensEver,
    blocksTotal,
    issuanceBase,
    energyUsd,
    profitUsd,
    spillUsd,
    unfilledD,
  };
}
