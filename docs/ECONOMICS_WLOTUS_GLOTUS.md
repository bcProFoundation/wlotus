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

- Remint fuel: **40 XEC** (`REMINT_FUEL_SATS = 4000`)
- Memorial burn: **~5.46 XEC** (small pure-XEC burn tx, not another sized remint fuel)
- Desk + temple are the **same entity** today → the **6** temple atoms are also a desk advantage

| Actor | XEC out | WLOTUS kept (effective) | Implied cost / lotus |
|-------|--------:|------------------------:|---------------------:|
| **Independent miner** | ≥ **40** | **102** | **≥ ~0.39 XEC** |
| **Desk + temple** (remint 40 + burn ~5.46) | **~45.5** | **101 inventory + 6 temple = 107** | **~0.425 XEC** |

**Implication:** with temple counted as desk, cost bases are nearly parity (~0.39 vs ~0.425). The open-mining posture no longer gives independents a large structural discount; the 6 temple atoms close most of the gap.

Still true:

1. Soft PoW (`baseZeroBits=0`) lets GPU/ASIC farm inventory while difficulty is low.
2. Desk advantage is primarily **UX** (sponsored fees, soft pray, mobile Offer) plus the small temple share, not a large XEC cost moat.
3. Secondary-market dumps from independent miners remain a risk if demand lags issuance.
4. Soft pray is official-client only — permissionless miners skip the attention tax.

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
- Fuel: `REMINT_FUEL_SATS = 4000` (40 XEC); burn tx ~5.46 XEC.
- **Immutability:** changing the split requires a **new genesis**.

Settled intent: open miner majority + light temple tax + desk as fee sponsor for mobile offerings.
