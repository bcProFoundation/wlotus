# Test token — dWLOTUS / DWLOTUS

Use Contabo **test** / local dogfood. Same covenant as prod **WLOTUS**; only the ticker (and deployment JSON) differ. ALP stores the ticker uppercase (`DWLOTUS`); docs often write `dWLOTUS`.

| Field | Value |
|-------|-------|
| Ticker (ALP) | `DWLOTUS` |
| Token id | `7ab478bcfddf6eb5130d33395846012c20b92ac48f19025ef8d53ba3d7d5e359` |
| Covenant | `WlotusPowRemintMooreTipTemple` |
| Mint / remint | **108** → **1** miner + **107** temple |
| Base bits | **0** |
| Moore | **+1 bit / 500 days** |
| Batons | **28** |
| Explorer | https://explorer.e.cash/tx/7ab478bcfddf6eb5130d33395846012c20b92ac48f19025ef8d53ba3d7d5e359 |

Record: [`deployments/mainnet-dryrun-wlotus.json`](../deployments/mainnet-dryrun-wlotus.json) (also `mainnet-dryrun-active.json`).

GitHub Actions (test): set variable **`VITE_PRAYER_TOKEN_ID`** to this token id so the SPA bake matches the desk.

```bash
TICKER=dWLOTUS TEMPLE_ADDRESS=ecash:p… BATONS=28 npm run create-wlotus-token
# or: npm run create-dryrun-wlotus

BATON_INDEX=0 TIER=wlotus npm run mine-dryrun-once
```

Prod genesis (do not use on the test desk):

```bash
TEMPLE_ADDRESS=ecash:p… BATONS=28 npm run create-wlotus-token
# or: npm run create-prod-token
```

Economics: [ECONOMICS_WLOTUS_GLOTUS.md](./ECONOMICS_WLOTUS_GLOTUS.md) · Clock: [CLOCK.md](./CLOCK.md)

## Chronik

```
https://chronik.e.cash
https://xec.paybutton.org
https://chronik.pay2stay.com/xec
```
