# Host clock vs token covenant

eCash Script **cannot read mother-chain height** (or MTP, or headers). Remint covenants only see what is in the **transaction / BIP143 preimage**.

## Production dryrun covenant (`WlotusPowRemintMooreTip` / Memo / Temple)

**This is the covenant family for Prayer / Candle / Flower / wLotus dryruns.** Dogfood Moore/Ergon/PrayerTip soft-bind toys are not used for production tiers.

| Layer | Role |
|-------|------|
| **Moore D** | `bits = base + floor((locktime − genesis) / secondsPerExtraBit)` — calendar clock. Idle time advances D. Cap **bits ≤ 128**. Default **+1 bit / 500 days** (五百罗汉). Dryrun uses **whole-byte** bases (24/40/56) so `bits % 8 == 0` (201-op budget). |
| **tipLocktime** | `locktime ≥ tip` — blocks past-cheat rewind on that baton |
| **Hard next-P2SH** | `prefixHash`/`codeHash`; miner supplies `nextRedeem`; baton → `P2SH(hash160(nextRedeem))`. No honest-miner soft `batonHash`. |
| **N batons** | Parallel remint lanes (scale without activity-based D) |
| **wLotus temple** | `WlotusPowRemintMooreTipTemple` — mint **108** → **1** miner + **107** temple P2SH (mala) |

Tier dryrun bases: Prayer / wLotus **24**, Candle **40**, Flower **56** (economics targets remain 22/43/59).

```bash
TIER=prayer npm run create-dryrun-token
TIER=wlotus BATONS=2 npm run create-dryrun-token
# Optional: gentler ramp (~2 years/bit)
MOORE_DAYS_PER_EXTRA_BIT=730 TIER=wlotus BATONS=28 npm run create-dryrun-token
BATON_INDEX=0 TIER=wlotus npm run mine-dryrun-once
```

`MOORE_DAYS_PER_EXTRA_BIT` defaults to **500** (五百罗汉 — one arhat-day per calendar day until the bit ticks). Override clamped to **365–730** (~1–2 years). Existing deployments keep their JSON `secondsPerExtraBit` (e.g. legacy **840** days).

### Period choice — 500 arhats, phone GPU, slight long-term scarcity

Short-term UX is **`VITE_MIN_PRAY_SECONDS`** (attention floor after remint). Moore period is the **long-term** difficulty ramp. They are independent.

**Product intent:** start **very low** on phone GPU (base **24** + soft pray) so launch mining is easy. Difficulty rises on a **500-day** arhat clock (not legacy **840** — too loose and not symbolically linked) so new issuance gets **slightly** dearer over years. Thesis: a token that can stay **gently profitable long-term** — people **buy and pray**, or **invest** for slight appreciation — while **burns through the pagoda** recirculate memorial demand and keep remints meaningful. Mining stays the presence path; desk inventory serves non-miners.

Assume mid-phone WebGPU ≈ **5 MH/s**, base **24** bits → raw PoW ≈ **~3 s** (soft timer still holds ~60 s). Classic **Moore** ≈ **2× hashrate / 2 years**.

| Period | Meaning | Whole-byte *felt* jump (+8 bits) |
|--------|---------|----------------------------------|
| **500 d** default | 五百罗汉 | every **~11 years** (8 × 500 d) |
| **365 d** | calendar year | every **~8 years** |
| **730 d** | ~2 years | every **~16 years** |
| **840 d** legacy | old Moore-ish | every **~18.4 years** |

**Whole-byte caveat:** Script only accepts `bits % 8 == 0`. Tip formula ticks +1 bit per period, but **PoW difficulty only changes every 8 ticks** (+8 bits = **256×** harder). During each flat era, phones keep getting faster; that growth dampens the staircase when it lands.

**Hardware dampens the +8 “pump”:**

| Era (500 d/bit) | Difficulty vs genesis | Hashrate vs genesis (Moore) | Net raw time vs ~3 s |
|-----------------|----------------------|-----------------------------|----------------------|
| Year **0** | ×1 | ×1 | ~**3 s** — soft timer dominates |
| Year **~11** (first +8) | ×256 | ×~45 | ×**~6** → ~**20 s** — still ≪ 2–5 min; soft pray covers UX |
| Year **~22** (second +8) | ×2^16 | ×~2^11 | phone band lasts longer than a 365 d clock |

So **500 d/bit** is slightly gentler than 365 d, memorable (arhat calendar), and still more aggressive than legacy 840 d — low start with **slow** scarcity for long-term pray/invest. Soft pray does not soften on-chain PoW after finds get truly hard — desk / market / pagoda burns remain the scalable path.

### Cap 128 bits — phone mine ETA projection (500 d/bit)

Assumptions: mid-phone WebGPU ≈ **5 MH/s** at genesis → raw PoW ≈ **~3 s** at base **24**; Moore ≈ **2× hashrate / 2 years**; soft pray ≈ **60 s** after remint. Felt PoW only changes on whole-byte eras (+8 bits).

From base **24** → cap **128** = **+104 bits** ≈ **~142 years** calendar (104 × 500 / 365.25).

| Bits | ~Year | Diff vs genesis | Phone HR (Moore) | Raw PoW ETA (Moore) | Raw PoW (frozen phone) | UX |
|------|------:|----------------:|-----------------:|--------------------:|-----------------------:|----|
| **24** | 0 | ×1 | ×1 | **~3 s** | ~3 s | soft pray (~60 s) dominates |
| **32** | 11 | ×256 | ×~45 | **~17 s** | ~13 min | soft pray still covers |
| **40** | 22 | ×2^16 | ×~2k | **~1.7 min** | ~2.3 d | PoW noticeable |
| **48** | 33 | ×2^24 | ×~88k | **~10 min** | ~1.6 y | phone fringe |
| **56** | 44 | ×2^32 | ×~4M | **~55 min** | centuries | phone fringe |
| **64** | 55 | ×2^40 | ×~170M | **~5 h** | — | desk / pagoda path |
| **72** | 66 | ×2^48 | ×~8B | **~1.3 d** | — | desk / pagoda |
| **80** | 77 | ×2^56 | ×~350B | **~1 week** | — | desk / pagoda |
| **96** | 99 | ×2^72 | ×~7×10^14 | **~8 months** | never | desk / pagoda |
| **128** | 142 | ×2^104 | ×~3×10^21 | **~700 y** | never | Script cap only |

At **128** with Moore: difficulty ×2^104, hashrate ×2^(142/2)≈2^71 → net ×**~10^9** vs genesis → ~3 s × 10^9 ≈ **centuries** of continuous hashing. Soft timer is irrelevant; phones do not finish.

**Takeaway:** phone mining is comfortable for **~10–20 years**, fringe by **~30–45 years**, then impractical. The 128-bit ceiling is a Script/safety cap, not a “phones still pray in 100 years” promise. Long before that, the product path is **buy / desk inventory / burn through the pagoda** (recirculating demand while Moore keeps fresh mining dear). Golden Lotus can use a separate higher base.

### Can bits start at 1? Can we “shift” to last longer under the 128 cap?

**Short answer:** Not on the current MooreTip family without a new covenant. A rename/`shift` ctor param does **not** add calendar years by itself.

| Constraint | Effect |
|------------|--------|
| **Whole-byte PoW** (`bits % 8 == 0`) | Legal bases are **0, 8, 16, 24, …** — **not 1**. Fractional `remBits` was dropped to fit hard next-P2SH under eCash’s **201-op** limit. |
| **Cap `bits ≤ 128`** | Headroom = `128 − baseZeroBits`. Lower base ⇒ more years of ramp. |
| **Clock** | Default **+1 bit / 500 days** (五百罗汉; override 365–730). With whole-byte verify, remints only succeed when `extraBits ≡ 0 (mod 8)` — flat for **8 periods**, then **+8** bits. |
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
