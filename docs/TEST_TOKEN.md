# Test / incubation deployments (mainnet)

## Mine and burn this: **mWLPOW**

Incubation token ≈ **1/1000** of future `WLOTUS` energy/price.

| Field | Value |
|-------|-------|
| Ticker | `mWLPOW` |
| Decimals | **0** |
| Tokens / remint | **Always 100** |
| PoW | 1 leading zero byte |
| Target | ~**$0.00001** / token |
| Conversion | 1000 mWLPOW ≈ 1 WLOTUS (later) |

Record: [`deployments/mainnet-mwlpow.json`](../deployments/mainnet-mwlpow.json) (also `mainnet-pow-token.json`).

```bash
npm run create-pow-token
npm run mine-once
```

Economics: [ECONOMICS.md](./ECONOMICS.md)

## Older dogfood (do not use for new mining)

| Token | Notes |
|-------|-------|
| mWLOTUS | Accidental 2-dec deploy while waiting on funding |
| WLPOW / WLTEST | Earlier plumbing / custodial tests |

## Chronik

```
https://chronik.e.cash
https://xec.paybutton.org
https://chronik.pay2stay.com/xec
```
