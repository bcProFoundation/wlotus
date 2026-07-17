# Economics — nWLotus → mWLotus → WLotus

## Ritual loop

| Action | Meaning | Supply |
|--------|---------|--------|
| **Burn** | Sacrifice / vàng mã offering | Destroys tokens |
| **Remint** | Pure PoW rebirth | Creates tokens |

Mint is always **100 tokens / baton (remint)** @ **0** decimals. Moore δ adjusts **work**, not mint size.  
**All three tiers can run in parallel** (separate ALP tokens / baton sets).

---

## Standard: WLotus = **$0.01 / token** = **$1 / baton**

ASIC reference sheet: **100 TH/s**, **20 J/TH**, **$0.08 / kWh**.

| | |
|--|--|
| Electricity for $1 / baton | **E[hashes] ≈ 2.25×10¹⁸** |
| ≈ leading zero bits | **~61** |
| Time on **100 TH/s** | **≈ 6.3 hours / baton** |
| Remints / day @ 100 TH/s | **≈ 3.8** |

Launch order: start with **nWLotus**, then **mWLotus**, then **WLotus**. Recompute: `npm run pricing`.

---

## Mint-time matrix (expected)

Hashrate assumptions: phone **~0.15 MH/s** (JS), PC **~0.85 MH/s** (JS, this-VM class), ASIC **100 TH/s**.

| Product | Ticker | Bits | $/token | $/baton | Phone | PC | ASIC (100 TH/s) |
|---------|--------|------|---------|---------|-------|-----|-----------------|
| **nWLotus** | `nWLOTUS` | **25** | ~$10⁻⁸ | ~$10⁻⁶ | **~3.7 min** | **~40 s** | **&lt;1 ms** |
| **mWLotus** | `mWLOTUS` | **30** | ~$10⁻⁵ | ~$10⁻³ | **~2 h** | **~21 min** | **&lt;1 ms** |
| **WLotus** | `WLOTUS` | **61** | **$0.01** | **$1** | — | — | **~6.3 h** |

**Peg (nominal):** `1_000_000 nWLotus ≈ 1_000 mWLotus ≈ 1 WLotus`.

| Regime | Tiers | Meaning |
|--------|-------|---------|
| **UX effort** | nWLotus, mWLotus | Difficulty = desired phone/PC wall-clock. ASICs mint these almost free — accepted for launch/ritual. |
| **ASIC energy** | WLotus | Difficulty = ~$1 electricity per baton on the reference sheet. |

---

## Why not “1000× dogfood ⇒ $0.01”?

A 100 TH/s ASIC is ~**10⁵× cheaper per hash** than a laptop. Toy or “1000× toy” difficulties are **instant and ~$0** on ASICs. Only **~61-bit** work matches a **$1/baton** energy floor under the sheet above.

---

## Moore / Koomey

Ergon **δ = 99918/100000** (~2.3y half-life) raises required work after each tier’s genesis. It does **not** replace setting WLotus genesis from the ASIC formula.

---

## Live dogfood

Current mainnet mWLPOW Moore/Ergon test tokens still use **toy** difficulty for covenant plumbing. **Next launch genesis = nWLotus @ 25 bits.**

## Parameters

- `src/params/pricing.ts` — sheet + ladder + mint-time table  
- `src/params/consensus.ts` — bit defaults  
- `npm run pricing` — print matrix  
