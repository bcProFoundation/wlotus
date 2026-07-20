# Economics — Incense/Prayer (ritual) · Candle (GPU) · Flower (ASIC)

> **Launch decision (2026-07):** primary product economics are **WLotus (temple, 100 mint → 1+99) + Golden Lotus (open)**.  
> See **[ECONOMICS_WLOTUS_GLOTUS.md](./ECONOMICS_WLOTUS_GLOTUS.md)**. The ladder below remains background / longer-term hardware tiers.

## Roles

| Product | Economic? | Hardware | Role |
|---------|-----------|----------|------|
| **WLotus** (launch) | No (ceremonial) | Phone + temple fees | Prayer / memorial — [dual-token doc](./ECONOMICS_WLOTUS_GLOTUS.md) |
| **Golden Lotus** (launch) | Yes | Open PoW | Event burns / later commerce — same doc |
| **Incense** | No | Fee / trivial | Everyday thắp hương |
| **Prayer** | No | Phone ~30 s | Intention (dryrun lineage) |
| **Candle** | Soft yes | **GPU** | Entry MoE — 1/baton |
| **Flower** | Yes | **ASIC** | Prestige MoE — **$1/baton** |

## Candle = 1 / baton (GPU)

Token soft peg still **~1/10 Flower** ($0.001 if Flower = $0.01).  
**Difficulty is GPU wall-clock**, not full $/hash parity with Flower:

| Approach | Bits | GPU 1 GH/s | ASIC 100 TH/s |
|----------|------|------------|---------------|
| Anti-arb ($0.001 baton) | ~49 | ~6.5 **days** | ~5.6 s |
| **GPU target (chosen)** | **~43** | **~2.4 h** | **~ms** |

ASICs will mint Candle quickly — acceptable because **Candle is not ASIC-targeted**. Flower stays the ASIC business sheet (~59 bits, ~1.6 h @ 100 TH/s). Fine grain → **mFlower**.

## Mint-time matrix

| Product | Bits | Mint | Market $/baton | Phone | GPU 1 GH/s | ASIC 100 TH/s |
|---------|------|------|----------------|-------|------------|---------------|
| Incense | 8 | 100 | — | ~2 ms | &lt;1 ms | &lt;1 ms |
| Prayer | 22 | 1 | — | **~28 s** | ~4 ms | &lt;1 ms |
| Candle | **43** | **1** | ~$0.001 | — | **~2.4 h** | ~90 ms |
| Flower | **59** | 100 | **$1** | — | — | **~1.6 h** |

Fee ~5.46 XEC → eCash miners. `npm run pricing`

## Prayer-only bootstrap (phone → server)

Starting path: phone mines a few minutes → server pays fee → mint **2** → **1 burn + 1 inventory**.

Fee at **$10 / 1M XEC** ≈ **$0.000055**; at **$50 / 1M** ≈ **$0.000273**.  
Phone **energy ≪ fee** — do not peg bits to energy; use **~24 bits (~2 min)** UX. Inventory cost basis ≈ **5.46 XEC**.

Full evaluation: [ECONOMICS_PRAYER.md](./ECONOMICS_PRAYER.md).
