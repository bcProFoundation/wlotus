# Test token deployment (mainnet)

## Goals

| Knob | Test now | Later |
|------|----------|-------|
| Target price | **~$0.000001 / token** | **~$0.01 / token** |
| PoW leading zero bytes | `1` | raise (2–3+) |
| Ticker | `WLTEST` | `WLOTUS` |
| Batons | `4` custodial | PoW covenant + possibly more batons |

## Chronik

```
https://chronik.e.cash
https://xec.paybutton.org
https://chronik.pay2stay.com/xec
```

## Create

```bash
npm run new-wallet            # .env + deployments/pending-funding.json
# fund genesis address with ≥ 200 XEC
npm run create-test-token     # → deployments/mainnet-test-token.json
```

Genesis mints **1,000,000** `WLTEST` (6 decimals) plus **4** mint batons to the
genesis wallet for custodial remint dogfooding until the PoW covenant is audited.
