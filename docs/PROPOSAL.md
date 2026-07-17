# Proposal: White Lotus — Ergon-like ritual coin

**Recommendation: build White Lotus as an Ergon-like ALP token on eCash first. Do not launch an L1 unless the token proves ritual demand and outgrows eCash rails.**

---

## 1. Decision

| Option | Role |
|--------|------|
| **A. White Lotus on eCash (ALP + PoW remint)** | **Primary — ship this** |
| **B. White Lotus L1 (eCash/Ergon-style fork)** | Contingency only — after product-market fit |

Ritual need (vàng mã sacrifice + rebirth + commons) is satisfied by **issuance rules**, not by owning a blockchain. eCash already gives maintenance, Chronik, wallets, and Agora. An L1 buys fork-fairness and sovereign monetary policy at the cost of becoming a chain operator.

---

## 2. Why A over B (now)

| Criterion | ALP on eCash | New L1 |
|-----------|--------------|--------|
| Work-elastic issuance | Yes — remint *frequency* ∝ hashrate (+ Moore) | Yes — `GetBlockSubsidy ∝ difficulty` (+ Moore) |
| Vàng mã burn + rebirth | Yes — burn + perpetual baton(s) | Yes — native burn + subsidy |
| Holder-capture vs Lotus `log(D)` | Avoided (issuance answers work) | Avoided if subsidy ∝ `D` |
| Ops burden | App + covenant + miner | Full node, miners, explorers, upgrades forever |
| User acquisition of offering | XEC → Agora/desk → burn | Need exchange/liquidity for new coin |
| Maintenance of base chain | Bitcoin ABC / eCash | You |
| Fork-energy fairness | Soft (token PoW) | Strong (L1 work) |
| Time to a working temple | Much shorter | Much longer |

Lotus Temple already showed: **elastic but inelastic issuance (`log D`) + burns** enriched holders. Fix issuance, don’t fork a nation-state chain on day one.

---

## 3. Product architecture (Option A)

### 3.1 Narrative

- **White Lotus (hoa sen trắng)** — Vietnamese mourning / purity symbol  
- Cycle: *effort remints the flower → devotee burns it → merit is public → flower can bloom again*  
- Cumulative burned = spiritual ledger; circulating supply is secondary  

### 3.2 Token

| Item | Choice |
|------|--------|
| Host | eCash (XEC) |
| Protocol | **ALP** (`SLP2` / eMPP) |
| Ticker (example) | `WLOTUS` / `WLTS` |
| Mint authority | **Permissionless PoW covenants** on **multiple** mint batons |
| Burn | Intentional `alpBurn` + memorial metadata (person / temple / offering tier) |
| Indexer | Chronik |
| Liquidity | Agora + optional temple desk (XEC ↔ token) |

### 3.3 Issuance — remint frequency + Moore decay

**Insight:** On Ergon, block *rate* is held ~constant by the DAA, so elasticity lives in **coins per block** (`∝ D`). On an ALP PoW remint, invert that:

- Fixed PoW difficulty; base atoms per remint before Moore  
- **Many remints per eCash block** (no Mist “1 mint / host block” CLTV)  
- **Multiple ALP mint batons** for **true parallel** remints (§3.5)  
- ⇒ **remints/time ∝ hashrate** ⇒ **coins/time ∝ hashrate**

```
coins/time ≈ N_batons × (hashrate_per_baton / hashes_per_solution) × M(t)
```

No token DAA and no `mintAmount ∝ work(D)` required for Ergon-like *flow*.

#### Moore / Koomey — Ergon **post-launch** constant only

Ergon’s daily correction in [`validation.cpp` (GetBlockSubsidy)](https://github.com/Ergon-moe/Bitcoin-Static/blob/2e8d5f7635c899cc99e71f06dedbe72b3ff7f07b/src/validation.cpp#L978):

```cpp
// Pre-EMA (obsolete ~1.1y half-life) — DO NOT USE FOR WLOTUS
aWork *= 99826; aWork /= 100000;

// Post-EMA / corrected (~2.3y half-life) — USE THIS
aWork *= 99918; aWork /= 100000;
```

Bitcoin Static release notes fixed Moore from **1.1y → 2.3y**. **WLOTUS ships `δ = 99918/100000` from genesis** — never the old `99826` factor.

| Symbol | WLOTUS | Notes |
|--------|--------|-------|
| `δ` | **`99918 / 100000`** | Ergon corrected daily factor |
| Day step | ~1 wall day | Ergon: once per `nSubsidyHalvingInterval` (144 × 10‑min blocks). Mirror with ~144 eCash blocks or median-time day |
| `M(t)` | `M₀ · δ^{k}` | `k = floor(elapsed_days)` since genesis |
| Clock | **eCash height / median time** | **Not** token-mint height (that races with hashrate) |

Covenant integer form:

```
M_expected = M₀
repeat k times:
    M_expected = (M_expected * 99918) / 100000
verify mintAtoms == M_expected
```

#### Canonical knobs

| Knob | Setting | Role |
|------|---------|------|
| PoW difficulty `D` | Fixed, tunable | Effort per remint solution |
| Base atoms `M₀` | Genesis constant | Initial unlock per solution |
| Moore `δ` | **`99918/100000`** | ~2.3y half-life efficiency decay |
| Host CLTV 1-mint/block | **Off** | Keep hashrate → issuance elasticity |
| Supply cap | **None** | Batons never die |
| PoW baton count `N` | **`N ≥ 2` at genesis** | True parallel remints (§3.5) |

**Skip unless needed later:** token-local DAA; `mintAmount ∝ work(D)`.

Tune `D` / `M₀` / `N` from burn demand and miner contention. Each remint pays XEC fees (anti-spam).

### 3.4 App flow

```
Devotee opens memorial page
  → acquires WLOTUS (Agora / desk / gifted)
  → chooses offering (flower / incense / candle = burn tiers)
  → alpBurn + eMPP memorial payload
  → Chronik + API update cumulative merit

Parallel:
  Miners race across N PoW batons → remint → sell / provide liquidity
```

Reuse `app-lotus-temple` UX; retarget settlement from XPI burns to ALP burns on eCash.

### 3.5 Multiple mint batons (first-class parallelization)

ALP allows **many mint batons** (SLP allowed only one). White Lotus treats multi-baton as **core design**.

**A. PoW baton set (canonical issuance)**

- Genesis creates **`N ≥ 2` identical PoW covenant batons** (independent tips, same rules).  
- Miners remint **in parallel** in the same eCash block — not merely a serial chain on one tip.  
- Each successful spend: PoW OK → mint exactly `M(t)` → **return one baton** to the next covenant state (**conserve `N`**).  
- Choose `N` at genesis (e.g. 4–16); change only via a deliberate migration if ever required.

This is how “multiple mints per block” becomes **true parallelization** and matches frequency-elasticity in §3.3. A single baton alone still serializes and wastes work under load.

**B. Optional temple baton (bootstrap only)**

- Separate rate-limited / multi-sig baton for cold-start or emergency.  
- Prefer destroying it once PoW batons + Agora liquidity exist.

**Invariant:** PoW batons are never burned; temple baton may be retired.

---

## 4. Option B — L1 (when, and only when)

Consider a White Lotus / Ergon-like L1 **only if**:

1. Temple has sustained burn volume and cultural adoption  
2. eCash fee / policy / tooling constraints block the ritual  
3. You accept permanent chain ops (or a funded commons to run them)  
4. You want hard fork-fairness (“energy can’t be counted twice”) as a first-class property  

Then: fork a maintained UTXO codebase, set work-elastic subsidy + **`δ = 99918/100000` Moore**, **0% founder fund**, fee burn optional. Port the temple app to native burns.

Until then, L1 is premature optimization of sovereignty.

---

## 5. Phased delivery (Option A)

| Phase | Deliverable |
|-------|-------------|
| **0** | Spec: covenant rules, `M(t)` with `δ=99918/100000`, burn LOKAD, **`N` baton policy** |
| **1** | GENESIS (`N` PoW batons) + Chronik + temple burn UI (custodial remint OK to dogfood) |
| **2** | PoW remint covenant + miner (fixed `D`, Moore on wall-time, **multi-baton parallel**, no 1-mint/block CLTV) |
| **3** | Agora market + public cumulative-burn explorer |
| **4** | Retune `D` / `M₀` / `N` from burn & hashrate data |
| **5** | Revisit L1 only with evidence from 1–4 |

---

## 6. Explicit non-goals (v1)

- USD stablecoin  
- Fixed max supply  
- Lotus-style `log(D)` inelastic subsidy  
- Ergon’s obsolete Moore factor `99826/100000`  
- Mist-style 1-mint-per-host-block CLTV  
- Launching a new L1 to “build community faster”  
- Relying on TBP (not needed on eCash)  

---

## 7. One-line decision

**White Lotus = ALP on eCash with parallel PoW remint batons, fixed `D`, Moore `δ=99918/100000`, and burn-as-vàng-mã. L1 only after the ritual works.**
