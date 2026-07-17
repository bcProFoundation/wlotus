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

These are **not** the same:

| Term | Meaning |
|------|---------|
| **Energy cost** | Electricity (kWh) to find one PoW solution on a given machine |
| **All-in operating cost** | Electricity + hardware amortization + space/facility + labor/ops |
| **Target market price** | What the baton / token is meant to clear at in the market |

**Ergon-style mining is a normal business:** remint when expected **market proceeds ≥ all-in cost + margin**. There is no NGU speculative subsidy assumed — difficulty must leave room for profit after real opex, not set “electricity alone = sticker price.”

---

## WLotus standard (production)

| Knob | Value |
|------|-------|
| **Target market price** | **$1 / baton** (= **$0.01 / token**) |
| Reference ASIC | 100 TH/s, **20 J/TH**, **$0.08 / kWh** |
| Electricity share of price (when sizing D) | **35%** → **~$0.35** electricity / baton |
| Implied E[hashes] | **≈ 7.9×10¹⁷** (**~59 bits**) |
| Wall time @ 100 TH/s | **≈ 2.2 h / baton** (~11 batons/day) |

### Illustrative $1 baton cost stack (business, not oracle)

| Component | Share of $1 | ≈ USD |
|-----------|-------------|-------|
| Electricity | 35% | $0.35 |
| Hardware amortization | 25% | $0.25 |
| Facility / space / cooling | 15% | $0.15 |
| Labor / ops | 15% | $0.15 |
| Profit margin | 10% | $0.10 |
| **Market price** | **100%** | **$1.00** |

Difficulty is tuned so **reference electricity ≈ $0.35**; the **$1** is the **market** target that pays the rest + margin. If power is cheaper/dearer or J/TH improves, Moore δ and/or a sheet update retune work over time.

Recompute: `npm run pricing`.

---

## Mint-time matrix (expected)

Phone ~0.15 MH/s · PC ~0.85 MH/s · ASIC 100 TH/s.

| Product | Ticker | Bits | Market $/token | Market $/baton | ASIC elec. $ (ref) | Phone | PC | ASIC 100 TH/s |
|---------|--------|------|----------------|----------------|--------------------|-------|-----|---------------|
| **nWLotus** | `nWLOTUS` | **25** | ~$10⁻⁸ | ~$10⁻⁶ | ~$0 | **~3.7 min** | **~40 s** | **&lt;1 ms** |
| **mWLotus** | `mWLOTUS` | **30** | ~$10⁻⁵ | ~$10⁻³ | ~$0 | **~2 h** | **~21 min** | **&lt;1 ms** |
| **WLotus** | `WLOTUS` | **59** | **$0.01** | **$1** | **~$0.35** | — | — | **~2.2 h** |

**Peg:** `1_000_000 nWLotus ≈ 1_000 mWLotus ≈ 1 WLotus`.

| Regime | Tiers | How D is chosen |
|--------|-------|-----------------|
| **UX effort** | nWLotus, mWLotus | Phone/PC wall-clock. Soft market price; ASICs mint cheaply — launch/ritual. |
| **ASIC business** | WLotus | Market **$1/baton**; D from electricity **share** of that price on the ASIC sheet. |

---

## Moore / Koomey

**δ = 99918/100000** (~2.3y half-life) raises required work after genesis so real all-in cost can track efficiency. It does not replace a correct WLotus genesis sheet.

## Live dogfood

Current mainnet mWLPOW test tokens use **toy** D. **Next launch = nWLotus @ 25 bits.**

## Parameters

- `src/params/pricing.ts` — market price, cost stack, electricity share, mint-time table  
- `npm run pricing`  
