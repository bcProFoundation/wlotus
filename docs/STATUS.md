# Status

Canonical home: **https://github.com/bcProFoundation/wlotus**  
Docs map: [README.md](./README.md).

Both desks run **`WlotusPowRemintMooreTipTemple`** — mint **108** = **102** miner + **6** temple. Confirm with `/api/status` if a checkout disagrees. Params: [SPEC.md](./SPEC.md). Why 102/6: [ECONOMICS.md](./ECONOMICS.md).

## Live tokens

| Env | Ticker | Site | `tokenId` | Since |
|-----|--------|------|-----------|-------|
| **Prod** | `WLOTUS` | https://wlotus.org | `154d229bab3cf228a2d40b507e1fc5f21a09542ec66776d3e797b455ab77a091` | 2026-08-13 · tag [`v26.8.0`](https://github.com/bcProFoundation/wlotus/releases/tag/v26.8.0) |
| **Test** | `dWLOTUS` | https://test.wlotus.org | `ffc15eb40711fbf069370a4f90ca44ce7913968a6d5940df9890343066f119ec` | 2026-08-14 |
| **GLOTUS** | `GLOTUS` | — | not minted | Design — [ECONOMICS.md](./ECONOMICS.md) |

ALP stores the test ticker uppercase (`DWLOTUS`); docs write `dWLOTUS`. On-chain name is **W Lotus** on both.

Git copies under `deployments/` can lag the VMs (tip JSON is not committed). If `mintSplit.temple` is `"107"`, that file is the retired genesis — ignore it.

| Env | VM JSON | Actions bake |
|-----|---------|--------------|
| Test | `deployments/mainnet-dryrun-wlotus.json` (+ `mainnet-dryrun-active.json`) | `VITE_PRAYER_TOKEN_ID` = live dryrun id |
| Prod | `deployments/mainnet-wlotus.json` | Environment `production` → same var |

```bash
TICKER=dWLOTUS BATONS=28 TEMPLE_ADDRESS=ecash:p… npm run create-wlotus-token
TEMPLE_ADDRESS=ecash:p… BATONS=28 npm run create-wlotus-token   # prod WLOTUS
BATON_INDEX=0 TIER=wlotus npm run mine-dryrun-once
```

Chronik: `https://chronik.e.cash` · `https://xec.paybutton.org` · `https://chronik.pay2stay.com/xec`

Local: `npm run mint-api` + `npm run web`. Hosting: [test](../deploy/contabo/README.md) · [prod](../deploy/contabo/PROD.md). The 1/107 → 102/6 recut is **done** ([runbook](../deploy/contabo/PROD_CUTOVER_102_6.md)).

Dogfood only: `WlotusPowRemintErgon`, legacy `WlotusPowRemintMoore`.

## Next

1. Altar separator packing + minter-only ≤10 amendments ([ALTAR.md](./ALTAR.md))
2. Postage / fee sponsorship polish
3. **GLOTUS** genesis when the economic layer ships
4. Fractional-bit PoW if/when eCash raises the 201-op limit
