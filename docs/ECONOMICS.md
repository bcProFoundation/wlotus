# Economics — nWLotus → mWLotus → WLotus

## Ritual loop

| Action | Meaning | Supply |
|--------|---------|--------|
| **Burn** | Sacrifice / vàng mã offering | Destroys tokens |
| **Remint** | Pure PoW rebirth | Creates tokens |

Mint is always **100 tokens / baton** @ **0** decimals. Moore δ adjusts **work**, not mint size.  
**All three tiers can run in parallel.** Launch starts with **nWLotus**.

---

## Energy cost vs token (market) price

**Verdict for WLotus:** the **$1 / baton** figure is the **target market (token) price**, not energy cost.

| Term | Meaning | WLotus number |
|------|---------|---------------|
| **Energy cost** | Electricity (kWh) only for one PoW solution | ≈ **$0.25** / baton on the ref. ASIC sheet |
| **All-in operating cost** | Electricity + hardware + space/facility + labor/ops | ≈ **$0.60** / baton (illustrative stack) |
| **Target market price** | What the baton clears at (business revenue) | **$1.00** / baton (= **$0.01** / token) |
| **Risk margin** | Market − all-in | ≈ **$0.40** / baton (**40%**) |

**Ergon-style mining is a normal business for profit**, not speculative NGU: operators remint when expected **market proceeds ≥ all-in cost + margin**. They cannot rely on “number go up” to subsidize unprofitable work, so difficulty must leave room for real opex — **not** set “electricity alone = sticker price.”

### Why not 10% margin?

A **~10%** net is a mature-commodity / thin-spread business. WLotus is a **new, illiquid market** (demand and clearing price are risky). Typical planning bands:

| Context | Typical margin / buffer |
|---------|-------------------------|
| Mature commodity / thin MoE | ~10–15% net |
| Healthy liquid PoW mining (good years) | ~**30–45%** mining margin vs power |
| **New / early / illiquid markets** | ~**30–50%** of revenue as risk buffer |

WLotus uses **40%** (upper-mid of the new-market band): enough cushion that a soft order book or temporary under-clearing does not immediately make remint unprofitable after real opex.

---

## WLotus standard (production)

| Knob | Value |
|------|-------|
| **Target market price** | **$1 / baton** (= **$0.01 / token**) |
| Reference ASIC | 100 TH/s, **20 J/TH**, **$0.08 / kWh** |
| Electricity share of price (when sizing D) | **25%** → **~$0.25** electricity / baton |
| Risk margin | **40%** (~$0.40 / baton) |
| Implied E[hashes] | **≈ 5.6×10¹⁷** (**~59 bits**) |
| Wall time @ 100 TH/s | **≈ 1.6 h / baton** (~15 batons/day) |

### Illustrative $1 baton cost stack (business, not oracle)

| Component | Share of $1 | ≈ USD |
|-----------|-------------|-------|
| Electricity | 25% | $0.25 |
| Hardware amortization | 15% | $0.15 |
| Facility / space / cooling | 10% | $0.10 |
| Labor / ops | 10% | $0.10 |
| **Risk margin (new market)** | **40%** | **$0.40** |
| **Market price** | **100%** | **$1.00** |

Difficulty is tuned so **reference electricity ≈ $0.25**; the **$1** is the **market** target that pays all-in opex + a new-market risk margin. If power is cheaper/dearer or J/TH improves, Moore δ and/or a sheet update retune work over time.

Recompute: `npm run pricing`.

---

## Mint-time matrix (expected)

Phone ~0.15 MH/s · PC ~0.85 MH/s · ASIC 100 TH/s.

| Product | Ticker | Bits | Market $/token | Market $/baton | ASIC elec. $ (ref) | Phone | PC | ASIC 100 TH/s |
|---------|--------|------|----------------|----------------|--------------------|-------|-----|---------------|
| **nWLotus** | `nWLOTUS` | **25** | ~$10⁻⁸ | ~$10⁻⁶ | ~$0 | **~3.7 min** | **~40 s** | **&lt;1 ms** |
| **mWLotus** | `mWLOTUS` | **30** | ~$10⁻⁵ | ~$10⁻³ | ~$0 | **~2 h** | **~21 min** | **&lt;1 ms** |
| **WLotus** | `WLOTUS` | **59** | **$0.01** | **$1** | **~$0.25** | — | — | **~1.6 h** |

**Peg:** `1_000_000 nWLotus ≈ 1_000 mWLotus ≈ 1 WLotus`.

| Regime | Tiers | How D is chosen |
|--------|-------|-----------------|
| **UX effort** | nWLotus, mWLotus | Phone/PC wall-clock. Soft market price; ASICs mint cheaply — launch/ritual. |
| **ASIC business** | WLotus | Market **$1/baton**; D from electricity **share** (~25%) of that price; **~40%** new-market risk margin. |

---

## Moore / Koomey

**δ = 99918/100000** (~2.3y half-life) raises required work after genesis so real all-in cost can track efficiency. It does not replace a correct WLotus genesis sheet.

## Live dogfood

Current mainnet mWLPOW test tokens use **toy** D. **Next launch = nWLotus @ 25 bits.**

## Parameters

- `src/params/pricing.ts` — market price, cost stack, electricity share, mint-time table  
- `npm run pricing`  
