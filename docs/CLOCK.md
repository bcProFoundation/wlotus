# Host clock vs token covenant

eCash Script **cannot read mother-chain height** (or MTP, or headers). Remint covenants only see what is in the **transaction / BIP143 preimage**.

## What the covenant knows

| Source | Available on-chain? |
|--------|---------------------|
| eCash tip height | **No** |
| Median Time Past | **No** (not an opcode) |
| `nLockTime` in this tx | **Yes** — via BIP143 preimage trailer |
| Constructor params (`genesisUnix`, δ table, …) | **Yes** — baked into P2SH |

## How Moore / Ergon dogfood tiers work

1. **Covenant** reads `nLockTime` from the signed preimage and computes  
   `days = (locktime - genesisUnix) / daySeconds` (or extra bits).
2. **Miner (off-chain)** asks Chronik for tip + last 11 block timestamps → **MTP**, then sets  
   `nLockTime ≤ MTP` and `nSequence = 0xfffffffe` so the tx is final.
3. Implementation: `src/network/medianTimePast.ts` → used by `mine-moore-once` / `mine-ergon-once`.

```text
Chronik tip/blocks  →  MTP  →  miner picks locktime ≤ MTP
                                    ↓
                         tx nLockTime in BIP143 preimage
                                    ↓
                         covenant derives day / bits / target
```

**Cheat surface (dogfood):** a miner can pick a **past** locktime (still ≤ MTP) for easier work. Acceptable for tests; production needs a floor (e.g. locktime ≥ tip−ε via stronger rules or a stateful tip).

## Fixed-D test Prayer (`tPRAYER`)

Uses `WlotusPowRemint` with constructor difficulty only — **no locktime clock**. Remints do not consult height or MTP. Fee + toy PoW only.

## Stateful tip test Prayer (`tPRAYTIP`)

**Confirmed design:**

| Layer | Role |
|-------|------|
| **Moore D** | `bits = base + floor((locktime − genesis) / period)` — calendar clock (same family as mWLPOW). Idle time still advances D. |
| **tipLocktime** | Per-baton floor: `locktime ≥ tip` — blocks Moore **past-cheat** rewind |
| **N batons** | Parallel remint lanes — concurrent prayers scale **without** activity-based D bump |

Difficulty does **not** rise because many people pray at once. It rises because Moore time advances (and tip prevents picking an easier past day on that baton).

```bash
npm run create-prayer-tip-pow-token
BATON_INDEX=0 npm run mine-prayer-tip-once
BATON_INDEX=1 npm run mine-prayer-tip-once
```

### Known limitations (dogfood → production)

- **Soft next-baton binding.** The covenant checks `hashOutputs` against a miner-supplied `batonHash`. It does **not** enforce in-Script that `batonHash` is the P2SH of a successor redeem whose `tipLocktime' == locktime`. A malicious miner could redirect the baton to a P2SH with an older `tipLocktime` and mine at a cheaper past Moore day. The TS factory sets the correct next P2SH, so this is honest-miner dependent. Hardening the binding without breaking the eCash 520-byte push / op limits is the main production open problem.
- **Moore/Ergon covenants lack tipLocktime.** `WlotusPowRemintMoore` and `WlotusPowRemintErgon` only enforce `locktime >= genesisUnix`, so any final `nLockTime ≤ MTP` can be rewound toward genesis for easier PoW. They need a per-baton `tipLocktime` (or equivalent floor) for production WLotus/Candle/Prayer.
- **Ergon dogfood bricks after day 1.** `WlotusPowRemintErgon` hard-codes `verify days <= 1` and a 2-slot target table; it is a 48-hour experiment, not a production model.
- **Moore +8 bit cap.** `WlotusPowRemintMoore` and `WlotusPowRemintPrayerTip` cap `bits <= base + 8`. This is fine for dogfood but would need to be raised or removed for production targets (e.g., Flower 59, Candle 43, Prayer 22).
- **Ergon uses a different difficulty model.** Production tiers in `docs/SPEC.md` use leading-zero **bit** targets; Ergon uses compact numeric targets. Do not deploy Ergon for production tiers.

## Library height helpers

`src/lib/moore.ts` can map **host heights → day index** for wallets/indexers. That is **off-chain policy**, not consensus inside the fixed-D Prayer covenant.
