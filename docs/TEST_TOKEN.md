# Test / incubation deployments (mainnet)

## Mine and burn this: **mWLOTUS**

Incubation token ≈ **1/1000** of future `WLOTUS` energy/price.

| Field | Value |
|-------|-------|
| Ticker | `mWLOTUS` |
| Decimals | **2** |
| Tokens / remint | **Always 100.00** |
| PoW | 1 leading zero byte |
| Target | ~**$0.00001** / token |
| Conversion | 1000 mWLOTUS ≈ 1 WLOTUS (later) |

Record: [`deployments/mainnet-mwlotus.json`](../deployments/mainnet-mwlotus.json) (also `mainnet-pow-token.json`).

```bash
npm run create-pow-token   # genesis + baton handoff
npm run mine-once          # one PoW remint
```

Economics: [ECONOMICS.md](./ECONOMICS.md)

## Older dogfood (do not use for new mining)

| Token | Notes |
|-------|-------|
| WLPOW | Prior PoW plumbing tests (6 decimals / fixed D) |
| WLTEST | Custodial only |

## Chronik

```
https://chronik.e.cash
https://xec.paybutton.org
https://chronik.pay2stay.com/xec
```
