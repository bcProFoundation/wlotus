# WLOTUS / mWLPOW Consensus Parameters (v0.3 draft)

See also **[ECONOMICS.md](./ECONOMICS.md)** for hash work, energy, and price detail.

## Identity — incubation genesis (live)

| Param | Value | Notes |
|-------|-------|-------|
| Ticker | `mWLPOW` | milli White Lotus PoW (~1/1000 of future WLOTUS) |
| Name | `milli White Lotus PoW` | |
| Token ID | `cc2ee91c0ed43da44fc115283ec4b5e523da9f1549f27eacc06b0a3e7dc1494f` | Mainnet |
| Protocol | ALP standard (`SLP2`) | eCash |
| Decimals | `0` | Whole tokens; fixed mint size |

## PoW remint

| Param | Value | Notes |
|-------|-------|-------|
| Tokens / remint | **Always 100** | `BASE_MINT_ATOMS = 100` |
| PoW predicate | `hash256(preimage ‖ nonce)` | BIP143 preimage + 4-byte nonce |
| `POW_LEADING_ZERO_BYTES` (`D`) | **`1`** | First byte of hash must be `0x00` |
| **Expected hashes / remint** | **\(256^{D} = 256\)** | Geometric; mean attempts ≈ 256 |
| Expected hashes / token | **≈ 2.56** | 256 / 100 |
| Target market price | **~$0.00001 / token** | All-in (not pure joules) — see ECONOMICS |
| Target / remint | **~$0.001** | 100 × per-token target |
| Moore / Koomey | On **work**, not mint size | `δ = 99918/100000` |
| Host 1-mint/block CLTV | **disabled** | Frequency elasticity |
| Supply cap | **none** | PoW batons never die |

### Work formula

```
P(success)     = 1 / 256^D
E[hashes]      = 256^D          # D = leading zero bytes
tokens/remint  = 100            # fixed
E[hashes]/tok  = 256^D / 100
```

| `D` (bytes) | E[hashes] / remint | vs D=1 |
|-------------|--------------------|--------|
| 1 (live) | 256 | 1× |
| 2 | 65_536 | 256× |
| ~2 + bit tweaks | ~2.56×10⁵ | **~1000×** (WLOTUS aim) |
| 3 | 16_777_216 | 65_536× |

At **D = 1**, PoW joules are negligible; **XEC fees** dominate on-chain cost. The **~$0.00001/token** figure is the intended **market** price once burns create demand — not a claim that 256 hashes cost that much electricity today.

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
| Mint atoms | **Fixed 100** | Do not apply δ to mint |

Library schedule (miners / future stateful covenant):

```
requiredZeroBits(k) = POW_BASE_ZERO_BITS + floor(k / MOORE_DAYS_PER_EXTRA_BIT)
k = floor(elapsed_days since genesis)
```

Incubation covenant enforces genesis **fixed** `D = 1`. Stateful Moore-on-D ships with the WLOTUS difficulty retune (~1000× expected hashes).

## Future WLOTUS

| Param | Value |
|-------|-------|
| Target price | ~$0.01/token (~$1/remint) |
| Mint | Still **100** |
| Difficulty | ~**1000×** mWLPOW `E[hashes]` |
| Conversion | **1000 mWLPOW ≈ 1 WLOTUS** (live + burned) |

## Explicit non-goals (v0.3)

- `mintAmount ∝ work(D)` / token DAA  
- Fixed max supply  
- Mist 1-mint-per-block CLTV  
- USD price oracle on-chain  
- Temple app (separate repo; needs this PoW token first)
