# WLOTUS Consensus Parameters (v0.1 draft)

These constants define the **intended** genesis / covenant policy.
They are not live on mainnet until GENESIS + baton handoff are executed.

## Identity

| Param | Value | Notes |
|-------|-------|-------|
| Ticker | `WLOTUS` | White Lotus |
| Name | `White Lotus` | |
| Protocol | ALP standard (`SLP2`) | eCash |
| Decimals | `6` | Precision for Moore integer decay |

## PoW remint

| Param | Value | Notes |
|-------|-------|-------|
| `POW_LEADING_ZERO_BYTES` | `1` | Test — ~$1e-6/token; raise for ~$0.01 later |
| `BASE_MINT_ATOMS` (`M₀`) | `100_000_000` | = 100 WLOTUS @ 6 decimals per remint at genesis (keep large for Moore floor-div) |
| Host 1-mint/block CLTV | **disabled** | Required for frequency elasticity |
| Supply cap | **none** | PoW batons never die |

## Parallel batons

| Param | Value | Notes |
|-------|-------|-------|
| `POW_BATON_COUNT` (`N`) | `4` | Test genesis; production may use 8–16 |
| Temple bootstrap baton | optional | Separate; retire after liquidity |

Each remint spends exactly one PoW baton and recreates exactly one PoW baton (conserve `N`).

## Moore / Koomey decay (Ergon post-fix)

Source: [Ergon-moe/Bitcoin-Static `validation.cpp` L978](https://github.com/Ergon-moe/Bitcoin-Static/blob/2e8d5f7635c899cc99e71f06dedbe72b3ff7f07b/src/validation.cpp#L978)

| Param | Value | Notes |
|-------|-------|-------|
| `MOORE_NUM` | **`99918`** | Use this — ~2.3y half-life |
| `MOORE_DEN` | **`100000`** | |
| Obsolete factor | `99826/100000` | Pre-fix ~1.1y — **forbidden** |
| Day step | `144` eCash blocks | Same idea as Ergon `nSubsidyHalvingInterval` @ 10 min |
| Clock | Host chain height / median time | **Not** token-mint height |

```
M(k) = floor_div_iter(M₀, k)
where each step: x ← (x * 99918) / 100000
k = floor( (hostHeight - genesisHeight) / 144 )
```

## Explicit non-goals (v0.1)

- `mintAmount ∝ work(D)` / token DAA  
- Fixed max supply  
- Mist 1-mint-per-block CLTV  
- Website / temple app (separate repo)
