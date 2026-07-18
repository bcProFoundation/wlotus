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

Uses `WlotusPowRemintPrayerTip`: **tipLocktime** lives in a mutating P2SH.

**Design intent:** mint as many prayers as needed. Difficulty stays fixed (toy 1-byte PoW). Scale comes from **N batons = N independent tips** so concurrent prayers do not serialize on one baton UTXO.

| Rule | Effect |
|------|--------|
| `locktime ≥ tipLocktime` | Anti-rewind (blocks Moore past-cheat on that baton) |
| Fixed `zeroBytes = 1` | No activity / difficulty bump |
| Baton → `P2SH(batonHash)` | Next tip redeem with `tipLocktime' = locktime` (Moore-style soft hash) |
| **N batons** | **N parallel remint lanes** |

```bash
npm run create-prayer-tip-pow-token
BATON_INDEX=0 npm run mine-prayer-tip-once
BATON_INDEX=1 npm run mine-prayer-tip-once   # parallel tip
```

## Library height helpers

`src/lib/moore.ts` can map **host heights → day index** for wallets/indexers. That is **off-chain policy**, not consensus inside the fixed-D Prayer covenant.
