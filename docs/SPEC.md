# WLOTUS consensus parameters

Economics: [ECONOMICS.md](./ECONOMICS.md). Clock: [CLOCK.md](./CLOCK.md). Altar: [ALTAR.md](./ALTAR.md). Live desks: [STATUS.md](./STATUS.md).

## Identity

| Param | Value | Notes |
|-------|-------|-------|
| Ticker (prod) | `WLOTUS` | Live memorial / dana token |
| Ticker (test) | `dWLOTUS` | Same covenant; separate genesis |
| Companion | `GLOTUS` | Golden Lotus — separate token when shipped |
| Protocol | ALP standard (`SLP2`) | eCash |
| Decimals | `0` | Whole tokens |
| Covenant (live) | `WlotusPowRemintMooreTipTemple` | 102/6 + whole-byte PoW — **this tokenId** |
| Covenant (recut) | `GlotusPowRemintMooreTip` | 108 miner, felt +1 bit / 500 d — **new tokenId** |

## PoW remint

| Param | Value | Notes |
|-------|-------|-------|
| Tokens / remint | **108** | One mala |
| Split (live) | **102** miner + **6** temple P2SH | Covenant-enforced (desk burns **1**, keeps **101**) |
| Split (recut) | **108** miner + **0** temple | Desk burns **1**, keeps **107**. Temple P2SH is inventory only |
| PoW predicate | `hash256(preimage ‖ nonce)` | BIP143 preimage + nonce |
| `baseZeroBits` | **0** | Live: whole-byte only. Recut: felt `remBits = bits % 8` |
| Moore (live) | **+1 bit / 500 days**, felt every **8** bits | 256× / ~11 y |
| Moore (recut) | **+1 bit / 500 days**, felt every bit | 2× / ~1.4 y (ceremonial; not a currency) |
| Hard sunset | **bits ≤ 128** | Remints fail beyond |
| Supply cap | **none** | Batons never die; sunset ends remints |

### Work formula

```
bits           = baseZeroBits + floor(elapsed_days / MOORE_DAYS_PER_EXTRA_BIT)
P(success)     ≈ 1 / 2^bits
tokens/remint  = 108
```

Live `WlotusPowRemintMooreTipTemple` also requires `bits % 8 == 0`, so felt D only jumps every 8 formula ticks. The felt recut drops that guard.

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

Details TBD at GLOTUS launch; see [ECONOMICS.md](./ECONOMICS.md).

## Explicit non-goals

- `mintAmount ∝ work(D)` / token DAA
- Fixed max supply
- USD price oracle on-chain
- Temple mint tax on GLOTUS
- Multi-tier product ladder (retired)
