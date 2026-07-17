# WLOTUS / mWLOTUS Consensus Parameters (v0.2 draft)

See also [ECONOMICS.md](./ECONOMICS.md).

## Identity — incubation genesis

| Param | Value | Notes |
|-------|-------|-------|
| Ticker | `mWLPOW` | milli White Lotus PoW (~1/1000 of future WLOTUS) |
| Name | `milli White Lotus PoW` | |
| Protocol | ALP standard (`SLP2`) | eCash |
| Decimals | `0` | Whole tokens; fixed mint size |

## PoW remint

| Param | Value | Notes |
|-------|-------|-------|
| Tokens / remint | **Always 100** | `BASE_MINT_ATOMS = 100` |
| `POW_LEADING_ZERO_BYTES` (genesis) | `1` | Cheap incubation (~$1e-5/token target) |
| Moore / Koomey | On **work**, not mint size | `δ = 99918/100000` |
| Host 1-mint/block CLTV | **disabled** | Frequency elasticity |
| Supply cap | **none** | PoW batons never die |

## Parallel batons

| Param | Value | Notes |
|-------|-------|-------|
| `POW_BATON_COUNT` (`N`) | `4` | Production may use 8–16 |

Each remint spends one PoW baton and recreates one (conserve `N`).

## Moore on difficulty (Ergon post-fix δ)

Source: [Ergon `validation.cpp` L978](https://github.com/Ergon-moe/Bitcoin-Static/blob/2e8d5f7635c899cc99e71f06dedbe72b3ff7f07b/src/validation.cpp#L978)

| Param | Value | Notes |
|-------|-------|-------|
| `MOORE_NUM` / `MOORE_DEN` | **`99918` / `100000`** | ~2.3y half-life |
| Obsolete | `99826/100000` | **Forbidden** |
| Day step | 144 blocks or 86400s | Host clock |
| Mint atoms | **Fixed** | Do not apply δ to M |

Library schedule (for miners / future stateful covenant):

```
requiredZeroBits(k) = POW_BASE_ZERO_BITS + floor(k / MOORE_DAYS_PER_EXTRA_BIT)
k = floor(elapsed_days since genesis)
```

Incubation mWLOTUS covenant enforces genesis **fixed** 1-byte PoW so anyone can mine immediately. Stateful or time-honest Moore-on-D ships with the WLOTUS difficulty retune (~1000×).

## Future WLOTUS

| Param | Value |
|-------|-------|
| Target price | ~$0.01/token (~$1/remint) |
| Mint | Still 100.00 |
| Difficulty | ~1000× mWLOTUS genesis work |
| Conversion | 1000 mWLOTUS ≈ 1 WLOTUS (live + burned) |

## Explicit non-goals (v0.2)

- `mintAmount ∝ work(D)` / token DAA  
- Fixed max supply  
- Mist 1-mint-per-block CLTV  
- USD price oracle on-chain  
- Temple app (separate repo; needs this PoW token first)
