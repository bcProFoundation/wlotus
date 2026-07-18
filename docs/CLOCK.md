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
| `gap < 60s` (hardcoded) | `activity' = min(activity+1, 2)` → more leading zero **bytes** |
| else | activity unchanged (no cool path — op budget) |
| `zeroBytes = 1 + activity'` | Toy: 1→2→3 bytes when praying the same baton fast |
| Baton → `P2SH(batonHash)` | Miner sets `batonHash = hash160(next tip redeem)` off-chain (Moore-style) |
| **N batons** | **N independent tips** — parallel remints do not force 1/mother-block |

eMPP **WLPT** announces zeroBytes/activity/locktimes beside ALP MINT. Covenant kept slim for eCash op limits.

```bash
npm run create-prayer-tip-pow-token
PRAYER_TIP_RAPID=1 npm run mine-prayer-tip-once   # bump activity
PRAYER_TIP_RAPID=1 npm run mine-prayer-tip-once   # bump again (2→3 zero bytes)
```

## Library height helpers

`src/lib/moore.ts` can map **host heights → day index** for wallets/indexers. That is **off-chain policy**, not consensus inside the fixed-D Prayer covenant.
