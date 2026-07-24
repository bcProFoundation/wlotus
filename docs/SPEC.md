# WLOTUS consensus parameters

Canonical economics: [ECONOMICS_WLOTUS_GLOTUS.md](./ECONOMICS_WLOTUS_GLOTUS.md).  
Clock: [CLOCK.md](./CLOCK.md).  
Altar / memorial on-chain policy: [ALTAR.md](./ALTAR.md).

## Identity

| Param | Value | Notes |
|-------|-------|-------|
| Ticker (prod) | `WLOTUS` | Live memorial / dana token |
| Ticker (test) | `dWLOTUS` | Same covenant; separate genesis |
| Companion | `GLOTUS` | Golden Lotus — separate token when shipped |
| Protocol | ALP standard (`SLP2`) | eCash |
| Decimals | `0` | Whole tokens |
| Covenant | `WlotusPowRemintMooreTipTemple` | MooreTip + temple split |

## PoW remint

| Param | Value | Notes |
|-------|-------|-------|
| Tokens / remint | **108** | One mala |
| Split | **1** miner + **107** temple P2SH | Covenant-enforced |
| PoW predicate | `hash256(preimage ‖ nonce)` | BIP143 preimage + nonce |
| `baseZeroBits` | **0** | Whole-byte only (`bits % 8 == 0`) |
| Moore | **+1 bit / 500 days** | Override `MOORE_DAYS_PER_EXTRA_BIT` 365–730 |
| Hard sunset | **bits ≤ 128** | Remints fail beyond |
| Supply cap | **none** | Batons never die; sunset ends remints |

### Work formula

```
bits           = baseZeroBits + floor(elapsed_days / MOORE_DAYS_PER_EXTRA_BIT)
P(success)     ≈ 1 / 2^bits   (whole-byte eras only change felt difficulty every +8)
tokens/remint  = 108
```

At **bits = 0**, the PoW prefix check is vacuous; tip race is network/API limited until Moore climbs. XEC fees dominate early on-chain cost.

## Parallel batons

| Param | Value | Notes |
|-------|-------|-------|
| `POW_BATON_COUNT` (`N`) | **28** | ALP genesis max. **Immutable after genesis.** |
| Desk launch | Serve **1** tip | `MINT_SERVING_TIP_COUNT=1`; raise toward 28 if demand warrants |

Each remint spends one PoW baton and recreates one (conserve `N`).

## Moore δ (Ergon post-fix)

Source: [Ergon `validation.cpp` L978](https://github.com/Ergon-moe/Bitcoin-Static/blob/2e8d5f7635c899cc99e71f06dedbe72b3ff7f07b/src/validation.cpp#L978)

| Param | Value | Notes |
|-------|-------|-------|
| `MOORE_NUM` / `MOORE_DEN` | **`99918` / `100000`** | ~2.3y half-life (reference constant) |
| Obsolete | `99826/100000` | **Forbidden** |
| Day step | wall-time via tip locktime | Not eCash height |
| Mint atoms | **Fixed 108** | Do not apply δ to mint size |

```
requiredZeroBits(k) = POW_BASE_ZERO_BITS + floor(k / MOORE_DAYS_PER_EXTRA_BIT)
k = floor(elapsed_days since genesis)
```

## GLOTUS (separate genesis)

| Param | Intent |
|-------|--------|
| Ticker | `GLOTUS` |
| Mint tax to temple | **None** |
| Premine | Disclosed % + vesting |
| PoW / Moore | Own schedule (may use higher base bits) |
| Role | Event burns / later commerce |

Details TBD at GLOTUS launch; see economics doc § Golden Lotus.

## Explicit non-goals

- `mintAmount ∝ work(D)` / token DAA
- Fixed max supply
- USD price oracle on-chain
- Temple mint tax on GLOTUS
- Multi-tier product ladder (retired)
