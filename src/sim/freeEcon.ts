/**
 * Free-competition family (ELOTUS v5 research simulator) — PURE.
 *
 * Designer spec (no peg machinery): ELOTUS and GLOTUS are INDEPENDENT
 * PoW monies. ELOTUS: low starting diff (59-bit), ~$0.25/block to
 * produce, lower rewards, 12%/yr DIV-δ (v5 covenant: m − m//463784,
 * one step per block). GLOTUS: 1000x
 * harder, ~$250/block, grand rewards. Price follows cost PER TIER
 * via elastic supply; the GLOTUS/ELOTUS ratio FLOATS (no par, no
 * spill, no gating — tiers compete freely). Energy share 25%
 * ($0.25 on $1 design; Wc0 = $0.001667, M* = 149).
 *
 * Miner routing is the modeled margin: large miners chase absolute
 * $/miner across tiers (reaction-lagged); small miners are base-only
 * (float-locked — physics, not policy). Entry M* at expected trade
 * price (v4 mechanism); rotation via instant fresh clones per tier
 * (treadmill escape + scale); deployment instant (seconds).
 *
 * Adaptive demand (the well-posed cobweb): buyers balk above R x the
 * DESIGN price (reservation multiple, default 3x — nobody pays 100x
 * long-run production cost when they can wait a slot; the anchor is
 * the full equilibrium cost per block, NOT the per-entrant marginal
 * slice). Unfilled $ persists with patience (default 0.9/slot, rest
 * abandons) into next slot's effective demand. Capacity sizes on the
 * DESIGN anchor (need = D/design); staffing M* on capped expectation
 * (rational). Zero-block slots bank all flow as pent-up. Buyer TIER
 * choice is off-model (exogenous D per tier; ticket fee-efficiency
 * determines the split off-model; buyer portfolio choice deferred).
 *
 * THEORY BOX (accountability): with fixed-$ demand, price is
 * INDETERMINATE in [marginal cost, D] under free race formation —
 * any race count with M*-staffing is zero-profit. Profit-driven
 * baton deployment expands races until price -> marginal cost
 * (~$0.0067 base), NOT design ($1): at 100 races/P=$1, race 101
 * solo-pays $0.99 >> o, so nobody stops voluntarily. The design
 * anchor therefore IS a capacity-coordination assumption (issuers
 * size batons on D/design), not an emergent equilibrium. Two honest
 * frictions bound the slide in practice: (a) the miner BENCH
 * (races need >= 1 body each; shallow bench => price above MC —
 * the anchor holds while the bench is shallow, erodes as it
 * deepens — a lifecycle); (b) adaptive capacity (need on lastP)
 * RATCHETS instead (tested en route: floods stick high, crashes
 * stick low — hysteresis both ways, anchor dead). Race-formation
 * microfoundation (baton deployment economics) is THE open v6
 * question; this rig shows the dynamics CONDITIONAL on design-
 * anchored capacity, which is the coordination the covenant's
 * baton structure is meant to express.
 *
 * Findings this rig exists to check: free segmentation (float +
 * absolute-$ segments miners stably); thin-tier resilience (price
 * absorbs, solo mines, no death); treadmill = concentration, not
 * inflation (prices hold, M thins — rotation preserves inclusion,
 * not price); flood drain time vs patience; cross-tier propagation
 * via large-miner mobility. Per-tier idle/backlog = v2 kernels.
 */
import {
  energyPerEntrant,
  feeUsd,
} from './pacingEcon.js';
import { microStepV5 } from '../covenant/singleShardDeltaMathV5.js';

export type Tier5 = 'base' | 'grand';

export const TIER5_SCALES: Record<Tier5, number> = { base: 1, grand: 1000 };

export const TIERS5: Tier5[] = ['grand', 'base'];

export interface FreeParams {
  slots: number;
  /** Independent demand flows, base-$/slot per tier. */
  demandUsd: Record<Tier5, (slot: number) => number>;
  designUsd?: number;
  genesisBatons?: Partial<Record<Tier5, number>>;
  allowFreshClones?: boolean;
  smallMiners?: number;
  smallFloat?: number;
  largeMiners?: number;
  largeFloat?: number;
  tauReact?: number;
  /** Buyers pay at most R x marginal cost (default 3). */
  reserveMult?: number;
  /** Unfilled $ persisting per slot (default 0.9). */
  patience?: number;
  feeSats?: number;
  xecUsd?: number;
  /** Network energy share of block (default 0.25 — $0.25 on $1). */
  energyShare?: number;
  opportunityUsd?: number;
  genesisTarget?: number;
}

export interface Tier5Result {
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
  endPrice: number;
  tokensEver: number;
  maxBatons: number;
  unfilledUsd: number;
  abandonedUsd: number;
}

export interface FreeResult {
  slots: number;
  byTier: Record<Tier5, Tier5Result>;
  /** Mean GLOTUS/ELOTUS block-price ratio over dual-trade slots. */
  meanRatio: number;
  maxRatio: number;
  minRatio: number;
  grandIdleSlots: number;
  baseIdleSlots: number;
  tokensBase: number;
  tokensGrand: number;
  blocksTotal: number;
  issuanceBase: number;
  energyUsd: number;
  profitUsd: number;
  unfilledUsd: number;
}

interface TokenState {
  target: number;
  blocks: number;
  batons: number;
}

const zeroTier = (): Tier5Result => ({
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
  endPrice: 0,
  tokensEver: 0,
  maxBatons: 0,
  unfilledUsd: 0,
  abandonedUsd: 0,
});

export function runFreeSim(p: FreeParams): FreeResult {
  const design = p.designUsd ?? 1;
  const smallN = p.smallMiners ?? 10000;
  const smallFloat = p.smallFloat ?? 0.01;
  const largeN = p.largeMiners ?? 100;
  const largeFloat = p.largeFloat ?? 10;
  const tauR = p.tauReact ?? 3;
  const R = p.reserveMult ?? 3;
  const patience = p.patience ?? 0.9;
  const freshOk = p.allowFreshClones ?? true;
  const share = p.energyShare ?? 0.25;
  const o = p.opportunityUsd ?? 0.005;
  const genesis = p.genesisTarget ?? 2 ** 24;
  const F = feeUsd(p.feeSats ?? 1750, p.xecUsd ?? 0.000007);

  const listed: Record<Tier5, TokenState[]> = { base: [], grand: [] };
  for (const t of TIERS5) {
    let g = p.genesisBatons?.[t] ?? 1;
    while (g > 0) {
      listed[t].push({ target: genesis, blocks: 0, batons: 0 });
      g -= 28;
    }
    if (listed[t].length === 0)
      listed[t].push({ target: genesis, blocks: 0, batons: 0 });
  }
  const implicit: Record<Tier5, TokenState | null> = {
    base: null,
    grand: null,
  };
  const hw: Record<Tier5, number> = {
    base: Math.max(1, p.genesisBatons?.base ?? 1),
    grand: Math.max(1, p.genesisBatons?.grand ?? 1),
  };

  const byTier: Record<Tier5, Tier5Result> = {
    base: zeroTier(),
    grand: zeroTier(),
  };
  const mSum: Record<Tier5, number> = { base: 0, grand: 0 };
  const smallSum: Record<Tier5, number> = { base: 0, grand: 0 };
  const largeSum: Record<Tier5, number> = { base: 0, grand: 0 };
  const filledSum: Record<Tier5, number> = { base: 0, grand: 0 };
  let ratioNum = 0;
  let ratioDen = 0;
  let maxRatio = 0;
  let minRatio = Infinity;
  let grandIdle = 0;
  let baseIdle = 0;

  const reactQueue: Array<{ apply: number; toGrand: number }> = [];
  let appliedToGrand = largeN;
  const pentUp: Record<Tier5, number> = { base: 0, grand: 0 };
  const lastP: Record<Tier5, number> = { base: design, grand: design * 1000 };
  const prevPm: Record<Tier5, number> = { base: 0, grand: 1e9 };

  const cheapestWc = (t: Tier5): number => {
    const od = o * TIER5_SCALES[t];
    if (freshOk) return energyPerEntrant(share, od, genesis, genesis);
    let best = 0;
    for (const tok of listed[t]) if (tok.target > best) best = tok.target;
    if (implicit[t] && implicit[t].target > best) best = implicit[t].target;
    if (best === 0) best = genesis;
    return energyPerEntrant(share, od, genesis, best);
  };

  for (let slot = 1; slot <= p.slots; slot++) {
    const deff: Record<Tier5, number> = {
      base: p.demandUsd.base(slot) + pentUp.base,
      grand: p.demandUsd.grand(slot) + pentUp.grand,
    };

    // Needs size on the DESIGN anchor (capacity coordination; the
    // indeterminacy theorem in the header explains why lastP fails).
    const need: Record<Tier5, number> = { base: 0, grand: 0 };
    const mStar: Record<Tier5, number> = { base: 0, grand: 0 };
    const wcOf: Record<Tier5, number> = { base: 0, grand: 0 };
    const costOf: Record<Tier5, number> = { base: 0, grand: 0 };
    for (const t of TIERS5) {
      const designTier = design * TIER5_SCALES[t];
      const wc = cheapestWc(t);
      wcOf[t] = wc;
      const C = wc + o * TIER5_SCALES[t];
      costOf[t] = C;
      let n =
        deff[t] >= C + F
          ? Math.max(1, Math.ceil(deff[t] / designTier))
          : 0;
      if (!freshOk) n = Math.min(n, listed[t].length * 28);
      need[t] = n;
      // Staffing on capped expectation (buyers balk above R x design).
      const pExp = n > 0 ? Math.min(deff[t] / n, R * designTier) : 0;
      mStar[t] = n > 0 ? Math.max(0, Math.floor((pExp - F) / C)) : 0;
    }

    // Large route by absolute $/miner (reaction-lagged).
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
      Tier5,
      { races: number; m: number[]; ms: number[]; ml: number[] }
    > = {
      base: { races: 0, m: [], ms: [], ml: [] },
      grand: { races: 0, m: [], ms: [], ml: [] },
    };
    const fillTier = (
      t: Tier5,
      races: number,
      lPool: number,
      sPool: number,
      m: number,
    ): void => {
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
      for (let k = 0; k < races; k++) {
        const ml = bL + (k < rL ? 1 : 0);
        const ms = bS + (k >= races - rS ? 1 : 0);
        a.m.push(ms + ml);
        a.ms.push(ms);
        a.ml.push(ml);
      }
    };

    const lG =
      wcOf.grand <= largeFloat ? Math.min(appliedToGrand, largeLeft) : 0;
    const sG = wcOf.grand <= smallFloat ? smallLeft : 0;
    fillTier('grand', need.grand, lG, sG, mStar.grand);
    const lB = wcOf.base <= largeFloat ? largeLeft : 0;
    const sB = wcOf.base <= smallFloat ? smallLeft : 0;
    fillTier('base', need.base, lB, sB, mStar.base);

    // Clear per tier: reservation-capped revenue, pent-up the rest.
    let pg = 0;
    let pb = 0;
    for (const t of TIERS5) {
      const r = byTier[t];
      const a = alloc[t];
      const filledIdx: number[] = [];
      for (let k = 0; k < a.m.length; k++) if (a.m[k] >= 1) filledIdx.push(k);
      const blocks = filledIdx.length;
      r.races += a.races;
      r.unfilledRaces += a.races - blocks;
      r.endActive = need[t];
      r.endNeed = need[t];
      r.endBlocks = blocks;
      if (need[t] > hw[t]) hw[t] = need[t];
      if (hw[t] > r.maxBatons) r.maxBatons = hw[t];
      if (need[t] === 0 && blocks === 0) {
        if (t === 'grand') grandIdle++;
        else baseIdle++;
        r.unfilledUsd += deff[t];
        r.abandonedUsd += (1 - patience) * deff[t];
        pentUp[t] = patience * deff[t];
        r.endPrice = 0; // No market, no price (stale prints lie).
        continue;
      }
      if (blocks === 0) {
        r.unfilledUsd += deff[t];
        r.abandonedUsd += (1 - patience) * deff[t];
        pentUp[t] = patience * deff[t];
        r.endPrice = 0; // No market, no price (stale prints lie).
        continue;
      }
      const pClear = deff[t] / blocks;
      const pTrade = Math.min(pClear, R * design * TIER5_SCALES[t]);
      const revenue = blocks * pTrade;
      const unfilled = Math.max(0, deff[t] - revenue);
      r.unfilledUsd += unfilled;
      r.abandonedUsd += (1 - patience) * unfilled;
      pentUp[t] = patience * unfilled;
      lastP[t] = pTrade;
      r.endPrice = pTrade;
      if (t === 'grand') pg = pTrade;
      else pb = pTrade;

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
      const profitSlot = revenue - blocks * F - eSlot;
      r.blocks += blocks;
      r.issuanceNative += blocks * 100;
      r.issuanceBase += blocks * 100 * TIER5_SCALES[t];
      r.energyUsd += eSlot;
      r.profitUsd += profitSlot;
      r.endSmallM = msSlot / blocks;
      r.endLargeM = mlSlot / blocks;
      prevPm[t] = profitSlot / Math.max(1, msSlot + mlSlot);

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
          tok.target = microStepV5(tok.target);
        tok.blocks = 0;
        tok.batons = 0;
      };
      for (const tok of listed[t]) if (tok.blocks > 0) stepTok(tok);
      if (implicit[t] && implicit[t].blocks > 0) stepTok(implicit[t]);
    }
    if (pg > 0 && pb > 0) {
      const ratio = pg / pb;
      ratioNum += ratio;
      ratioDen++;
      if (ratio > maxRatio) maxRatio = ratio;
      if (ratio < minRatio) minRatio = ratio;
    }
  }

  for (const t of TIERS5) {
    const r = byTier[t];
    if (filledSum[t] > 0) {
      r.avgEntrants = mSum[t] / filledSum[t];
      r.avgSmallM = smallSum[t] / filledSum[t];
      r.avgLargeM = largeSum[t] / filledSum[t];
    }
    r.tokensEver = Math.max(listed[t].length, Math.ceil(hw[t] / 28));
  }

  const blocksTotal = byTier.base.blocks + byTier.grand.blocks;
  const issuanceBase =
    byTier.base.issuanceBase + byTier.grand.issuanceBase;
  const energyUsd = byTier.base.energyUsd + byTier.grand.energyUsd;
  const profitUsd = byTier.base.profitUsd + byTier.grand.profitUsd;
  const unfilledUsd =
    byTier.base.unfilledUsd + byTier.grand.unfilledUsd;

  return {
    slots: p.slots,
    byTier,
    meanRatio: ratioDen > 0 ? ratioNum / ratioDen : 0,
    maxRatio,
    minRatio: minRatio === Infinity ? 0 : minRatio,
    grandIdleSlots: grandIdle,
    baseIdleSlots: baseIdle,
    tokensBase: byTier.base.tokensEver,
    tokensGrand: byTier.grand.tokensEver,
    blocksTotal,
    issuanceBase,
    energyUsd,
    profitUsd,
    unfilledUsd,
  };
}
