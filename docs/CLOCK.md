# Host clock vs token covenant

eCash Script **cannot read mother-chain height** (or MTP, or headers). Remint covenants only see what is in the **transaction / BIP143 preimage**.

## Production covenant (`WlotusPowRemintMooreTipTemple`)

Canonical family for **WLOTUS** / **dWLOTUS**.

| Layer | Role |
|-------|------|
| **Moore D** | `bits = base + floor((locktime − genesis) / secondsPerExtraBit)` — calendar clock. Cap **bits ≤ 128**. Default **+1 bit / 500 days** (五百罗汉). Whole-byte only (`bits % 8 == 0`) for the 201-op budget. |
| **tipLocktime** | `locktime ≥ tip` — blocks past-cheat rewind on that baton |
| **Hard next-P2SH** | `prefixHash`/`codeHash`; miner supplies `nextRedeem`; baton → `P2SH(hash160(nextRedeem))` |
| **N batons** | Parallel remint lanes (genesis **28**) |
| **Temple split** | Mint **108** → **1** miner + **107** temple P2SH |

Genesis base: **0** (max sunset headroom).

```bash
TICKER=dWLOTUS TEMPLE_ADDRESS=ecash:p… BATONS=28 npm run create-wlotus-token
TEMPLE_ADDRESS=ecash:p… BATONS=28 npm run create-wlotus-token   # prod WLOTUS
BATON_INDEX=0 TIER=wlotus npm run mine-dryrun-once
```

`MOORE_DAYS_PER_EXTRA_BIT` defaults to **500**. Override clamped to **365–730**. Existing deployments keep their JSON `secondsPerExtraBit` (e.g. legacy **840** days).

### Period choice — 500 arhats, phone GPU, slight long-term scarcity

Short-term UX is **`VITE_MIN_PRAY_SECONDS`** (attention floor after remint). Moore period is the **long-term** difficulty ramp. They are independent.

**Product intent:** start at **base 0** for wLotus (PoW free at genesis — presence is soft pray + 1/107 + fees). Difficulty rises on a **500-day** arhat clock so issuance eventually dearens.

| Period | Meaning | Whole-byte *felt* jump (+8 bits) |
|--------|---------|----------------------------------|
| **500 d** default | 五百罗汉 | every **~11 years** (8 × 500 d) |
| **365 d** | calendar year | every **~8 years** |
| **730 d** | ~2 years | every **~16 years** |
| **840 d** legacy | old Moore-ish | every **~18.4 years** |

**Whole-byte caveat:** Script only accepts `bits % 8 == 0`. Tip formula ticks +1 bit per period, but **PoW difficulty only changes every 8 ticks** (+8 bits = **256×** harder).

**Hardware dampens the +8 “pump”:**

| Era (500 d/bit) | Difficulty vs genesis | Hashrate vs genesis (Moore) | Net raw time vs ~3 s |
|-----------------|----------------------|-----------------------------|----------------------|
| Year **0** | ×1 | ×1 | ~**3 s** — soft timer dominates |
| Year **~11** (first +8) | ×256 | ×~45 | ×**~6** → ~**20 s** — still ≪ soft pray |
| Year **~22** (second +8) | ×2^16 | ×~2^11 | phone band lasts longer than a 365 d clock |

### Does 840 d “keep mobile mining forever”? (no — and it kills scarcity)

Under classic Moore (2× / 2 y) and whole-byte jumps:

| Period | First +8 (~year) | Net raw time vs ~3 s | Effect |
|--------|-----------------:|---------------------:|--------|
| **500 d** | ~11 | ×**~6** → ~**20 s** | Gentle dearening — intended |
| **730 d** | ~16 | ×**~1** → ~**3 s** | Flat forever under Moore |
| **840 d** legacy | ~18 | ×**~0.4** → **easier** | Hardware outruns difficulty |

**840 does not buy “mobile forever”** — it freezes (or eases) PoW and removes difficulty-based scarcity. Capacity under load is still **≤ 28 wins / cycle** ([ARCHITECTURE.md](./ARCHITECTURE.md)).

If pagoda **buy→burn** demand exceeds temple refill (**107 × remints/day**), desk inventory tightens and price can rise **even when PoW is flat** — [ECONOMICS_WLOTUS_GLOTUS.md](./ECONOMICS_WLOTUS_GLOTUS.md).

### Cap 128 bits — phone mine ETA (base **0**, 500 d/bit)

Assumptions: mid-phone WebGPU ≈ **5 MH/s**; Moore ≈ **2× / 2 years**; soft pray ≈ **108 s**.

From base **0** → cap **128** = **+128 bits** ≈ **~175 years** calendar (128 × 500 / 365.25).

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

\*Moore hashrate growth dominates early whole-byte steps when starting from 0.

**Hard sunset:** `verify bits <= 128` — when calendar would make bits **> 128**, remints **fail forever**. WLOTUS → legacy; **GLOTUS** carries living economics.

### Can bits start at 0? At 1?

**Base 0 — yes (preferred for wLotus).** Whole-byte legal; maximizes headroom (~**175 y** sunset @ 500 d).

**Base 1 — no** on current MooreTip (`bits % 8 == 0`). Use **0 / 8 / 16 / 24 / …**.

| Constraint | Effect |
|------------|--------|
| **Whole-byte PoW** | Legal bases **0, 8, 16, 24, …** — **not 1**. |
| **Cap `bits ≤ 128`** | Headroom = `128 − baseZeroBits`. |
| **Clock** | Default **+1 bit / 500 days**. Felt PoW jumps every **8** periods. |
| **Launch gate** | Soft pray + 1/107 + 1-tip fee ceiling — not base-24 hashrate. |

**GLOTUS** can use a higher whole-byte base on its own token when it ships.

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
| `WlotusPowRemintErgon` | Dogfood only |
| `WlotusPowRemintMoore` | Legacy soft `batonHash`, `base+8` cap |

## What the covenant knows

| Source | Available on-chain? |
|--------|---------------------|
| eCash tip height | **No** |
| Median Time Past | **No** (not an opcode) |
| `nLockTime` in this tx | **Yes** — via BIP143 preimage trailer |
| Constructor params | **Yes** — baked into P2SH |

## Miner clock (off-chain)

Miner asks Chronik for MTP, sets `nLockTime ≤ MTP − ε` and `nSequence = 0xfffffffe`. Covenant derives Moore bits from that locktime and enforces `locktime ≥ tipLocktime`.
