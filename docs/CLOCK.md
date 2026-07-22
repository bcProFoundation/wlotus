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

Tier dryrun bases: **wLotus 0** (max sunset headroom), Prayer **24**, Candle **40**, Flower **56** (economics targets remain 22/43/59).

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

**Product intent:** start at **base 0** for wLotus (PoW free at genesis — presence is soft pray + 1/107 + fees). Difficulty rises on a **500-day** arhat clock so issuance eventually dearens. Base 0 vs 24 adds **+24 bits ≈ +33 years** to the 128 sunset and roughly **doubles+** the phone-mineable calendar. Thesis: bootstrap / invest / pagoda burns; mining stays optional presence, not a launch gate.

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

### Does 840 d “keep mobile mining forever”? (no — and it kills scarcity)

Baton count (**28**) caps **wins/min**, not phone mineability. Moore period only stretches how long raw PoW stays short.

Under classic Moore (2× / 2 y) and whole-byte jumps (+8 bits = ×256):

| Period | First +8 (~year) | Net raw time vs ~3 s | Effect |
|--------|-----------------:|---------------------:|--------|
| **500 d** | ~11 | ×**~6** → ~**20 s** | Gentle dearening — intended |
| **730 d** | ~16 | ×**~1** → ~**3 s** | Flat forever under Moore |
| **840 d** legacy | ~18 | ×**~0.4** → **easier** | Hardware outruns difficulty |

So **840 does not buy “mobile forever” in a useful sense** — it freezes (or eases) PoW and **removes** difficulty-based scarcity. Phone mining capacity under load is still **≤ 28 wins / cycle** (see [ARCHITECTURE.md](./ARCHITECTURE.md) § concurrent miners).

**Demand-side caveat:** capped remints still mean capped issuance. If pagoda **buy→burn** demand exceeds temple refill (**107 × remints/day**), desk inventory tightens and price can rise **even when PoW is flat** — see [ECONOMICS_WLOTUS_GLOTUS.md](./ECONOMICS_WLOTUS_GLOTUS.md) § *Capped free-mine issuance vs pagoda burn demand*. Forever participation for devotees remains **buy / desk / pagoda burn**; Moore is optional reinforcement, not the only float valve.

### Cap 128 bits — phone mine ETA (base **0**, 500 d/bit)

Assumptions: mid-phone WebGPU ≈ **5 MH/s**; Moore ≈ **2× / 2 years**; soft pray ≈ **60 s**. Felt PoW only on whole-byte eras. Base **0** is covenant-legal (`bits % 8 == 0`); **base 1 is not** (fractional remBits dropped for 201-op budget). At bits **0**, the PoW prefix check is vacuous (any nonce) — tip race is network/API limited until Moore climbs.

From base **0** → cap **128** = **+128 bits** ≈ **~175 years** calendar (128 × 500 / 365.25). Vs old base **24**: **+33 years** sunset, and today's “launch difficulty” (24 bits) only arrives ~year **33**.

| Bits | ~Year (base 0) | Raw PoW @ 5 MH/s (Moore) | UX |
|------|---------------:|-------------------------:|----|
| **0** | 0 | instant | soft pray + 1 tip serialize |
| **8** | 11 | instant | same |
| **16** | 22 | ~instant | same |
| **24** | 33 | ~instant* | still soft-pray dominated |
| **32** | 44 | ~instant* | same |
| **40** | 55 | ~ms | same |
| **48** | 66 | ~ms–s | soft pray covers |
| **64** | 88 | ~sub-second* | still easy under Moore |
| **128** | 175 | centuries | hard sunset follows |

\*Moore hashrate growth dominates early whole-byte steps when starting from 0 — PoW stays easy far longer than a base-24 launch (where fringe began ~year 30–45).

**Hard sunset:** `verify bits <= 128` — when calendar would make bits **> 128**, remints **fail forever**. WLotus → legacy; GLotus carries living economics.

**Why base 0 (not 24):** we do not need mining as a launch gate; soft pray + temple tax + 1-tip fee ceiling already bound issuance. Lower base stretches the investable / phone-mineable era without keeping an 840-style flat forever (500 d still dearens, just from a lower floor).

### Can bits start at 0? At 1?

**Base 0 — yes (and preferred for wLotus).** Whole-byte legal; maximizes `128 − base` headroom (~**175 y** sunset @ 500 d). PoW check is vacuous until Moore leaves 0.

**Base 1 — no** on current MooreTip (need `bits % 8 == 0`). Use **0 / 8 / 16 / 24 / …**.

| Constraint | Effect |
|------------|--------|
| **Whole-byte PoW** (`bits % 8 == 0`) | Legal bases **0, 8, 16, 24, …** — **not 1**. |
| **Cap `bits ≤ 128`** | Headroom = `128 − baseZeroBits`. Lower base ⇒ more years. |
| **Clock** | Default **+1 bit / 500 days**. Felt PoW jumps every **8** periods. |
| **Launch gate** | Soft pray + 1/107 + 1-tip fee ceiling — not base-24 hashrate. |

wLotus genesis uses **base 0**. Prayer dryrun may stay **24**; Golden Lotus can use a higher whole-byte base on its own token.

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
