# Economics — wLotus + Golden Lotus

**Status:** design update (2026-08-04) — mint **108** = **102** miner + **6** temple; sponsored desk burns **1**, keeps **101**.  
Related: [VISION.md](./VISION.md) · [ECONOMICS.md](./ECONOMICS.md) · [CLOCK.md](./CLOCK.md)

---

## Thesis

| Token | Ticker | Role | Monetary? | Mint posture |
|-------|--------|------|-----------|--------------|
| **wLotus** | `WLOTUS` (test: `dWLOTUS`) | Memorial / dana proof | **No** (ceremonial) | Light temple tax; mobile may get **sponsored XEC fees** |
| **Golden Lotus** | `GLOTUS` | Scarce burnable value for special events & later commerce | **Yes** (real cost) | **Permissionless** remint; miner pays own XEC; **no platform mint tax** |

```
Offer (mobile, temple-sponsored fees)
        │
        ▼
   Mint 108 wLotus (one mala)
        ├── 102 → miner (desk key when sponsored)
        └──   6 → temple P2SH

   Desk then burns 1 for the flower offering → keeps 101 inventory

Independent miner pays own XEC → keeps all 102
Mine GLOTUS ← open; no temple mint tax
```

---

## wLotus

### Issuance split (covenant-enforced)

Each successful remint mints **108** atoms — **one mala**:

| Share | Destination | Purpose |
|------:|-------------|---------|
| **102** | Miner P2PKH | Open mining reward |
| **6** | Temple P2SH | Issuer tax / treasury |

**Sponsored path (wlotus.org as fee sponsor):** the desk holds the miner key, so it receives **102**. It burns **1** for the user's memorial flower and retains **101** as inventory.

**Independent path:** miner pays own XEC, keeps **102**, temple still receives **6**.

### Why 102 / 6 (not 1 / 107)

Launch **baseZeroBits = 0** already equalizes mobile and professional PoW wall-clock relative to a hard ASIC target. The old **1/107** split made independent mining uneconomic by design. The new split:

- Opens economics to third-party clients and miners (**~94.4%** of each mala to the miner)
- Keeps a small fixed temple tax (**~5.6%**)
- Preserves mala symbolism (108 total)
- Lets the desk still fund inventory when it sponsors fees (101 after burn)

### Miner profitability (operational fees)

Operational remint fuel is **40 XEC** (`REMINT_FUEL_SATS = 4000`). Memorial burn is a second transaction of similar size, so the desk all-in for a sponsored flower is ~80 XEC.

| Actor | XEC out | WLOTUS kept | Implied cost / lotus |
|-------|--------:|------------:|---------------------:|
| **Independent miner** (pays remint; keeps 102) | ≥ **40** | **102** | **≥ ~0.39 XEC** |
| **Desk sponsor** (remint + burn 1) | ~**80** | **101** inventory | **~0.79 XEC** |
| **Temple** (no XEC; covenant output) | 0 | **6** | — |

**Implication:** independent fee-paying miners still have a **better cost basis** than the desk (~2× cheaper per lotus). That is intentional under an open-mining posture, but it means:

1. Professional / GPU hashrate can farm inventory relatively cheaply while PoW stays soft.
2. Desk inventory is **not** structurally cheaper than independent supply (opposite of the old 1/107 model).
3. Desk advantage is **UX** (sponsored fees, soft pray, mobile Offer), not XEC cost dominance.
4. Secondary-market dumps from independent miners remain a real risk if demand lags issuance.

**Rate limits that still matter:** baton tip count, tip races, soft pray (official client only), Moore ramp over years, 128-bit sunset.

### Soft timer (attention)

- Official Offer: device PoW → **remint immediately** → soft pray floor → **memorial burn of 1**.
- Cancel during soft wait **skips the burn**; the miner atoms stay with the desk.
- Soft timer must **not** delay remint (tip race).

### Mobile fee policy (off-chain)

| Who | XEC remint fee |
|-----|----------------|
| Official mobile / mint-api | Temple may **sponsor** (rate-limited) |
| Anyone else | Pays own XEC; mint **102→self, 6→temple** |

---

## Golden Lotus (`GLOTUS`)

Unchanged intent: permissionless remint, miner pays XEC only, **no** temple mint tax. Premine + event burns fund the platform.

---

## Implementation notes

- Covenant: `WlotusPowRemintMooreTipTemple` — mint **108**; **102** miner P2PKH + **6** temple P2SH.
- **Memorial:** burn **1** after sponsored remint (`DANA` LOKAD).
- Constants: `WLOTUS_MINER_ATOMS=102`, `WLOTUS_TEMPLE_ATOMS=6`, `WLOTUS_DESK_KEEP_AFTER_BURN=101`.
- Fuel: `REMINT_FUEL_SATS = 4000` (40 XEC).
- **Immutability:** changing the split requires a **new genesis**.

Settled intent: open miner majority + light temple tax + desk as fee sponsor for mobile offerings.
