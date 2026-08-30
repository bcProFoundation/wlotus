# Economics

**Live** on prod (`WLOTUS`) and test (`dWLOTUS`) since 2026-08 — mint **108** = **102** miner + **6** temple; sponsored desk burns **1**, keeps **101**. Tag [`v26.8.0`](https://github.com/bcProFoundation/wlotus/releases/tag/v26.8.0).

The **6-atom temple tax + whole-byte PoW** was a bad trade: independents pay ~5.6% forever, and felt difficulty only jumps **256× every ~11 years**. That split and schedule are **baked into the live batons**. Code cannot change them. The next WLOTUS is a **new genesis**: 108 to the miner, felt +1 bit / 730 days (2× / ~2 years). Runbook: [PROD_CUTOVER_FELT_NOTAX.md](../deploy/contabo/PROD_CUTOVER_FELT_NOTAX.md).

Related: [STATUS.md](./STATUS.md) · [VISION.md](./VISION.md) · [SPEC.md](./SPEC.md) · [CLOCK.md](./CLOCK.md)

---

## Thesis

| Token | Ticker | Role | Monetary? | Mint posture |
|-------|--------|------|-----------|--------------|
| **W Lotus** | `WLOTUS` (test: `dWLOTUS`) | Memorial / dana proof | **No** (ceremonial) | Live: 6/108 tax. Recut: **no mint tax**; mobile may get **sponsored XEC fees** |
| **Golden Lotus** | `GLOTUS` | Scarce burnable value for special events & later commerce | **Yes** (real cost) | **Permissionless** remint; miner pays own XEC; **no platform mint tax** |

```text
Offer (mobile, temple-sponsored fees)
        │
        ▼
   Mint 108 W Lotus (one mala)
        ├── 102 → miner (desk key when sponsored)
        └──   6 → temple P2SH

   Desk then burns 1 for the flower offering → keeps 101 inventory

Independent miner pays own XEC → keeps all 102
Mine GLOTUS ← open; no temple mint tax
```

---

## W Lotus

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

With temple counted as desk, cost bases are nearly parity (~0.39 vs ~0.425). The open-mining posture no longer gives independents a large structural discount.

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

Permissionless remint, miner pays XEC only, **no** temple mint tax. Premine + event burns fund the platform. Own difficulty schedule (may use a higher whole-byte base). Details TBD at launch.

---

## Implementation

- Covenant: `WlotusPowRemintMooreTipTemple` — [SPEC.md](./SPEC.md)
- Constants: `WLOTUS_MINER_ATOMS=102`, `WLOTUS_TEMPLE_ATOMS=6`, `WLOTUS_DESK_KEEP_AFTER_BURN=101`
- Fuel: `REMINT_FUEL_SATS = 4000` (40 XEC); burn tx ~5.46 XEC
- **Immutability:** changing the split or the felt schedule requires a **new genesis**

## Felt no-tax recut (next genesis)

Same ticker `WLOTUS` / `dWLOTUS`, **new `tokenId`**. Redeem is `GlotusPowRemintMooreTip` (already dogfooded as dGLOTUS):

| | Live (`154d229b…`) | Recut |
|--|--|--|
| Mint | 102 miner + 6 temple | **108 miner** |
| Felt D | 256× / ~11 y (`bits % 8 == 0`) | **2× / ~2 y** (+1 bit / 730 d) |
| Remint EMPP | ALP MINT + DANA tip v4 | ALP MINT only |
| Offerings | Separate DANA v1/v2 burn | Unchanged |
| Desk after burn-1 | 101 | **107** |
| Temple P2SH | Covenant tax + inventory | Inventory / premine only |

Felt + remint DANA tip is **213 ops** — over the 201-op cap even after dropping the temple output. Offerings do not need the remint tip ad (dana-index skips DANA v4).

`FELT=1 TEMPLE_ADDRESS=ecash:p… npm run create-wlotus-token`
