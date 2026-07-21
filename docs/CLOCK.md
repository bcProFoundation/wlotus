# Host clock vs token covenant

eCash Script **cannot read mother-chain height** (or MTP, or headers). Remint covenants only see what is in the **transaction / BIP143 preimage**.

## Production dryrun covenant (`WlotusPowRemintMooreTip` / Memo / Temple)

**This is the covenant family for Prayer / Candle / Flower / wLotus dryruns.** Dogfood Moore/Ergon/PrayerTip soft-bind toys are not used for production tiers.

| Layer | Role |
|-------|------|
| **Moore D** | `bits = base + floor((locktime − genesis) / secondsPerExtraBit)` — calendar clock. Idle time advances D. Cap **bits ≤ 128**. Default **+1 bit / 365 days** (1 year). Dryrun uses **whole-byte** bases (24/40/56) so `bits % 8 == 0` (201-op budget). |
| **tipLocktime** | `locktime ≥ tip` — blocks past-cheat rewind on that baton |
| **Hard next-P2SH** | `prefixHash`/`codeHash`; miner supplies `nextRedeem`; baton → `P2SH(hash160(nextRedeem))`. No honest-miner soft `batonHash`. |
| **N batons** | Parallel remint lanes (scale without activity-based D) |
| **wLotus temple** | `WlotusPowRemintMooreTipTemple` — mint **108** → **1** miner + **107** temple P2SH (mala) |

Tier dryrun bases: Prayer / wLotus **24**, Candle **40**, Flower **56** (economics targets remain 22/43/59).

```bash
TIER=prayer npm run create-dryrun-token
TIER=wlotus BATONS=2 npm run create-dryrun-token
# Optional: slower ramp (2 years/bit)
MOORE_DAYS_PER_EXTRA_BIT=730 TIER=wlotus BATONS=28 npm run create-dryrun-token
BATON_INDEX=0 TIER=wlotus npm run mine-dryrun-once
```

`MOORE_DAYS_PER_EXTRA_BIT` is clamped to **365–730** (1–2 years) and baked into the covenant at genesis. Existing deployments keep their JSON `secondsPerExtraBit` (e.g. legacy **840** days).

### Period choice (1 year vs ~2 years) — phone GPU + soft pray

Short-term UX is **`VITE_MIN_PRAY_SECONDS`** (attention floor after remint). Moore period is the **long-term** difficulty ramp. They are independent.

Assume mid-phone WebGPU ≈ **5 MH/s**, base **24** bits → raw PoW ≈ **~3 s** (soft timer still holds ~60 s). Classic **Moore** ≈ **2× hashrate / 2 years**.

| Period | Formula tick | Whole-byte *felt* jump (+8 bits) | vs Moore (2×/2y) |
|--------|--------------|----------------------------------|------------------|
| **365 d (1 y)** default | +1 bit/year | every **~8 years** (×256 work) | Aggressive: work outruns Moore |
| **730 d (2 y)** | +1 bit/2y | every **~16 years** | Matches Moore → raw time ~flat between jumps |
| **840 d (legacy)** | +1 bit/~2.3y | every **~18.4 years** | Slightly easier over time than Moore |

**Whole-byte caveat:** Script only accepts `bits % 8 == 0`. So the tip formula can tick +1/year, but **PoW difficulty only changes every 8 ticks** (+8 bits = **256×** harder). Between jumps, bits in the tip state still rise, but remints fail until `extraBits ≡ 0 (mod 8)` — same as a staircase of eras.

**When mobile GPU leaves the ~2–5 min band (1 y/bit, whole-byte):**

- Year **0**: ~3 s raw → soft timer dominates.
- Year **~8** (first +8 jump): difficulty ×256; Moore ×~16 → net ~**×16** → ~**1 min** raw. Still OK with soft timer.
- Year **~16** (second jump): net ~**×256** vs genesis → ~**15 min** raw — past the comfortable phone band unless hashrate beat Moore.

So **1 year/bit stays phone-friendly for on the order of one whole-byte era (~8–16 years)**, then desk / market paths matter more. Soft pray does not soften on-chain PoW — it only floors attention after a find.

### Cap 128 bits — how long to mine on a phone (with Moore)?

From base **24** to cap **128** = **+104 bits** ≈ **104 years** at 1 bit/year (or ~239 years at legacy 840 d).

If phone hashrate doubles every **2 years** for the whole century:

| | |
|--|--|
| Difficulty growth | × **2^104** |
| Hashrate growth (Moore) | × **2^(104/2) = 2^52** |
| Net mine time vs genesis | × **2^52** ≈ **4.5×10^15** |

Genesis ~3 s × 2^52 ≈ **~4×10^8 years** of continuous hashing — **not mineable on any phone**. Soft timer is irrelevant; PoW never finishes.

**Takeaway:** the 128-bit ceiling is a Script/safety cap, not a “phones still pray in 100 years” promise. Long before that, issuance shifts to desk inventory / burns; Golden Lotus can use a separate higher base.

### Can bits start at 1? Can we “shift” to last longer under the 128 cap?

**Short answer:** Not on the current MooreTip family without a new covenant. A rename/`shift` ctor param does **not** add calendar years by itself.

| Constraint | Effect |
|------------|--------|
| **Whole-byte PoW** (`bits % 8 == 0`) | Legal bases are **0, 8, 16, 24, …** — **not 1**. Fractional `remBits` was dropped to fit hard next-P2SH under eCash’s **201-op** limit. |
| **Cap `bits ≤ 128`** | Headroom = `128 − baseZeroBits`. Lower base ⇒ more years of ramp. |
| **Clock** | Default **+1 bit / 365 days** (override 365–730). With whole-byte verify, remints only succeed when `extraBits ≡ 0 (mod 8)` — flat for **8 periods**, then **+8** bits. |
| **“Shift”** | `powBits = shift + mooreExtra` is just another name for `baseZeroBits`. It does not stretch the 128-bit ceiling. To last longer: **lower base** (e.g. 8/16 for a soft launch), and/or **larger `secondsPerExtraBit`** (up to 2 years), and/or an explicit **+8-per-era** schedule. Restoring **bits=1** needs fractional PoW back (op-budget fight vs temple outputs / memorial). |

wLotus dryrun uses **base 24** (phone-class participation / presence). Bits are **not** a substitute for anti-farming or L1 security — see [ECONOMICS_WLOTUS_GLOTUS.md](./ECONOMICS_WLOTUS_GLOTUS.md) § *Product intent* (**1/107 + fees**, soft pray timer for attention). Golden Lotus can use a higher whole-byte base (e.g. 56/64) on a separate token — each token has its own `baseZeroBits` and 128 cap.

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
