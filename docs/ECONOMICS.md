# Economics — nWLPOW → mWLPOW → WLOTUS

## Ritual loop

| Action | Meaning | Supply |
|--------|---------|--------|
| **Burn** | Sacrifice / vàng mã offering | Destroys tokens |
| **Remint** | Pure PoW rebirth | Creates tokens |

Burn does **not** cancel remint. Mint is always **100 tokens / remint** @ **0** decimals. Moore δ adjusts **work**, not mint size.

---

## The ASIC problem (why the old plan failed)

SHA-256d is the same family ASICs already grind for Bitcoin/eCash PoW.

| Machine | Ballpark hashrate | Efficiency |
|---------|-------------------|------------|
| This VM / laptop (JS) | ~**0.5–5 MH/s** | ~1 µJ/hash (CPU, rough) |
| Phone (JS) | ~**0.05–0.5 MH/s** | worse $/hash than laptop |
| Modern ASIC | ~**100 TH/s** (1e14 H/s) | ~**15–25 J/TH** |

**Cost per hash (order of magnitude):**

| | Assumption | ≈ USD / hash |
|--|--|--|
| ASIC | 20 J/TH, **$0.08 / kWh** | **~4.4×10⁻¹⁹** |
| Laptop CPU | 1 µJ/hash, $0.15 / kWh | **~4×10⁻¹⁴** |

ASIC hashing is ~**10⁵× cheaper per hash** than a PC. So:

> If difficulty is only “1000× dogfood” (~10⁵ hashes), a 100 TH/s ASIC mints a baton in **microseconds** for **≪ $10⁻¹²**. A **$1 / token** sticker would be pure inflation vs real energy.

**Correction:** production **WLOTUS** difficulty must be set from **ASIC electricity**, not from “a bit harder than a laptop demo.”

Incubation tokens (**nWLPOW** / **mWLPOW**) are **UX-timed** (phone/PC effort). Their market price is **ritual / access / fee**, not an ASIC joule peg — professionals *can* print them cheaply; that is accepted until WLOTUS, and burns + app design absorb farm pressure.

---

## Two pricing regimes

| Regime | Applies to | Difficulty set by | Price meaning |
|--------|------------|-------------------|---------------|
| **A. Effort (UX)** | nWLPOW, mWLPOW | Desired wall-clock on phone/PC | Soft market; not energy-fair vs ASICs |
| **B. Energy (ASIC)** | **WLOTUS** | Electricity $ at reference J/TH | Floor for “real” token |

### Reference ASIC formula (WLOTUS)

\[
E[\mathrm{hashes}] \approx \frac{\$_{\mathrm{remint}}}{\$/\mathrm{kWh}} \times 3.6\times10^{6}\,\mathrm{J/kWh} \times \frac{10^{12}}{J/\mathrm{TH}}
\]

With **$1 / token**, 100 tokens/remint ⇒ **$100 / remint**, at **$0.08/kWh**, **20 J/TH**:

| Quantity | Value |
|----------|-------|
| E[hashes] / remint | **≈ 2.25×10²⁰** |
| ≈ leading zero **bits** | **≈ 67.6** |
| ≈ leading zero **bytes** | **≈ 8.45** |
| Time on **100 TH/s** | **≈ 26 days / remint** |
| Remints / day @ 100 TH/s | **≈ 0.04** |

So **$1/token is scarce** on a single hobby ASIC — closer to a small farm (e.g. **~1 PH/s** ⇒ ~0.4 remints/day). That is intentional if WLOTUS is meant to be energy-heavy. For denser issuance, lower the USD target or raise efficiency assumptions explicitly.

**Lower bound check ($0.01/token = $1/remint)** at same ASIC assumptions: E[H]≈2.25×10¹⁸ (~61 bits), ~**6 hours** on 100 TH/s — still ASIC territory, still impossible on a PC.

---

## Launch ladder (adjusted plan)

Always **100 atoms / remint**, **0 decimals**. Conversion peg (nominal):

```
1_000_000 nWLPOW  ≈  1_000 mWLPOW  ≈  1 WLOTUS
```

| Tier | Ticker | Who mints | Target wall-clock | E[hashes] (order) | ≈ bits | Intent market $/token | $/remint |
|------|--------|-----------|-------------------|-------------------|--------|------------------------|----------|
| Launch | **nWLPOW** | Phone / PC | **~1–5 min** phone | **~2×10⁷** | **~24–25** | ~**$10⁻⁶** | ~**$10⁻⁴** |
| Incubation | **mWLPOW** | Normal PC | **~15–120 min** | **~10⁹–6×10⁹** | **~30–33** | ~**$10⁻³** | ~**$0.1** |
| Production | **WLOTUS** | Pro ASIC | ASIC economics | **~2×10²⁰** | **~68** | **~$1** (or more) | **~$100** |

### Recommended genesis defaults (freeze before each launch)

| Param | nWLPOW | mWLPOW | WLOTUS |
|-------|--------|--------|--------|
| `POW_BASE_ZERO_BITS` | **25** | **30** | **68** (or compact target ≡ same E[H]) |
| E[hashes] | \(2^{25}\) ≈ 3.4e7 | \(2^{30}\) ≈ 1.1e9 | \(2^{68}\) ≈ 3e20 (tune to ASIC sheet) |
| PC @ 0.85 MH/s | ~**40 s** | ~**21 min** | impossible |
| PC @ 5 MH/s native | ~**7 s** | ~**3.5 min** | impossible |
| Phone @ 0.15 MH/s | ~**3–4 min** | hours | impossible |
| 100 TH/s ASIC | instant / free | instant / free | **~weeks / remint** |

**Live dogfood mWLPOW** (Ergon/Moore test tokens on mainnet) still uses **toy difficulty** (~2⁷–2⁹ hashes) for covenant plumbing. **Next incubation genesis should ship nWLPOW @ ~25 bits** (or raise mWLPOW to ~30 bits). Do not treat current mainnet dogfood D as the economic plan.

---

## Moore / Koomey (unchanged role)

Ergon post-fix **δ = 99918/100000** (~2.3y half-life) applies to **required work** after genesis:

- Incubation: optional / dogfood (bit schedule or daily compact target)
- WLOTUS: **required** so real ASIC cost tracks efficiency (Koomey), mint stays 100

δ does **not** replace setting a correct **genesis** energy difficulty for WLOTUS.

---

## What price can actually mean

| Claim | Valid? |
|-------|--------|
| “n/m take minutes on a phone/PC” | **Yes** — set bits/target from hashrate × minutes |
| “n/m cost ~$X of laptop electricity” | **Mostly no** — even 2h PC is ≪ $0.01 of kWh |
| “WLOTUS ~$1/token from energy” | **Yes, if D ≈ ASIC formula above** (+ margin/fees) |
| “1000× dogfood ⇒ $0.01/token” | **No** — ASICs break that |

---

## Elasticity

```
coins/time ≈ N_batons × (hashrate / E[hashes_per_solution]) × 100
```

At WLOTUS energy D, issuance is slow unless hashrate is industrial. At n/m UX D, coins/time tracks whatever hashrate shows up (including ASICs).

## Miner note

Remint covenants use **3 outputs**; excess fuel is fee. Empp **WLDF** announces difficulty beside ALP MINT.

## Parameter source of truth

- Ladder + ASIC sheet: `src/params/pricing.ts`
- Consensus tickers / bits: `src/params/consensus.ts`
- Recompute: `npm run pricing`
