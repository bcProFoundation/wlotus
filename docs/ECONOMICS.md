# Economics — Prayer → Incense → Candle → Flower (fee floor)

## Product intent

| Who | Does |
|-----|------|
| **Phone users** | Mine **Prayer** only (~30 s) — ritual gesture |
| **Everyone offering** | **Buys** Incense / Candle / Flower on the market |

## Mint + peg

| Product | Ticker | Tokens / baton | Token peg |
|---------|--------|----------------|-----------|
| Prayer | `PRAYER` | **1** | 1000 Prayer ≈ 1 Incense |
| Incense | `INCENSE` | **100** | 1000 Incense ≈ 1 Candle |
| Candle | `CANDLE` | **100** | 1000 Candle ≈ 1 Flower |
| Flower | `WLOTUS` | **100** | **$1 / baton** ($0.01 / token) |

Soft baton markets from peg: Incense ~$10⁻⁶ · Candle ~$10⁻³ · Flower **$1**.

---

## XEC fee floor (~5.46 XEC / remint)

At ~$8×10⁻⁶ / XEC, fee ≈ **$4.4×10⁻⁵** per remint.

| Tier | Soft baton market | Fee / market | What prices the remint |
|------|-------------------|--------------|------------------------|
| Prayer | ~$10⁻¹¹ | ≫ 1 (millions×) | **Fee** (PoW negligible) |
| Incense | ~$10⁻⁶ | ~**44×** | **Fee** (100 mint amortizes → ~fee/100 per token) |
| Candle | ~$10⁻³ | ~4% | **PoW** (+ small fee) |
| Flower | **$1** | ~0.004% | **PoW / business stack** |

### Fee vs Prayer / Incense proportion

With mint **1** vs **100**, fee-floor unit costs are:

- Prayer token ≈ **fee** ≈ $4.4×10⁻⁵  
- Incense token ≈ **fee / 100** ≈ $4.4×10⁻⁷  
- → **~100 Prayer ≈ 1 Incense** at the fee floor (not 1000)

The **1000∶1 peg** is the brand/conversion peg. Mining Prayer is an intentionally **worse** deal than buying Incense — phones pray; markets supply offer tokens. ASICs do not undercut Flower by printing Prayer/Incense near the soft peg: fee keeps those floors far above soft peg until demand lifts price.

---

## Flower business ($1 / baton)

Still Ergon-style for-profit (25% elec · 40% risk margin) → **~59 bits** · ~1.6 h @ 100 TH/s. Fee is noise.

Candle PoW tracks baton value (~$0.001 → **~49 bits**).

---

## Mint-time matrix

| Product | Bits | Mint | Market $/baton | Fee $ | Elec $ | All-in $ | Phone | ASIC 100 TH/s |
|---------|------|------|----------------|-------|--------|----------|-------|---------------|
| **Prayer** | **22** | 1 | ~$10⁻¹¹ | ~$4.4e-5 | ~0 | ~**fee** | **~28 s** | &lt;1 ms |
| **Incense** | **25** | 100 | ~$10⁻⁶ | ~$4.4e-5 | ~0 | ~**fee** | **~3.7 min** | &lt;1 ms |
| **Candle** | **49** | 100 | ~$10⁻³ | ~$4.4e-5 | ~$2.5e-4 | ~$3e-4 | — | **~5.6 s** |
| **Flower** | **59** | 100 | **$1** | ~$4.4e-5 | **~$0.25** | ~$0.25 | — | **~1.6 h** |

Recompute: `npm run pricing`.

## Parameters

`src/params/pricing.ts` · `src/params/consensus.ts`
