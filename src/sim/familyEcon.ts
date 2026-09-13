/**
 * Elastic family economics (ELOTUS v3 research simulator) — PURE.
 *
 * The scaling stack (user architecture): up to 28 mint batons per token
 * (parallel mining, same difficulty — eCash CashTokens limit, proven in
 * WLotus); a denomination ladder (milli 1/1000x, base 1x, mega 1000x,
 * cost-constructed price ratios); unbounded same-design clones
 * (elotus1, elotus2, ...) serving the same demand, price unity enforced
 * by atomic-swap arbitrage. Demand D_d ($/slot) per denomination is
 * exogenous; blocks trade at par (P = design x scale) and miners fill
 * races to par-implied need. The ONLY premium is the transient
 * deployment-lag wedge (blocks < need while batons/clones spin up):
 * small, bounded, self-correcting. Exit is FREE (stop mining, the
 * clone idles) — the cobweb overdamps by construction.
 *
 * Per-race entry reuses v2 semantics exactly (M* = (P-F)/(Wc+o),
 * all-pay-full, 30% energy share), with o_d = o x scale (rational
 * inattention: attention scales with stakes — required, else a flat
 * $0.005/race o would exceed the $0.001 milli block and kill the
 * denomination; denominations are then scale-free replicas: same M*,
 * scaled dollars). Capital-float sorting: miners mine only races
 * with Wc_d within their per-race energy float (small miners can't
 * float mega's $2.14/race outlay -> mega is a large-miner oligopoly
 * earning capital-moat rents — emergent, not assumed). Single-homing
 * (highest affordable tier) + o/race gives the 30% dissipation bound;
 * full o-sharing across races would push toward 100% (upper bound).
 * Within a tier, seats ration pro-rata (permissionless lottery) and
 * spread evenly across symmetric races (water-fill Nash); capital
 * deploys top-down (mega->base->milli), so rationed-out large miners
 * cascade down-ladder.
 *
 * Dust-tier fee drag is real: milli's $0.00012 fee is 12% of its
 * $0.001 par (M*=123 vs 139) — and a token dies outright if fees
 * ever exceed par (fee-regime death; over-production past par at a
 * fee floor is deferred to v4). Treadmill interacts with the ladder:
 * Wc rises 0.0815%/day, so the working-capital bar rises and small
 * miners get priced out of base in ~5y at flat costs — they must
 * descend to milli (needs milli demand) or exit (F7/F8 runs).
 *
 * v2<->v3 interface: per-baton idle/backlog/recovery = v2 kernels
 * (validated there, not re-modeled); v3 tracks family capacity,
 * demand, premium, clones (aggregate grain, deterministic, no RNG).
 * Miner populations are a FIXTURE (family growth needs miner growth
 * — checked via unfilled races, not derived). Miner-shortage and
 * float barriers flow through the same channel as lag (blocks <
 * need -> premium), so all wedges are unified and reported.
 * Two-pass pricing per slot: allocate miners at par-M*, then clear
 * P_d = D_d/blocks (premium-chasing entry would need elastic pop).
 */
import {
  energyPerEntrant,
  feeUsd,
  microStep,
} from './pacingEcon.js';

export type Denom = 'milli' | 'base' | 'mega';

export const DENOM_SCALES: Record<Denom, number> = {
  milli: 0.001,
  base: 1,
  mega: 1000,
};

/** Allocation priority: whales fill top-down every slot. */
export const DENOMS: Denom[] = ['mega', 'base', 'milli'];

export interface FamilyParams {
  slots: number;
  /** Demand $/slot per denomination (exogenous buyer pressure). */
  demandUsd: Record<Denom, (slot: number) => number>;
  /** Base-denomination design price $/block (default 1). */
  designUsd?: number;
  /** Batons pre-deployed at slot 1 (default { base: 1 }). */
  genesisBatons?: Partial<Record<Denom, number>>;
  smallMiners?: number;
  smallFloat?: number;
  largeMiners?: number;
  largeFloat?: number;
  /** Baton activation lag in slots (default 6, ~1hr). */
  tauBaton?: number;
  /** Clone deployment lag in slots (default 144, 1 day). */
  tauClone?: number;
  maxBatonsPerToken?: number;
  feeSats?: number;
  xecUsd?: number;
  energyShare?: number;
  opportunityUsd?: number;
  genesisTarget?: number;
}

export interface DenomResult {
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
  tokensDeployed: number;
  maxBatons: number;
  unfilledDemandUsd: number;
}

export interface FamilyResult {
  slots: number;
  byDenom: Record<Denom, DenomResult>;
  meanPremium: number;
  maxPremium: number;
  /** Slots where any filled tier cleared above 1.5x par. */
  premiumSlots15: number;
  clonesDeployed: number;
  blocksTotal: number;
  issuanceBase: number;
  energyUsd: number;
  profitUsd: number;
}

interface TokenState {
  denom: Denom;
  batons: number;
  target: number;
}

interface Pending {
  due: number;
  denom: Denom;
  tokenIdx: number; // -1 = new clone on arrival
}

const zeroDenom = (): DenomResult => ({
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
  tokensDeployed: 0,
  maxBatons: 0,
  unfilledDemandUsd: 0,
});

export function runFamilySim(p: FamilyParams): FamilyResult {
  const design = p.designUsd ?? 1;
  const smallN = p.smallMiners ?? 10000;
  const smallFloat = p.smallFloat ?? 0.01;
  const largeN = p.largeMiners ?? 100;
  const largeFloat = p.largeFloat ?? 10;
  const tauB = p.tauBaton ?? 6;
  const tauC = p.tauClone ?? 144;
  const maxB = p.maxBatonsPerToken ?? 28;
  const share = p.energyShare ?? 0.3;
  const o = p.opportunityUsd ?? 0.005;
  const genesis = p.genesisTarget ?? 2 ** 24;
  const F = feeUsd(p.feeSats ?? 1750, p.xecUsd ?? 0.000007);

  const tokens: TokenState[] = [];
  for (const d of DENOMS) {
    let g = p.genesisBatons?.[d] ?? (d === 'base' ? 1 : 0);
    while (g > 0) {
      const b = Math.min(maxB, g);
      tokens.push({ denom: d, batons: b, target: genesis });
      g -= b;
    }
  }
  const pending: Pending[] = [];
  const byDenom: Record<Denom, DenomResult> = {
    milli: zeroDenom(),
    base: zeroDenom(),
    mega: zeroDenom(),
  };
  const mSum: Record<Denom, number> = { milli: 0, base: 0, mega: 0 };
  const smallSum: Record<Denom, number> = { milli: 0, base: 0, mega: 0 };
  const largeSum: Record<Denom, number> = { milli: 0, base: 0, mega: 0 };
  const filledSum: Record<Denom, number> = { milli: 0, base: 0, mega: 0 };
  let premiumNum = 0;
  let premiumDen = 0;
  let maxPremium = 0;
  let premiumSlots15 = 0;
  let clones = 0;

  const parOf = (d: Denom): number => design * DENOM_SCALES[d];

  for (let slot = 1; slot <= p.slots; slot++) {
    for (let i = pending.length - 1; i >= 0; i--) {
      if (pending[i].due > slot) continue;
      const job = pending.splice(i, 1)[0];
      if (job.tokenIdx === -1) {
        tokens.push({ denom: job.denom, batons: 1, target: genesis });
        byDenom[job.denom].tokensDeployed++;
        clones++;
      } else {
        tokens[job.tokenIdx].batons++;
      }
    }

    // Always-on populations re-enter every slot; consumed top-down.
    let largeLeft = largeN;
    let smallLeft = smallN;
    let slotPremiumHigh = false;

    for (const d of DENOMS) {
      const r = byDenom[d];
      const scale = DENOM_SCALES[d];
      const P = parOf(d);
      const D = p.demandUsd[d](slot);
      const od = o * scale;
      const toks = tokens.filter(t => t.denom === d);
      const active = toks.reduce((n, t) => n + t.batons, 0);
      if (active > r.maxBatons) r.maxBatons = active;
      r.endActive = active;
      const avgTarget =
        toks.length > 0
          ? toks.reduce((n, t) => n + t.target, 0) / toks.length
          : genesis;
      const wc = energyPerEntrant(share, od, genesis, avgTarget);
      const C = wc + od;
      const parViable = P - F >= C;
      const need =
        parViable && D >= C + F ? Math.max(1, Math.ceil(D / P)) : 0;
      r.endNeed = need;

      // Activation: batons fill existing tokens (fast), clones add new
      // tokens (slow). A queued clone promises maxB future batons.
      const pendB = pending.filter(
        q => q.denom === d && q.tokenIdx !== -1,
      ).length;
      const pendC = pending.filter(
        q => q.denom === d && q.tokenIdx === -1,
      ).length;
      let cover = active + pendB + pendC * maxB;
      while (cover < need) {
        const openIdx = tokens.findIndex(
          (t, i) =>
            t.denom === d &&
            t.batons + pending.filter(q => q.tokenIdx === i).length < maxB,
        );
        if (openIdx !== -1) {
          pending.push({ due: slot + tauB, denom: d, tokenIdx: openIdx });
          cover += 1;
        } else {
          pending.push({ due: slot + tauC, denom: d, tokenIdx: -1 });
          cover += maxB;
        }
      }

      const races = Math.min(active, need);
      r.races += races;
      if (races === 0) {
        // Bids without fills (need==0 = can't cover even one race).
        r.unfilledDemandUsd += D;
        continue;
      }

      // Pass 1: allocate miners at par-M* — pro-rata within the tier
      // (permissionless rationing = lottery, not priority lanes),
      // spread evenly across symmetric races (water-fill: an emptier
      // race pays more, so miners deviate until M equalizes — Nash).
      // Tiers run top-down (capital deploys mega->base->milli).
      const mStar = Math.max(0, Math.floor((P - F) / C));
      const lPool = wc <= largeFloat ? largeLeft : 0;
      const sPool = wc <= smallFloat ? smallLeft : 0;
      const seats = races * mStar;
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
      const mRaces: Array<{ m: number; ms: number; ml: number }> = [];
      const baseL = Math.floor(lIn / races);
      const remL = lIn % races;
      const baseS = Math.floor(sIn / races);
      const remS = sIn % races;
      for (let k = 0; k < races; k++) {
        const ml = baseL + (k < remL ? 1 : 0);
        const ms = baseS + (k < remS ? 1 : 0);
        mRaces.push({ m: ms + ml, ms, ml });
      }
      const filled = mRaces.filter(q => q.m >= 1);
      r.unfilledRaces += races - filled.length;
      r.thinRaces += filled.filter(q => q.m < mStar).length;
      if (filled.length === 0) {
        r.unfilledDemandUsd += D;
        continue;
      }

      // Pass 2: clear P_d = D/blocks (shortage -> premium, else par).
      const blocks = filled.length;
      const Pd = D / blocks;
      const premium = Pd / P;
      premiumNum += premium * D;
      premiumDen += D;
      if (premium > maxPremium) maxPremium = premium;
      if (premium > 1.5) slotPremiumHigh = true;

      let eSlot = 0;
      let msSlot = 0;
      let mlSlot = 0;
      for (const q of filled) {
        eSlot += q.m * wc;
        msSlot += q.ms;
        mlSlot += q.ml;
        mSum[d] += q.m;
        smallSum[d] += q.ms;
        largeSum[d] += q.ml;
        filledSum[d]++;
      }
      r.blocks += blocks;
      r.issuanceNative += blocks * 100;
      r.issuanceBase += blocks * 100 * scale;
      r.energyUsd += eSlot;
      r.profitUsd += blocks * Pd - blocks * F - eSlot;
      r.endSmallM = msSlot / blocks;
      r.endLargeM = mlSlot / blocks;

      // Representative target: ~1 step per baton-slot when full.
      const steps = Math.max(1, Math.round(blocks / Math.max(1, active)));
      for (const t of toks) {
        for (let s = 0; s < steps; s++) t.target = microStep(t.target);
      }
    }

    if (slotPremiumHigh) premiumSlots15++;
  }

  for (const d of DENOMS) {
    const r = byDenom[d];
    if (filledSum[d] > 0) {
      r.avgEntrants = mSum[d] / filledSum[d];
      r.avgSmallM = smallSum[d] / filledSum[d];
      r.avgLargeM = largeSum[d] / filledSum[d];
    }
  }

  const blocksTotal =
    byDenom.milli.blocks + byDenom.base.blocks + byDenom.mega.blocks;
  const issuanceBase =
    byDenom.milli.issuanceBase +
    byDenom.base.issuanceBase +
    byDenom.mega.issuanceBase;
  const energyUsd =
    byDenom.milli.energyUsd +
    byDenom.base.energyUsd +
    byDenom.mega.energyUsd;
  const profitUsd =
    byDenom.milli.profitUsd +
    byDenom.base.profitUsd +
    byDenom.mega.profitUsd;

  return {
    slots: p.slots,
    byDenom,
    meanPremium: premiumDen > 0 ? premiumNum / premiumDen : 0,
    maxPremium,
    premiumSlots15,
    clonesDeployed: clones,
    blocksTotal,
    issuanceBase,
    energyUsd,
    profitUsd,
  };
}
