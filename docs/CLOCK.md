# Host clock vs token covenant

eCash Script **cannot read mother-chain height** (or MTP, or headers). Remint covenants only see what is in the **transaction / BIP143 preimage**.

## Production dryrun covenant (`WlotusPowRemintMooreTip` / Memo / Temple)

**This is the covenant family for Prayer / Candle / Flower / wLotus dryruns.** Dogfood Moore/Ergon/PrayerTip soft-bind toys are not used for production tiers.

| Layer | Role |
|-------|------|
| **Moore D** | `bits = base + floor((locktime − genesis) / (840 × 86400))` — calendar clock. Idle time advances D. Cap **bits ≤ 128**. Dryrun uses **whole-byte** bases (24/40/56) so `bits % 8 == 0` (201-op budget). |
| **tipLocktime** | `locktime ≥ tip` — blocks past-cheat rewind on that baton |
| **Hard next-P2SH** | `prefixHash`/`codeHash`; miner supplies `nextRedeem`; baton → `P2SH(hash160(nextRedeem))`. No honest-miner soft `batonHash`. |
| **N batons** | Parallel remint lanes (scale without activity-based D) |
| **wLotus temple** | `WlotusPowRemintMooreTipTemple` — mint **108** → **1** miner + **107** temple P2SH (mala) |

Tier dryrun bases: Prayer / wLotus **24**, Candle **40**, Flower **56** (economics targets remain 22/43/59).

```bash
TIER=prayer npm run create-dryrun-token
TIER=wlotus BATONS=2 npm run create-dryrun-token
BATON_INDEX=0 TIER=wlotus npm run mine-dryrun-once
```

### Can bits start at 1? Can we “shift” to last longer under the 128 cap?

**Short answer:** Not on the current MooreTip family without a new covenant. A rename/`shift` ctor param does **not** add calendar years by itself.

| Constraint | Effect |
|------------|--------|
| **Whole-byte PoW** (`bits % 8 == 0`) | Legal bases are **0, 8, 16, 24, …** — **not 1**. Fractional `remBits` was dropped to fit hard next-P2SH under eCash’s **201-op** limit. |
| **Cap `bits ≤ 128`** | Headroom = `128 − baseZeroBits`. Lower base ⇒ more years of ramp. |
| **Clock** | `+1` bit per **840** days. With whole-byte verify, remints only succeed when `extraBits ≡ 0 (mod 8)` — so difficulty is flat for ~840d×8 ≈ **18.4 years**, then jumps **+8** bits (same calendar as `bits = base + 8×floor(elapsed/period)` with period = 840d). |
| **“Shift”** | `powBits = shift + mooreExtra` is just another name for `baseZeroBits`. It does not stretch the 128-bit ceiling. To last longer: **lower base** (e.g. 8/16 for a soft launch), and/or **larger `secondsPerExtraBit`**, and/or an explicit **+8-per-era** schedule. Restoring **bits=1** needs fractional PoW back (op-budget fight vs temple outputs / memorial). |

wLotus dryrun uses **base 24** (phone-class). Golden Lotus can use a higher whole-byte base (e.g. 56/64) on a separate token — each token has its own `baseZeroBits` and 128 cap.

### Why `codeHash` + miner-supplied `nextRedeem`

Spedn 5.0 cannot emit eCash native introspection. Building the successor redeem on-stack with `OP_CAT` exceeds eCash’s **201 non-push op** limit. The production covenant instead:

1. Commits `codeHash = sha256(codeBytes)` in the ctor  
2. Requires the miner to supply `nextRedeem` in the unlock  
3. Verifies `econHead`, `tip'=locktime`, and `codeHash` in-Script  
4. Sends the baton to `P2SH(hash160(nextRedeem))`  

A late `CODESEPARATOR` keeps the BIP143 preimage small (≪ 520).

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
