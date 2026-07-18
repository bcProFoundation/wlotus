# Host clock vs token covenant

eCash Script **cannot read mother-chain height** (or MTP, or headers). Remint covenants only see what is in the **transaction / BIP143 preimage**.

## Production dryrun covenant (`WlotusPowRemintMooreTip`)

**This is the covenant for Prayer / Candle / Flower dryruns.** Dogfood Moore/Ergon/PrayerTip soft-bind toys are not used for production tiers.

| Layer | Role |
|-------|------|
| **Moore D** | `bits = base + floor((locktime − genesis) / (840 × 86400))` — calendar clock. Idle time advances D. Cap **bits ≤ 128**. |
| **tipLocktime** | `locktime ≥ tip` — blocks past-cheat rewind on that baton |
| **Hard next-P2SH** | `codeHash = sha256(codeBytes)`; baton → `P2SH(prefix ‖ tip'=locktime ‖ codeBytes)`. Miner cannot redirect to an older tip. |
| **N batons** | Parallel remint lanes (scale without activity-based D) |

Tier bases (from `consensus.ts`): Prayer **22**, Candle **43**, Flower **59**.

```bash
TIER=prayer npm run create-dryrun-token
BATON_INDEX=0 npm run mine-dryrun-once
BATON_INDEX=1 npm run mine-dryrun-once
```

### Why `codeHash` (not soft `batonHash`)

Spedn 5.0 cannot emit eCash native introspection (`activeBytecode`, etc.). Full redeem in BIP143 `scriptCode` exceeds the 520-byte push limit. The production covenant keeps a late `CODESEPARATOR` (tiny preimage) and commits the immutable body as `codeHash`; the miner supplies matching `codeBytes` in the unlock.

### Deprecated for production

| Contract | Status |
|----------|--------|
| `WlotusPowRemintErgon` | Dogfood only — 2-day table, numeric targets ≠ production bit floors |
| `WlotusPowRemintMoore` | Legacy soft `batonHash`, `base+8` cap — do not dryrun production tiers on it |
| `WlotusPowRemintPrayerTip` | Soft next-P2SH — superseded by MooreTip |

## What the covenant knows

| Source | Available on-chain? |
|--------|---------------------|
| eCash tip height | **No** |
| Median Time Past | **No** (not an opcode) |
| `nLockTime` in this tx | **Yes** — via BIP143 preimage trailer |
| Constructor params | **Yes** — baked into P2SH |

## Miner clock (off-chain)

Miner asks Chronik for MTP, sets `nLockTime ≤ MTP − ε` and `nSequence = 0xfffffffe`. Covenant derives Moore bits from that locktime and enforces `locktime ≥ tipLocktime`.

## Fixed-D / soft-tip dogfood (archived)

Earlier toys (`tPRAYER`, soft `tPRAYTIP`, Moore/Ergon mWLPOW) remain in the repo for history. New work uses MooreTip dryrun scripts only.
