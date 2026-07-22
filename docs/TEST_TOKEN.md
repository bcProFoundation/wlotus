# Test token — dWLOTUS

Use **`dWLOTUS`** for Contabo test / local dogfood. Same covenant as prod **WLOTUS**; only the ticker (and deployment JSON) differ.

| Field | Value |
|-------|-------|
| Ticker | `dWLOTUS` |
| Covenant | `WlotusPowRemintMooreTipTemple` |
| Mint / remint | **108** → **1** miner + **107** temple |
| Base bits | **0** |
| Moore | **+1 bit / 500 days** |
| Batons | **28** |

Record: [`deployments/mainnet-dryrun-wlotus.json`](../deployments/mainnet-dryrun-wlotus.json)

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
