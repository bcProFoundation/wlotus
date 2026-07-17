# Economics — Prayer → Incense → Candle → Flower (WLotus)

## Ritual loop

| Action | Meaning | Supply |
|--------|---------|--------|
| **Offer / burn** | Ritual offering | Destroys tokens |
| **Remint** | Pure PoW rebirth | Creates tokens |

**Offer** is the product verb. Prestige: **Flower > Candle > Incense > Prayer**.

---

## Why Flower work = Incense × 10 000

If Flower is hard ($1 → ~59 bits) but Incense stays phone-easy (~25 bits), **nothing stops ASICs from mining Incense/Candle** whenever those tokens clear anywhere near the peg — Flower is ignored.

So work must track value:

| Baton | Work vs Incense | Soft market vs Flower $1 |
|-------|-----------------|--------------------------|
| Prayer | ÷ 10 | $1 / 100 000 |
| Incense | 1× | $1 / 10 000 |
| Candle | × 100 | $1 / 100 |
| **Flower** | **× 10 000** | **$1** |

**Anchor:** Flower **$1/baton** on the ASIC sheet (25% electricity → ~59 bits). Lower tiers are **derived downward**. Phone-minute Incense is **incompatible** with both $1 Flower and anti-arbitrage.

Mint atoms: Prayer **1** · Incense **1** · Candle **10** · Flower **100**.  
Peg: **100 Incense ≈ 1 Candle**; **100 Candle ≈ 1 Flower**.

---

## Energy cost vs market price (Flower)

| Term | Flower |
|------|--------|
| Target market price | **$1 / baton** ($0.01 / token) |
| Ref. electricity (25%) | **~$0.25** |
| Risk margin | **40%** |
| Genesis bits | **~59** (~1.6 h @ 100 TH/s) |

### $1 cost stack

| Component | Share | ≈ USD |
|-----------|-------|-------|
| Electricity | 25% | $0.25 |
| Hardware | 15% | $0.15 |
| Facility | 10% | $0.10 |
| Labor | 10% | $0.10 |
| Risk margin | 40% | $0.40 |

Recompute: `npm run pricing`.

---

## Mint-time matrix (expected)

| Product | Ticker | Bits | Tokens/baton | Market $/baton | ASIC elec. $ | Phone | PC | ASIC 100 TH/s |
|---------|--------|------|--------------|----------------|--------------|-------|-----|---------------|
| **Prayer** | `PRAYER` | **42** | 1 | ~$10⁻⁵ | ~$2.5×10⁻⁶ | ~1.2 y | — | **~56 ms** |
| **Incense** | `INCENSE` | **46** | 1 | ~$10⁻⁴ | ~$2.5×10⁻⁵ | ~12 y | — | **~0.6 s** |
| **Candle** | `CANDLE` | **52** | 10 | ~$10⁻² | ~$2.5×10⁻³ | — | — | **~56 s** |
| **Flower** | `WLOTUS` | **59** | 100 | **$1** | **~$0.25** | — | — | **~1.6 h** |

## Live dogfood

Toy-D mWLPOW tokens are unrelated to this sheet. Production genesis follows the table above.

## Parameters

- `src/params/pricing.ts` · `src/params/consensus.ts` · `npm run pricing`
