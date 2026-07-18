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

Uses `WlotusPowRemintPrayerTip`: tip lives in **mutating P2SH** constructor params (`tipLocktime`, `tipActivity`).

| Rule | Effect |
|------|--------|
| `locktime ≥ tipLocktime` | Anti-rewind (blocks Moore past-cheat on that baton) |
| `gap < minGapSeconds` | `activity' = min(activity+1, 8)` → bits rise (concurrent pray on **same** baton) |
| `gap ≥ coolGapSeconds` | `activity' = max(activity−1, 0)` |
| else | activity unchanged |
| `bits = baseZeroBits + activity'` | Toy base=1 for dogfood |
| Baton → `P2SH(hash160(nextRedeem))` | Next tip instance; miner supplies `nextRedeem` + `nextTip*` |
| **N batons** | **N independent tips** — parallel remints do not force 1/mother-block |

eMPP **WLPT** announces bits/activity/locktimes beside ALP MINT (Agora pattern). Soft binding: on-chain checks `hash160(nextRedeem)` + `nextTip*` match tip'; honest miners use the TS factory.

```bash
npm run create-prayer-tip-pow-token
PRAYER_TIP_RAPID=1 npm run mine-prayer-tip-once   # bump activity
PRAYER_TIP_RAPID=1 npm run mine-prayer-tip-once   # bump again
```

## Library height helpers

`src/lib/moore.ts` can map **host heights → day index** for wallets/indexers. That is **off-chain policy**, not consensus inside the fixed-D Prayer covenant.
