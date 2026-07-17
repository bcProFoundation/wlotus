# Test token deployment (mainnet)

## Live token

| Field | Value |
|-------|-------|
| Ticker | `WLTEST` |
| Name | White Lotus Test |
| Token ID | `e64406bdda45fb46a642d9b6b2a949d9a12910046e3266e68158d7481e8b08a3` |
| Decimals | 6 |
| Initial mint | 1,000,000 WLTEST |
| Mint batons | 4 (custodial on genesis wallet) |
| PoW leading zero bytes | 1 (~$0.000001/token target) |
| Genesis address | `ecash:qrkf3e43xhu4cl8syfqja4k0g4kchzzt0yf4w00sm7` |

- Explorer: https://explorer.e.cash/tx/e64406bdda45fb46a642d9b6b2a949d9a12910046e3266e68158d7481e8b08a3
- Cashtab: https://cashtab.com/#/token/e64406bdda45fb46a642d9b6b2a949d9a12910046e3266e68158d7481e8b08a3
- Record: [`deployments/mainnet-test-token.json`](../deployments/mainnet-test-token.json)

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

## Recreate (new token)

```bash
npm run new-wallet -- --force
# fund genesis address with ≥ 200 XEC
npm run create-test-token
```
