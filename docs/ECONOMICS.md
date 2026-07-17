# Economics — Prayer → Incense → Candle → Flower (WLotus)

## Ritual loop

| Action | Meaning | Supply |
|--------|---------|--------|
| **Offer / burn** | Ritual offering (Lotus Temple: flower / incense / candle) | Destroys tokens |
| **Remint** | Pure PoW rebirth | Creates tokens |

**Offer** is the product verb (not “sacrifice”). Prestige is the **inverse** of Lotus Temple’s cheap→dear amount ladder: here **Flower is most prestige**, then Candle, Incense, then Prayer (quick / lowest cost).

**All tiers can run in parallel.** Launch starts with **Incense** (or **Prayer** for ~30 s offers).

---

## Offer ladder (rebrand)

| Product | Ticker | Was | Tokens / baton | Work vs Incense |
|---------|--------|-----|----------------|-----------------|
| **Prayer** | `PRAYER` | *(new)* | **1** | **÷ 10** |
| **Incense** | `INCENSE` | nWLotus | **1** | **1×** (baseline) |
| **Candle** | `CANDLE` | mWLotus | **10** | **× 100** |
| **Flower (WLotus)** | `WLOTUS` | WLotus | **100** | **× 10_000** (= Candle × 100) |

Token peg intent: **100 Incense ≈ 1 Candle token**; **100 Candle ≈ 1 Flower token**.  
PoW **cost is per baton** (mint size does not cheapen the remint) — work follows the time ladder above.

---

## Energy cost vs token (market) price

**$1 / Flower baton** is the **target market price**, not energy cost.

| Term | Meaning | Flower number |
|------|---------|---------------|
| **Energy cost** | Electricity only | share of market (illustrative **25%**) |
| **All-in operating cost** | Elec + HW + space + labor | ≈ **60%** of market |
| **Target market price** | Clearing / revenue target | **$1.00** / baton (= **$0.01** / token) |
| **Risk margin** | Market − all-in | **40%** (new / illiquid market) |

Ergon-style remint is a **for-profit business** (no NGU subsidy).

### Illustrative $1 Flower cost stack

| Component | Share | ≈ USD |
|-----------|-------|-------|
| Electricity | 25% | $0.25 |
| Hardware | 15% | $0.15 |
| Facility / space | 10% | $0.10 |
| Labor / ops | 10% | $0.10 |
| **Risk margin** | **40%** | **$0.40** |
| **Market** | **100%** | **$1.00** |

Genesis **difficulty** follows the **ritual work ladder** (Incense baseline → ×100 → ×100). The ASIC “$1 × 25% electricity → ~59 bits” sheet remains a **reference** for a harder future production retune; it is not the current Flower genesis bit.

Recompute: `npm run pricing`.

---

## Mint-time matrix (expected)

Phone ~0.15 MH/s · PC ~0.85 MH/s · ASIC 100 TH/s.

| Product | Ticker | Bits | Tokens/baton | Market $/token | Market $/baton | Phone | PC | ASIC 100 TH/s |
|---------|--------|------|--------------|----------------|----------------|-------|-----|---------------|
| **Prayer** | `PRAYER` | **22** | 1 | ~$10⁻⁷ | ~$10⁻⁷ | **~28 s** | **~5 s** | **&lt;1 ms** |
| **Incense** | `INCENSE` | **25** | 1 | ~$10⁻⁶ | ~$10⁻⁶ | **~3.7 min** | **~40 s** | **&lt;1 ms** |
| **Candle** | `CANDLE` | **32** | 10 | ~$10⁻⁴ | ~$10⁻³ | **~8 h** | **~1.4 h** | **&lt;1 ms** |
| **Flower** | `WLOTUS` | **38** | 100 | **$0.01** | **$1** | **~21 d** | **~3.7 d** | **~3 ms** |

**Work:** Prayer ≈ Incense/10 · Candle = Incense×100 · Flower = Candle×100.

---

## Moore / Koomey

**δ = 99918/100000** (~2.3y half-life) raises required **work** after genesis. Mint atoms stay fixed per tier.

## Live dogfood

Current mainnet mWLPOW test tokens use **toy** D and old tickers. **Next launch = Incense @ 25 bits** (optional Prayer @ 22).

## Parameters

- `src/params/pricing.ts` — ritual ladder, mint-time table, Flower business stack  
- `src/params/consensus.ts` — tickers, bits, mint atoms, peg  
- `npm run pricing`  
