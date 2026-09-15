/**
 * Baton-deployment game (ELOTUS v6 research simulator) — PURE.
 *
 * The v5 indeterminacy theorem left ONE open question: race formation.
 * v5 ASSUMED capacity coordination (need = D/design); v6 ENDOGENIZES
 * the race count. Single tier (base-scale params, scale factor for
 * grand runs — v5 showed tiers are independent; the race-count question
 * lives inside each tier).
 *
 * LOTTERY PoW (corrected from all-pay v6.0): the covenant's
 * nonce-grinding is a lottery — each race costs E_block in expected
 * electricity per solution, SPLIT among entrants (a solo miner burns
 * the FULL E_block, not a per-entrant slice). E0 = $0.25/block at
 * genesis is PRIMITIVE (design + hardware mapping); o = $0.005/unit
 * is hardware opportunity per hashrate-unit. M* = (P-F-E)/o (149 at
 * $1 — coincides with all-pay AT the coordinated state, which is why
 * v5 looked right; off-equilibrium solo diverges: $0.255 vs $0.0067).
 * Energy/block is E_block ALWAYS (25% of $1 at design, 98% at the
 * $0.255 terminal — the treadmill cost-pushes the terminal upward).
 * Small miners are POOL-DEPENDENT (they can float E/M* in fat races
 * but never E solo); grand needs 25+ large units per viable race.
 *
 * Actors: (1) DEPLOYERS — capitalized operators who create batons
 * (fresh clones at E0, or same-token batons, 28/token) and solo-mine
 * the new race at full E0 (float-exempt: deployment is capital, unit
 * float gates opex ENTRY only); (2) ENTRANTS — the miner bench
 * (small pool-dependent + large mobile) allocating across deployed
 * races with reaction lag λ. Races are STICKY on-chain capital (the
 * covenant has no remove-baton path): deployed count never falls,
 * but races go DORMANT (staff < 1 body, no block, no treadmill step)
 * and form a shadow-capacity overhang that re-enters without
 * deployment lag.
 *
 * Deploy rules: myopic-flow (deploy iff current solo flow > 0, fees
 * sunk-ignored), myopic-payback (deploy iff one slot repays the
 * creation fee), forward (deploy iff flow x ADAPTIVE obscurity window
 * > fee — the window is MEASURED (trailing mean birth-to-full-staff
 * slots)). Forward deployers SELF-ARREST above MC (thin races staff
 * fast — short windows demand high flow — a pin, not a slide).
 * Entry ALLOCATION ('chasing' thin-first (default) vs 'sticky'
 * standing-first) does NOT select the terminal (both slide to MC —
 * birth-activation bypasses fill order); 'uniform' thin-spread
 * freezes ABOVE MC (coordination failure pins via starvation).
 * Clearing, reservation cap R, patience/pent-up, fees, and exact
 * per-block microStepV5 treadmill are v5 accounting (dormant frozen).
 *
 * THEORY BOX (what this rig adjudicates): with fixed-$ demand, free
 * deployment, free entry/exit, and sticky races, SOLO-COST MC =
 * E_block + o + F is the UNIQUE stable rest point — entry/exit
 * mean-reverts P to MC from below (idle threat), deployment ratchets
 * n up whenever P > MC from above (obscurity rent: race n+1
 * solo-pays P-MC > 0 at full E_block). The $1 design price is
 * UNSTABLE without help (slide $1 -> $0.255, n -> D/MC = 392).
 * Candidate pins, tested as scenarios: (a) creation fees pin at
 * MC + c/L (forward deployers only — naive deployers sunk-ignore
 * them; the $1 pin = c/L ~ $0.745); (b) issuer ROYALTIES do NOT pin
 * (self-mining deployers pay themselves — bypass); (c) E0 ~ $1 pins
 * NEAR $1 via a knife-edge SOLO equilibrium but excludes smalls
 * (pool-dependent, no pools at M*=1 — double-bind) and the treadmill
 * breaches it in weeks — the TRILEMMA: $1 anchor + small inclusion
 * + permissionless deployment, pick two. Entry lag is PERVERSE:
 * slow staffing lengthens obscurity, deepening fee-pins.
 */
import { feeUsd } from './pacingEcon.js';
import { microStepV5 } from '../covenant/singleShardDeltaMathV5.js';

/** Max mint batons per ALP token (eCash consensus, proven in WLotus). */
export const BATONS_PER_TOKEN = 28;

export type Foresight = 'myopic-flow' | 'myopic-payback' | 'forward';

export interface DeployParams {
  slots: number;
  demandUsd: (slot: number) => number;
  /** Buyer reference + R-cap base (NOT a capacity rule here). */
  designUsd?: number;
  /** Tier scale: 1 base, 1000 grand (scales o, floats, E0, MC). */
  scale?: number;
  smallMiners?: number;
  /** Max electricity $/unit/slot a small miner floats (default 0.01). */
  smallFloat?: number;
  largeMiners?: number;
  /** Max electricity $/unit/slot a large miner floats (default 10). */
  largeFloat?: number;
  /** Staffing move per slot toward M* (default 0.5). */
  entryLag?: number;
  /** Max deployments per slot (deployer attention, default 10). */
  deploysPerSlot?: number;
  foresight?: Foresight;
  /** Override the adaptive obscurity window (default: measured). */
  obscurityWindow?: number;
  /**
   * Exit hysteresis ($/slot flow tolerance, default o/2): occupied
   * races keep a solo body while solo flow > -H (switching costs —
   * miners ride through small dips; exits need real pain).
   */
  exitHysteresis?: number;
  /** One-time creation fee per fresh clone (default $0.01). */
  cloneCostUsd?: number;
  /** One-time creation fee per same-token baton (default $0.002). */
  batonCostUsd?: number;
  /** Issuer cut of each block on their races (default 0). */
  royaltyRate?: number;
  /** Starting races (default: ceil(D(1)/design), coordinated). */
  initialRaces?: number;
  /**
   * Entry allocation: 'chasing' fills thin/new races first (default);
   * 'sticky' fills standing races first (same terminal — birth-
   * activation bypasses fill order); 'uniform' thin-spreads
   * (coordination failure — freezes ABOVE MC via starvation).
   */
  entryMode?: 'chasing' | 'sticky' | 'uniform';
  reserveMult?: number;
  patience?: number;
  feeSats?: number;
  xecUsd?: number;
  /** Expected electricity $ per race solution at genesis (default 0.25). */
  blockEnergyUsd?: number;
  /** Hardware opportunity $/unit/slot, excl. electricity (default 0.005). */
  opportunityUsd?: number;
  genesisTarget?: number;
}

export interface DeployResult {
  slots: number;
  /** Batons ever deployed (sticky — monotone non-decreasing). */
  deployed: number;
  tokens: number;
  activeEnd: number;
  dormantEnd: number;
  priceEnd: number;
  meanPrice: number;
  minPrice: number;
  blocks: number;
  issuanceNative: number;
  energyUsd: number;
  profitUsd: number;
  deployCostUsd: number;
  issuerProfitUsd: number;
  unfilledUsd: number;
  abandonedUsd: number;
  idleSlots: number;
  endSmallM: number;
  endLargeM: number;
  benchUseEnd: number;
  /** First slot with P <= 1.1 x MC (-1 if never). */
  slideSlots: number;
  /** Trailing measured obscurity window (slots). */
  windowEnd: number;
  /** Mean deployment rate over the run (races/slot). */
  deployRate: number;
  /** Max batons on any token (consensus: never exceeds 28). */
  maxBatons: number;
  /** Per-slot price path for cycle inspection. */
  pricePath: number[];
  /** Per-slot active-race path. */
  activePath: number[];
  /** Per-slot deployed-race path. */
  deployedPath: number[];
}

interface Race {
  target: number;
  /** Integer bodies (discrete miners — no fractional limbo). */
  sSmall: number;
  sLarge: number;
  token: number;
  birth: number;
  /** Slot the race first reached its birth M* (-1 pending). */
  fullStaffed: number;
  /** M* reference fixed at birth for the window measurement. */
  birthMStar: number;
}

const staffOf = (r: Race): number => r.sSmall + r.sLarge;

export function runDeploySim(p: DeployParams): DeployResult {
  const design = p.designUsd ?? 1;
  const scale = p.scale ?? 1;
  const designTier = design * scale;
  const smallN = p.smallMiners ?? 15000;
  // Floats do NOT scale: per-UNIT burn caps are hardware-defined (the
  // same ASIC unit burns E/M whether the race is base or grand).
  const smallFloat = p.smallFloat ?? 0.01;
  const largeN = p.largeMiners ?? 2000;
  const largeFloat = p.largeFloat ?? 10;
  const lam = p.entryLag ?? 0.5;
  const G = p.deploysPerSlot ?? 10;
  const foresight: Foresight = p.foresight ?? 'forward';
  const cClone = p.cloneCostUsd ?? 0.01;
  const cBaton = p.batonCostUsd ?? 0.002;
  const royalty = p.royaltyRate ?? 0;
  const R = p.reserveMult ?? 3;
  const patience = p.patience ?? 0.9;
  // o does NOT scale either (per-unit hardware opex, same unit); only
  // the PUZZLE scales (E0 x1000 = 1000x more hashes for grand).
  const o = p.opportunityUsd ?? 0.005;
  const genesis = p.genesisTarget ?? 2 ** 24;
  const F = feeUsd(p.feeSats ?? 1750, p.xecUsd ?? 0.000007);
  const H = p.exitHysteresis ?? o / 2;

  const E0 = (p.blockEnergyUsd ?? 0.25) * scale;
  const eAt = (target: number): number => E0 * (genesis / target);
  /** Solo-mining all-in cost (lottery: solo burns full E). */
  const mcSolo = E0 + o + F;

  // Coordinated start: n0 races at M* (dissipated peace at ~design).
  const n0 = Math.max(
    1,
    p.initialRaces ?? Math.max(1, Math.ceil(p.demandUsd(1) / designTier)),
  );
  const races: Race[] = [];
  const tokenBatons: number[] = [];
  /** Token index for a new race (fresh = new token, else roomiest). */
  const tokenFor = (fresh: boolean): number => {
    if (!fresh) {
      let best = -1;
      for (let i = 0; i < tokenBatons.length; i++) {
        if (tokenBatons[i] >= BATONS_PER_TOKEN) continue;
        if (best < 0 || tokenBatons[i] < tokenBatons[best]) best = i;
      }
      if (best >= 0) return best;
    }
    tokenBatons.push(0);
    return tokenBatons.length - 1;
  };
  const p0 = Math.min(p.demandUsd(1) / n0, R * designTier);
  // Lottery M*: units enter while (P-F-E)/M >= o.
  const m0 = Math.max(0, Math.floor(((1 - royalty) * p0 - F - E0) / o));
  // Pool-capped fill (races beyond the bench are born dormant —
  // deployed paper batons the bench cannot staff).
  let initSmallPool = smallN;
  let initLargePool = largeN;
  for (let k = 0; k < n0; k++) {
    const t = tokenFor(false);
    tokenBatons[t]++;
    // Integer split (largest-remainder to large, deterministic).
    const sS = Math.min(
      Math.floor(smallN / n0),
      Math.floor((m0 * smallN) / (smallN + largeN)),
    );
    const sL = Math.max(0, m0 - sS);
    const takeS = Math.min(sS, initSmallPool);
    const takeL = Math.min(sL, initLargePool);
    initSmallPool -= takeS;
    initLargePool -= takeL;
    races.push({
      target: genesis,
      sSmall: takeS,
      sLarge: takeL,
      token: t,
      birth: 0,
      fullStaffed: 0,
      birthMStar: m0,
    });
  }
  // λ accumulators (persist across slots; indices stable — append-only).
  const relAccS: number[] = new Array(n0).fill(0);
  const relAccL: number[] = new Array(n0).fill(0);
  const wantAccS: number[] = new Array(n0).fill(0);
  const wantAccL: number[] = new Array(n0).fill(0);

  let pentUp = 0;
  let pLast = p0;
  let blocks = 0;
  let issuanceNative = 0;
  let energyUsd = 0;
  let profitUsd = 0;
  let deployCostUsd = 0;
  let issuerProfitUsd = 0;
  let unfilledUsd = 0;
  let abandonedUsd = 0;
  let idleSlots = 0;
  let deployments = 0;
  let priceNum = 0;
  let priceDen = 0;
  let minPrice = Infinity;
  let slideSlots = -1;
  let endSmallM = 0;
  let endLargeM = 0;
  let benchUseEnd = 0;
  const pricePath: number[] = [];
  const activePath: number[] = [];
  const deployedPath: number[] = [];
  // Adaptive obscurity window: trailing mean birth-to-full-staff.
  const windowSamples: number[] = [];
  const windowEst = (): number => {
    if (p.obscurityWindow !== undefined) return p.obscurityWindow;
    if (windowSamples.length === 0) return 10;
    return (
      windowSamples.reduce((a, b) => a + b, 0) / windowSamples.length
    );
  };

  // Running idle pools (recomputed each slot, decremented per deploy).
  let smallIdle = 0;
  let largeIdle = 0;
  const refreshIdle = (): void => {
    smallIdle = Math.max(
      0,
      smallN - races.reduce((a, r) => a + r.sSmall, 0),
    );
    largeIdle = Math.max(
      0,
      largeN - races.reduce((a, r) => a + r.sLarge, 0),
    );
  };

  for (let slot = 1; slot <= p.slots; slot++) {
    const deff = p.demandUsd(slot) + pentUp;
    let activeCount = 0;
    for (const r of races) if (staffOf(r) >= 1) activeCount++;
    // Idle expectation = solo-pay on effective demand (a coordinated
    // entrant takes all of deff), NOT the bare R-cap (which mirage-
    // floods M* and churns dead markets into deployment ruptures).
    const pEst =
      activeCount > 0
        ? Math.min(deff / activeCount, R * designTier)
        : Math.min(deff, R * designTier);

    // ---- Deploy (up to G): baton if room, else clone. ----
    // Both modes start at E0 (unmined batons are fresh); they differ
    // only in creation fee — so batons fill first, then clones.
    // Lottery solo flow: the deployer burns the FULL E0.
    const flow0 = pEst - F - E0 - o;
    const wantOf = (c: number): number => {
      if (foresight === 'myopic-flow') return flow0 > 0 ? flow0 : -1;
      if (foresight === 'myopic-payback') return flow0 > c ? flow0 : -1;
      return flow0 * windowEst() > c ? flow0 * windowEst() - c : -1;
    };
    refreshIdle();
    // Worst-paid race, scanned once per slot (redeploy source).
    let worstIdx = -1;
    const findWorst = (): number => {
      let worst = -1;
      let worstPay = Infinity;
      for (let i = 0; i < races.length; i++) {
        const r = races[i];
        const s = staffOf(r);
        if (s < 1) continue;
        // Lottery unit pay: revenue AND block energy split s ways.
        const pay = (pEst - F - eAt(r.target)) / s - o;
        if (pay < worstPay) {
          worstPay = pay;
          worst = i;
        }
      }
      return worst;
    };
    worstIdx = findWorst();
    for (let g = 0; g < G; g++) {
      const roomyExists = tokenBatons.some(b => b < BATONS_PER_TOKEN);
      const wantBaton = roomyExists ? wantOf(cBaton) : -1;
      const wantClone = wantOf(cClone + (roomyExists ? 0 : cBaton));
      if (wantBaton < 0 && wantClone < 0) break;
      const fresh = wantClone > wantBaton;
      const cMode = fresh ? cClone + cBaton : cBaton;
      // Deployer body, LARGE-PRIORITY: idle-large, else redeploy a
      // large body from the worst-paid race, else idle-small, else
      // redeploy small. Operators prefer bodies that STICK (large
      // units stay gated-in on thin races; small newborns gate-drain
      // within 2 slots past the small-lock (P < E+F+25o) — wasted
      // deployment). Deployers are capitalized operators
      // (float-EXEMPT: burning full E0 solo is capital, and unit
      // float gates opex ENTRY only — otherwise grand (E0=$250)
      // could never deploy (no unit floats $250 solo)).
      let dS = 0;
      let dL = 0;
      const takeLargeFromWorst = (): boolean => {
        while (worstIdx >= 0 && races[worstIdx].sLarge < 1) {
          // Worst race has no large body — scan for a large donor.
          let donor = -1;
          let donorPay = Infinity;
          for (let i = 0; i < races.length; i++) {
            if (races[i].sLarge < 1) continue;
            const s = staffOf(races[i]);
            const pay = (pEst - F - eAt(races[i].target)) / s - o;
            if (pay < donorPay) {
              donorPay = pay;
              donor = i;
            }
          }
          if (donor < 0) return false;
          worstIdx = donor;
          break;
        }
        if (worstIdx < 0 || races[worstIdx].sLarge < 1) return false;
        races[worstIdx].sLarge -= 1;
        return true;
      };
      if (largeIdle >= 1) {
        dL = 1;
        largeIdle -= 1;
      } else if (takeLargeFromWorst()) {
        dL = 1;
      } else if (smallIdle >= 1) {
        dS = 1;
        smallIdle -= 1;
      } else {
        while (worstIdx >= 0 && staffOf(races[worstIdx]) < 1)
          worstIdx = findWorst();
        if (worstIdx < 0) break;
        const worst = races[worstIdx];
        if (worst.sSmall >= 1) {
          worst.sSmall -= 1;
          dS = 1;
        } else break;
      }
      const t = tokenFor(fresh);
      tokenBatons[t]++;
      const birthM = Math.max(
        0,
        Math.floor(((1 - royalty) * pEst - F - E0) / o),
      );
      races.push({
        target: genesis,
        sSmall: dS,
        sLarge: dL,
        token: t,
        birth: slot,
        fullStaffed: birthM < 2 ? slot : -1,
        birthMStar: birthM,
      });
      relAccS.push(0);
      relAccL.push(0);
      wantAccS.push(0);
      wantAccL.push(0);
      if (birthM < 2) {
        windowSamples.push(1);
        if (windowSamples.length > 50) windowSamples.shift();
      }
      deployCostUsd += cMode;
      deployments++;
    }

    // ---- Staffing: integer bodies, λ via accumulators. ----
    // Exits/entries move whole miners race-by-race in bucket order;
    // fractional λ-shares accumulate deterministically (no smear, no
    // fractional limbo — a miner joins ONE race or none).
    const entryMode = p.entryMode ?? 'chasing';
    const pExp = pEst;
    const sTgt: number[] = new Array(races.length).fill(0);
    const lTgt: number[] = new Array(races.length).fill(0);
    const occupied: boolean[] = races.map(r => staffOf(r) >= 1);
    for (let i = 0; i < races.length; i++) {
      const r = races[i];
      const eBlock = eAt(r.target);
      const mStar = Math.max(
        0,
        Math.floor(((1 - royalty) * pExp - F - eBlock) / o),
      );
      // First-body floor: an occupied race with solo flow above -H
      // keeps 1 body (switching costs + issuer royalty washing).
      const stayFloor =
        occupied[i] && pExp - F - eBlock - o > -H ? 1 : 0;
      const keepTarget = Math.max(mStar, stayFloor);
      // Affordability gate: a class staffs this race only if its
      // expected unit burn (E/keepTarget) fits its float. Smalls ride
      // fat races (E/150 = $0.0017) but never solo ($0.25); grand
      // needs keepTarget >= 25 for large entry ($250/25 = $10).
      const sElig =
        keepTarget > 0 && eBlock <= smallFloat * keepTarget ? smallN : 0;
      const lElig =
        keepTarget > 0 && eBlock <= largeFloat * keepTarget ? largeN : 0;
      const elig = sElig + lElig;
      // Integer split (ROUND, not floor — floor starves the minority
      // pool at small keepTargets and flickers; round + overflow
      // backstop keeps composition smooth across M*).
      const sT =
        elig > 0 ? Math.round((keepTarget * sElig) / elig) : 0;
      sTgt[i] = Math.min(sT, keepTarget);
      lTgt[i] = elig > 0 ? keepTarget - sTgt[i] : 0;
    }
    const order: number[] = [];
    const wanted = (i: number): boolean => sTgt[i] + lTgt[i] > 0;
    if (entryMode === 'sticky') {
      for (let i = 0; i < races.length; i++)
        if (wanted(i) && occupied[i]) order.push(i);
      for (let i = races.length - 1; i >= 0; i--)
        if (wanted(i) && !occupied[i]) order.push(i);
    } else {
      // chasing (+ uniform fallback order, unused): dormant, thin, fat.
      for (let i = races.length - 1; i >= 0; i--)
        if (wanted(i) && staffOf(races[i]) < 1) order.push(i);
      for (let i = races.length - 1; i >= 0; i--) {
        const s = staffOf(races[i]);
        if (wanted(i) && s >= 1 && s < 2) order.push(i);
      }
      for (let i = races.length - 1; i >= 0; i--)
        if (wanted(i) && staffOf(races[i]) >= 2) order.push(i);
    }
    // Exits release whole bodies above target back to the pools.
    refreshIdle();
    let sPool = Math.round(smallIdle);
    let lPool = Math.round(largeIdle);
    for (let i = 0; i < races.length; i++) {
      const r = races[i];
      if (r.sSmall > sTgt[i]) {
        relAccS[i] += lam * (r.sSmall - sTgt[i]);
        const rel = Math.min(r.sSmall - sTgt[i], Math.floor(relAccS[i]));
        r.sSmall -= rel;
        sPool += rel;
        relAccS[i] -= rel;
      } else relAccS[i] = 0;
      if (r.sLarge > lTgt[i]) {
        relAccL[i] += lam * (r.sLarge - lTgt[i]);
        const rel = Math.min(r.sLarge - lTgt[i], Math.floor(relAccL[i]));
        r.sLarge -= rel;
        lPool += rel;
        relAccL[i] -= rel;
      } else relAccL[i] = 0;
    }
    // Entries admit whole bodies toward target, pool-capped in order.
    // (Uniform: instant thin spread — each wanted race gets
    // floor(pool/nWanted); when nWanted > pool the spread starves and
    // only deployer-births sustain active (freeze ABOVE MC).)
    if (entryMode === 'uniform') {
      const nW = order.length;
      const qS = nW > 0 ? Math.floor(sPool / nW) : 0;
      const qL = nW > 0 ? Math.floor(lPool / nW) : 0;
      for (const i of order) {
        const r = races[i];
        const admS = Math.min(qS, Math.max(0, sTgt[i] - r.sSmall));
        const admL = Math.min(qL, Math.max(0, lTgt[i] - r.sLarge));
        r.sSmall += admS;
        r.sLarge += admL;
        sPool -= admS;
        lPool -= admL;
      }
    } else
      for (const i of order) {
        const r = races[i];
        if (r.sSmall < sTgt[i]) {
          wantAccS[i] += lam * (sTgt[i] - r.sSmall);
          const adm = Math.min(
            sTgt[i] - r.sSmall,
            sPool,
            Math.floor(wantAccS[i]),
          );
          r.sSmall += adm;
          sPool -= adm;
          wantAccS[i] -= adm;
        } else wantAccS[i] = 0;
        if (r.sLarge < lTgt[i]) {
          wantAccL[i] += lam * (lTgt[i] - r.sLarge);
          const adm = Math.min(
            lTgt[i] - r.sLarge,
            lPool,
            Math.floor(wantAccL[i]),
          );
          r.sLarge += adm;
          lPool -= adm;
          wantAccL[i] -= adm;
        } else wantAccL[i] = 0;
      }
    // Overflow: races still below keep-target pull from EITHER pool
    // with bodies (small-first backstop — bodies are fungible when
    // the race's unit burn fits their float).
    if (entryMode !== 'uniform') {
      for (const i of order) {
        const r = races[i];
        const eBlock = eAt(r.target);
        const keepT = sTgt[i] + lTgt[i];
        let gap = keepT - staffOf(r);
        if (gap <= 0) continue;
        if (eBlock <= smallFloat * keepT && sPool > 0) {
          wantAccS[i] += lam * gap;
          const adm = Math.min(gap, sPool, Math.floor(wantAccS[i]));
          r.sSmall += adm;
          sPool -= adm;
          wantAccS[i] -= adm;
          gap -= adm;
        }
        if (gap > 0 && eBlock <= largeFloat * keepT && lPool > 0) {
          wantAccL[i] += lam * gap;
          const adm = Math.min(gap, lPool, Math.floor(wantAccL[i]));
          r.sLarge += adm;
          lPool -= adm;
          wantAccL[i] -= adm;
        }
      }
    }
    // Obscurity sampling: birth-to-full-staff for new races.
    for (const r of races) {
      if (
        r.birth > 0 &&
        r.fullStaffed < 0 &&
        staffOf(r) >= Math.max(1, r.birthMStar)
      ) {
        r.fullStaffed = slot; // reached birth M* (full pile-in)
        windowSamples.push(Math.max(1, slot - r.birth));
        if (windowSamples.length > 50) windowSamples.shift();
      }
    }

    // ---- Clear (v5 accounting). ----
    const filled: Race[] = races.filter(r => staffOf(r) >= 1);
    const nActive = filled.length;
    if (nActive === 0) {
      idleSlots++;
      unfilledUsd += deff;
      abandonedUsd += (1 - patience) * deff;
      pentUp = patience * deff;
      pLast = 0;
      pricePath.push(0);
      activePath.push(0);
      deployedPath.push(races.length);
      continue;
    }
    const pClear = deff / nActive;
    const pTrade = Math.min(pClear, R * designTier);
    const revenue = nActive * pTrade;
    const unfilled = Math.max(0, deff - revenue);
    unfilledUsd += unfilled;
    abandonedUsd += (1 - patience) * unfilled;
    pentUp = patience * unfilled;
    pLast = pTrade;
    priceNum += pTrade;
    priceDen++;
    if (pTrade < minPrice) minPrice = pTrade;
    if (slideSlots < 0 && pTrade <= 1.1 * mcSolo) slideSlots = slot;

    let eSlot = 0;
    let msSlot = 0;
    let mlSlot = 0;
    for (const r of filled) {
      // Lottery energy: E_block per active race (split among staff,
      // NOT per-entrant — the race burns one solution's electricity).
      eSlot += eAt(r.target);
      msSlot += r.sSmall;
      mlSlot += r.sLarge;
    }
    blocks += nActive;
    issuanceNative += nActive * 100;
    energyUsd += eSlot;
    profitUsd += revenue - nActive * F - eSlot;
    issuerProfitUsd += royalty * revenue;

    // ---- Treadmill: active races step exactly once. ----
    for (const r of filled) r.target = microStepV5(r.target);

    endSmallM = msSlot / nActive;
    endLargeM = mlSlot / nActive;
    benchUseEnd = 1 - (sPool + lPool) / (smallN + largeN);
    pricePath.push(pLast);
    activePath.push(nActive);
    deployedPath.push(races.length);
  }

  let finalActive = 0;
  for (const r of races) if (staffOf(r) >= 1) finalActive++;
  return {
    slots: p.slots,
    deployed: races.length,
    tokens: tokenBatons.length,
    activeEnd: finalActive,
    dormantEnd: races.length - finalActive,
    priceEnd: pLast,
    meanPrice: priceDen > 0 ? priceNum / priceDen : 0,
    minPrice: minPrice === Infinity ? 0 : minPrice,
    blocks,
    issuanceNative,
    energyUsd,
    profitUsd,
    deployCostUsd,
    issuerProfitUsd,
    unfilledUsd,
    abandonedUsd,
    idleSlots,
    endSmallM,
    endLargeM,
    benchUseEnd,
    slideSlots,
    windowEnd: windowEst(),
    deployRate: deployments / p.slots,
    maxBatons: Math.max(...tokenBatons),
    pricePath,
    activePath,
    deployedPath,
  };
}
