# Economics — Prayer / Incense (ritual) · Candle / Flower (MoE)

## Roles

| Product | Economic? | Role |
|---------|-----------|------|
| **Incense** | **No** | Everyday thắp hương — fee / trivial PoW, **no MoE**, no peg |
| **Prayer** | **No** | Phone intention (~30 s) — effort chrome, not priced |
| **Candle** | **Yes** | Entry MoE — weak machines, quicker remint |
| **Flower (WLotus)** | **Yes** | Prestige MoE — **$1/baton** |

Phone users: pray / mint incense for free-ish ritual. **Buy** Candle/Flower (or mine if they have hardware) to offer value.

Fine denominations → future **mFlower**, not a 1/1000 Candle.

---

## Candle vs Flower: why **1/10**, not 1/100 or 1/1000

A real candle is not three orders of magnitude cheaper than a flower offering. **~1/10** token price keeps temple sense.

| Knob | Choice | Effect |
|------|--------|--------|
| Token peg | **10 Candle ≈ 1 Flower** | Candle = $0.001/token if Flower = $0.01 |
| Mint / baton | Candle **10**, Flower **100** | Candle baton = **$0.01** = Flower/100 |
| Work | Candle ≈ Flower/100 | ~**52 bits** vs Flower **59** |

Weak ~1 TH/s: Candle **~1.6 h**, Flower **~6.5 d**.  
ASIC 100 TH/s: Candle **~56 s**, Flower **~1.6 h**.

Fewer candles/baton → easier Candle mining (same 1/10 token peg). Raising mint to 100 would make Candle batons 10× dearer/harder.

---

## Fee floor (~5.46 XEC → eCash miners)

Prices spam for Incense/Prayer. Negligible vs Candle $0.01 / Flower $1.

---

## Flower business stack ($1)

25% electricity · 40% risk margin → **~59 bits**.

---

## Mint-time matrix

| Product | Bits | Mint | Market $/baton | Phone | Weak 1 TH/s | ASIC 100 TH/s |
|---------|------|------|----------------|-------|-------------|---------------|
| Incense | 8 | 100 | — (non-econ) | ~2 ms | &lt;1 ms | &lt;1 ms |
| Prayer | 22 | 1 | — (non-econ) | **~28 s** | &lt;1 ms | &lt;1 ms |
| Candle | **52** | **10** | **$0.01** | — | **~1.6 h** | **~56 s** |
| Flower | **59** | 100 | **$1** | — | ~6.5 d | **~1.6 h** |

`npm run pricing`
