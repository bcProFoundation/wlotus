# Status

Canonical home: **https://github.com/bcProFoundation/wlotus**  
Docs map: [README.md](./README.md).

Live prod is **felt** `GlotusPowRemintMooreTip` (`a41bf9d0…`): mint **108**
to miner, no covenant temple tax. Confirm `/api/status`. The previous 102/6
token `f4e452ef…` cannot be upgraded in place.

## Live tokens

| Env | Ticker | Site | `tokenId` | Since |
|-----|--------|------|-----------|-------|
| **Prod** | `WLOTUS` | https://wlotus.org | `a41bf9d03961a2be83f854c8cea0b3fddf7e275ff3695d9848046052d6db3df9` | felt 108, no temple tax (confirm `/api/status`) |
| **Test (failed felt)** | `WLOTUS` | https://test.wlotus.org | `fcf7de592aceef5c0ee118fa8830daeb3d0efb445020e92b8a102e5127555ec4` | **Abandon** — mixed history; do not clone FROM/TO; do not point prod here |
| **Old test** | `dWLOTUS` | retired | `ffc15eb40711fbf069370a4f90ca44ce7913968a6d5940df9890343066f119ec` | **Abandon** |
| **Retired prod** | `WLOTUS` | retired | `154d229bab3cf228a2d40b507e1fc5f21a09542ec66776d3e797b455ab77a091` | **Abandon** |
| **GLOTUS** | `GLOTUS` | — | not minted | Design — [ECONOMICS.md](./ECONOMICS.md) |
| **dGLOTUS** | `DGLOTUS` | dogfood | `baaf918ba8c863941c4e5d0b826071e42a2f225baac5b33f729f8a3b8cdcbbdb` | 2026-08-30 · 28 batons · `GlotusPowRemintMooreTip` |

ALP stores the test ticker uppercase (`DWLOTUS`); docs write `dWLOTUS`. On-chain name is **W Lotus**.

Git `deployments/mainnet-wlotus.json` after #251 is the **failed** test token
`fcf7de59…` with `"role": "production"`. **Do not treat it as prod.** Live
prod is `a41bf9d0…` on wlotus.org (felt). Tip JSON on the VMs is the source of
truth. A deploy `git checkout --force` that overwrites that file makes mint-api
serve `fcf7de59…` while dana-index still watches `a41bf9d0…` — new burns never
show in Recent / Trending. Restore from `git show HEAD@{1}:deployments/mainnet-wlotus.json`
on the VM, then restart mint-api.

| Env | VM JSON | Actions bake |
|-----|---------|--------------|
| Test | `deployments/mainnet-wlotus.json` (same felt token; **keep mint-api stopped**) | `VITE_PRAYER_TOKEN_ID` = `a41bf9d0…` |
| Prod | `deployments/mainnet-wlotus.json` | Environment `production` → same var |

```bash
TICKER=dWLOTUS BATONS=28 TEMPLE_ADDRESS=ecash:p… npm run create-wlotus-token
TEMPLE_ADDRESS=ecash:p… BATONS=28 npm run create-wlotus-token   # prod WLOTUS (102/6)
# Felt recut: one genesis on the TEST VM, ticker WLOTUS (see PROD_CUTOVER_FELT_NOTAX.md)
BATONS=28 TEMPLE_ADDRESS=ecash:qz2cyuu3y5h0tanf8wy3esr64drpzzweeyu2c5dyen npm run create-wlotus-token
BATON_INDEX=0 TIER=wlotus npm run mine-dryrun-once
```

Chronik: `https://chronik.e.cash` · `https://xec.paybutton.org` · `https://chronik.pay2stay.com/xec`

Local: `npm run mint-api` + `npm run web`. Hosting: [test](../deploy/contabo/README.md) · [prod](../deploy/contabo/PROD.md). The 1/107 → 102/6 recut is **done** ([runbook](../deploy/contabo/PROD_CUTOVER_102_6.md)).

Dogfood only: `WlotusPowRemintErgon`, legacy `WlotusPowRemintMoore`, **dGLOTUS** (`GlotusPowRemintMooreTip`).

## Next

1. Altar separator packing + minter-only ≤10 amendments ([ALTAR.md](./ALTAR.md))
2. Postage / fee sponsorship polish
3. **GLOTUS** genesis when the economic layer ships
4. **WLOTUS felt no-tax recut** (one genesis): drop 6-atom temple tax; felt +1 bit / 500 days. Cannot mutate `f4e452ef…`. Genesis on the **test VM** with ticker `WLOTUS`, clone FROM live prod, dogfood, then retarget prod at the **same** `tokenId`. Runbook: [PROD_CUTOVER_FELT_NOTAX.md](../deploy/contabo/PROD_CUTOVER_FELT_NOTAX.md).
5. Intra-era 8-slot / daily mantissa still does not fit with hard next-P2SH. GLotus / felt WLotus use the 8×2B remBits table (ALP MINT only). Live WLOTUS stays whole-byte until that genesis.
