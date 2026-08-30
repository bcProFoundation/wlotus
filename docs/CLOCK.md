# Host clock vs token covenant

eCash Script **cannot read** mother-chain height, MTP, or headers. Remint covenants only see the **transaction / BIP143 preimage**.

Live params: [SPEC.md](./SPEC.md). Why 500 days: below.

## What the covenant uses

| Layer | Role |
|-------|------|
| **Moore D** | `bits = base + floor((locktime − genesis) / secondsPerExtraBit)`. Cap **bits ≤ 128**. Live whole-byte: **+1 bit / 500 days**, felt only when `bits % 8 == 0`. Felt recut: **+1 bit / 730 days** (2× / ~2 y). |
| **tipLocktime** | `locktime ≥ tip` — blocks past-cheat rewind on that baton |
| **Hard next-P2SH** | Miner supplies `nextRedeem`; baton → `P2SH(hash160(nextRedeem))`. JSON `powAddress` is a cache. |

`MOORE_DAYS_PER_EXTRA_BIT` defaults to **500**, override clamped **365–730**. Existing deployments keep their JSON `secondsPerExtraBit` (legacy **840**).

Miner asks Chronik for MTP, sets `nLockTime ≤ MTP − ε` and `nSequence = 0xfffffffe`.

| Source | On-chain? |
|--------|-----------|
| eCash tip height / MTP | **No** |
| `nLockTime` (BIP143 trailer) | **Yes** |
| Constructor params | **Yes** — baked into P2SH |

## Why 500 days (not 840)

Short-term UX is **`VITE_MIN_PRAY_SECONDS`** (attention after remint). Moore is the **long-term** ramp. They are independent.

Product intent: **base 0** at genesis (PoW free — presence is soft pray + fees). The live token still uses the **500-day** arhat clock **and** `bits % 8 == 0`, so felt D jumps **256× every ~11 years**. That trade bought the remint DANA tip + temple split under the 201-op budget. It is too steep and too slow.

The felt recut (`GlotusPowRemintMooreTip`, ALP MINT only) drops the whole-byte guard. Formula tick = felt tick:

| Period | Felt step | vs Moore (2× / ~2.3 y) |
|--------|-----------|------------------------|
| **730 d** (recut default) | 2× / ~2 y | slightly faster than Ergon 2× |
| **845 d** (dGLOTUS) | 2× / ~2.31 y | Ergon Moore |
| **500 d** + felt | 2× / ~1.37 y | steeper than asked |
| **500 d** + whole-byte (live) | **256× / ~11 y** | retired by the recut |

Whole-byte + 730 d would have been **256× / ~16 y** — worse. Felt +1 bit is the only way to get ~2-year adjustments under 201 ops.

**840 does not buy “mobile forever”** — it removes difficulty-based scarcity. Capacity under load is still **≤ 28 wins / cycle** ([ARCHITECTURE.md](./ARCHITECTURE.md)). Buy→burn demand vs desk refill can still tighten inventory — [ECONOMICS.md](./ECONOMICS.md).

## Sunset (base 0, 500 d/bit)

`0 → 128` bits ≈ **~175 years**. Mid-phone WebGPU ≈ 5 MH/s; Moore ≈ 2× / 2 y; soft pray ≈ 108 s.

Through at least **~bit 64 (~year 88)** raw PoW stays soft-pray dominated. At **128**, remints **fail forever** (`verify bits <= 128`). WLOTUS becomes legacy; **GLOTUS** carries living economics.

Live whole-byte legal bases: **0, 8, 16, 24, …**. Felt recut / GLotus accept any integer bits (remBits table). GLOTUS may use a higher base.

## Why `codeHash` + miner-supplied `nextRedeem`

Spedn 5.0 cannot emit eCash native introspection. Building the successor redeem on-stack with `OP_CAT` exceeds the **201 non-push op** limit. The covenant commits `codeHash = sha256(codeBytes)`, checks miner `nextRedeem`, and sends the baton to `P2SH(hash160(nextRedeem))`. A late `CODESEPARATOR` keeps the BIP143 preimage small (≪ 520).

Dogfood only: `WlotusPowRemintErgon`, legacy `WlotusPowRemintMoore`.
