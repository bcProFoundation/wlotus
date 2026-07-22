# Proposal: White Lotus on eCash

**Recommendation: build White Lotus as an Ergon-like ALP token on eCash first. Do not launch an L1 unless the token proves ritual demand and outgrows eCash rails.**

Canonical brand: [VISION.md](./VISION.md).  
Canonical economics: [ECONOMICS_WLOTUS_GLOTUS.md](./ECONOMICS_WLOTUS_GLOTUS.md).

---

## 1. Decision

| Option | Role |
|--------|------|
| **A. White Lotus on eCash (ALP + PoW remint)** | **Primary — ship this** |
| **B. White Lotus L1 (eCash/Ergon-style fork)** | Contingency only — after product-market fit |

Ritual need (**vàng mã–style memorial sacrifice** + **dana to the commons** + rebirth) is satisfied by **issuance rules**, not by owning a blockchain. eCash already gives maintenance, Chronik, wallets, and Agora.

---

## 2. Why A over B (now)

| Criterion | ALP on eCash | New L1 |
|-----------|--------------|--------|
| Work-elastic issuance | Yes — remint frequency ∝ hashrate (+ Moore) | Yes — subsidy ∝ difficulty (+ Moore) |
| Memorial burn + rebirth | Yes — burn + perpetual baton(s) | Yes — native burn + subsidy |
| Ops burden | App + covenant + miner | Full node, miners, explorers forever |
| User acquisition | XEC → desk/Agora → burn | Need exchange liquidity for new coin |
| Time to a working product | Much shorter | Much longer |

---

## 3. Product architecture (Option A)

### 3.1 Narrative

- **WLotus** — burnable white lotus (hoa sen trắng): Vietnamese memorial flower
- **One burn, two gifts:** memorial for the dead **and** dana for everybody — wealth destroyed, not sold
- **Vs vàng mã:** same memorial spirit; no maker/seller captures the gift
- Cycle: *effort remints the lotus → devotee burns it (memory + dana) → merit is public → lotus can bloom again*
- Companion: **GLOTUS** (Golden Lotus) for scarce event / commerce value

### 3.2 Token

| Item | Choice |
|------|--------|
| Host | eCash (XEC) |
| Protocol | **ALP** (`SLP2` / eMPP) |
| Tickers | `WLOTUS` (ceremonial) · `GLOTUS` (economic, later) · `dWLOTUS` (test) |
| Mint authority | **Permissionless PoW covenants** on **28** mint batons |
| wLotus split | **108** → **1** miner + **107** temple P2SH |
| Burn | Intentional `alpBurn` + memorial metadata |
| Indexer | Chronik |

### 3.3 Issuance — mala remint + Moore on work

- **wLotus:** fixed mint **108** / remint; temple tax **107/108**; base bits **0**; Moore **+1 bit / 500 days**; sunset at **128**
- **GLOTUS:** permissionless; **no** temple mint tax; premine disclosed; own difficulty schedule
- **Moore / Koomey reference** `δ = 99918/100000` (Ergon corrected) — never obsolete `99826`
- Many remints per eCash block via **N = 28** batons; desk may serve fewer tips

```
coins/time ≈ N_served × (1 / T_cycle) × 108
```

#### Canonical knobs (wLotus)

| Knob | Setting | Role |
|------|---------|------|
| Base bits | **0** | Max headroom to 128 sunset |
| Mint | Fixed **108** | One mala |
| Split | **1 + 107** | Anti-farm + desk inventory |
| Batons `N` | **28** | Parallel remints |
| Moore period | **500 days** / bit | Slow dearening |
| Desk tips | **1** at launch | Fee ceiling |
| Soft pray | `VITE_MIN_PRAY_SECONDS` | Attention tax (off-chain) |

### 3.4 App flow

```
Devotee opens Offer
  → device PoW → mint-api remint (sponsored XEC)
  → soft pray hold → alpBurn (memorial + dana)
  → Chronik + API update

Parallel:
  Permissionless miners may remint on remaining tips (pay own XEC; 107→temple)
```

### 3.5 Multiple mint batons

- Genesis creates **28** identical PoW covenant batons (ALP max).
- Each successful spend: PoW OK → mint **108** (1+107) → **return one baton** (conserve `N`).
- Desk serves a subset of tips without stranding future parallelism.

**Invariant:** PoW batons are never burned.

---

## 4. Option B — L1 (when, and only when)

Consider an L1 **only if**:

1. Sustained burn volume and cultural adoption
2. eCash fee / policy / tooling constraints block the ritual
3. You accept permanent chain ops
4. You want hard fork-fairness as a first-class property

Until then, L1 is premature.

---

## 5. Phased delivery (Option A)

| Phase | Deliverable |
|-------|-------------|
| **0** | Spec + MooreTip temple covenant + clock |
| **1** | `dWLOTUS` dryrun + Offer UI + mint-api desk |
| **2** | Live `WLOTUS` genesis + prod deploy |
| **3** | Agora / desk liquidity + public burn explorer |
| **4** | `GLOTUS` genesis (premine + open remint) |
| **5** | Revisit L1 only with evidence |

---

## 6. Explicit non-goals (v1)

- USD stablecoin
- Fixed max supply
- Lotus-style `log(D)` inelastic subsidy
- Ergon’s obsolete Moore factor `99826/100000`
- Mist-style 1-mint-per-host-block CLTV
- Launching a new L1 to “build community faster”
- Multi-tier product ladder (retired)

---

## 7. One-line decision

**White Lotus = ALP on eCash with parallel PoW remint batons, mala mint (108 → 1+107), Moore calendar bits, and burn-as-memorial+dana. GLOTUS is the economic companion. L1 only after the ritual works.**
