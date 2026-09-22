# CHIP draft: `OP_MUL` and Median-Time-Past introspection for eCash

**Status:** Draft for discussion with eCash / Bitcoin ABC developers  
**Authors:** WLotus / GLotus covenant research (bcProFoundation/wlotus)  
**Date:** 2026-09-22  
**Depends on:** Shibusawa (63-bit script integers, Nov 2025) — already live  
**Does not depend on:** Bitcoin Cash Loops / Functions / BigInt / CashTokens

---

## Abstract

Two small Script upgrades unlock durable, Moore-adjusted PoW-minted ALP tokens
on eCash while preserving **horizontal** issuance (fixed atoms per mint, many
batons in parallel):

1. **Re-enable `OP_MUL` (`0x95`)** with overflow checks against the existing
   63-bit signed integer range.
2. **Add one introspection opcode that pushes Median Time Past (MTP)** of the
   validating block (or an equivalent previous-block timestamp), so a covenant
   can require that its chosen `nLockTime` belongs to the **current** Moore era.

Neither change alters ALP, baton counts, or the open tip-race model already
live on [wlotus.org](https://wlotus.org). Both are strictly additive.

---

## Motivation

### Product goal (unchanged)

WLotus / ELotus / GLotus issue tokens by grinding a covenant PoW on mint
batons:

- **Fixed atoms per mint** (horizontal scaling — more hashrate → more mints,
  not a larger mint).
- **Constant difficulty inside a locked period**, then a Moore step.
- **Open tip race:** anyone may mine any baton; the first accepted spend
  publishes the successor tip; losers retarget (same publication rule as
  Bitcoin heads, without a block-spacing floor).

This is already live for WLotus (`WLotusCovenant` / felt Moore tip). The
design deliberately prefers horizontal scaling over Ergon’s vertical
“reward grows with difficulty” model, because lanes ramp up and down faster.

### Gap 1 — daily Ergon δ needs `OP_MUL`

A smooth Ergon-style daily factor

```text
target' = target − (target × 82) / 100000
        = floor(target × 99918 / 100000)
```

fits in today’s 63-bit integers for the compact targets these covenants use
(`target × 82` stays well below `2^63`). The multiply itself does **not**.

`OP_MUL` remains disabled in Bitcoin ABC (`IsOpcodeDisabled` returns true for
`0x95`). Emulating the multiply with double-and-add costs ~40 non-push opcodes
per day-step (Spedn probe in this repo). Live remint scripts already sit
against the **201 non-push opcode** and **520-byte P2SH** ceilings, so the
daily step cannot live in the mining script without `OP_MUL` (or a second
covenant shard that cross-pins compute + mint).

With `OP_MUL`, one day-step is roughly five opcodes and fits beside PoW +
successor checks. Horizontal scaling is preserved: difficulty is constant for
the calendar day; miners still scale by opening more races.

### Gap 2 — Moore eras are miner-optional without MTP

Live Moore tip rules (simplified):

```text
verify locktime >= tipLocktime
bits = base + floor((locktime − genesis) / secondsPerExtraBit)
```

The miner chooses `nLockTime ≤ MTP`. The covenant never sees MTP. After an
era boundary, **repeating the old tip is still valid**, so a baton can stay on
genesis difficulty forever. Advancing to “now” is also valid and steps the
bits — but that step is **miner-enforced, not covenant-enforced**.

That is acceptable for ceremonial WLotus. It is fatal for ELotus / GLotus as
money: the token can remain cheap by never advancing the tip.

Bitcoin Cash native introspection (`0xc0`–`0xcd`) does **not** expose MTP or
parent-header time either. This gap is shared; eCash must add the signal.

Desired rule once MTP is visible:

```text
era(locktime) == era(MTP)
where era(t) = floor((t − genesis) / period)
```

Inside an era, difficulty stays flat and all 28 batons keep racing. On the
day the era rolls, every baton must use the new bit count. Repeating the old
tip fails.

---

## Specification

### 1. Re-enable `OP_MUL`

| Item | Value |
|------|-------|
| Opcode | `OP_MUL` = `0x95` / 149 |
| Semantics | Pop `a`, `b`; push `a * b` as a Script Number |
| Range | Operands and result must be valid 63+sign-bit Script Numbers (Shibusawa) |
| Overflow | Fail the script if the product is outside that range (same posture as BCH May 2022 Bigger Script Integers) |
| Activation | Soft/hard fork flag; disabled before activation (current behaviour) |

Reference: [CHIP-2021-03 Bigger Script Integers](https://documentation.cash/protocol/forks/chips/2022-05-bigger-script-integers) as activated on Bitcoin Cash — same opcode, adapted to eCash’s existing 63-bit limit (no BigInt required for this use case).

**Out of scope for this CHIP:** unbounded BigInt, `OP_MULDIV`, loops.

### 2. Median Time Past introspection

| Item | Value |
|------|-------|
| Proposed name | `OP_MEDIANTIMEPAST` (preferred) or `OP_PREVBLOCKTIME` |
| Codepoint | Next free introspection slot (suggestion: `0xce`, adjacent to `0xc0`–`0xcd`) |
| Semantics | Push the validating block’s **Median Time Past** as a Script Number (same units as `nLockTime`: Unix seconds) |
| Alternative | Push the previous block’s `nTime` if MTP is awkward to plumb; covenants then use a documented ε bound |
| Failure | Always succeeds when the block context is available (coinbase/genesis edge: define as 0 or genesis time — must be specified) |

**Why MTP, not wall clock:** MTP is already the consensus clock that
`nLockTime` is compared against. Pushing it keeps the covenant’s era in lockstep
with the same clock miners already use when setting remint locktimes.

**Minimal covenant check (felt / daily era):**

```text
OP_MEDIANTIMEPAST          # mtp
# ... load genesis, period, locktime from redeem / preimage ...
# eraL = (locktime - genesis) / period
# eraM = (mtp - genesis) / period
# verify eraL == eraM
```

No multiply required for the era equality when `period` divides cleanly via
`OP_DIV` (e.g. 500 calendar days, or 86400 for a daily Ergon era).

---

## What this does *not* change

| Concern | Status |
|---------|--------|
| ALP 28 batons / token | Unchanged — horizontal lanes stay |
| Open tip race / tip publication | Unchanged — first spend still wins |
| Fixed atoms per mint | Unchanged — still horizontal, not Ergon-vertical |
| Native introspection `0xc0`–`0xcd` | Already live; MTP is an additive sibling |
| 201-op / 520-byte P2SH limits | Unchanged; `OP_MUL` shrinks daily-δ cost enough to fit |
| CashTokens / BCH loops | Not requested |

---

## Rationale — why not workarounds

| Workaround | Fate |
|------------|------|
| Double-and-add multiply in one script | ~40 ops/step; overflows 201-op budget beside PoW + next-P2SH |
| Two-shard compute+mint (multi-input) | Feasible prototype (~40 ops/step on a compute shard); still awkward UX and fee drag; `OP_MUL` collapses it into the normal mint |
| Oracle feeds “now” or era index | Destroys trustless Moore peg |
| Require `locktime == tip + period` | Breaks horizontal racing inside an era; forces artificial spacing |
| Move token to Bitcoin Cash | Loops/`OP_MUL` help **vertical** reward schedules; CashTokens have **one** minting capability — worse for horizontal lanes; MTP still missing |

---

## Measured evidence (this repo)

1. **`OP_MUL` disabled** on Bitcoin ABC master (`IsOpcodeDisabled` includes
   `OP_MUL`).
2. **63-bit integers live** since Shibusawa (Nov 2025) — product range for
   `target × 82` is satisfied.
3. **Daily δ without `OP_MUL`:** ~40 ops/step (Spedn double-and-add probe).
4. **Live WLotus** (`a41bf9d0…` on wlotus.org): felt covenant, `baseZeroBits=0`,
   108 atoms, 28 batons — era advancement is miner-optional under today’s
   rules ([CLOCK.md](../CLOCK.md)).
5. **Introspection without MTP:** `src/covenant/opcodes.ts` documents
   `0xc0`–`0xcd`; none expose host time.

---

## Activation & compatibility

- Both features are **new consensus behaviour** behind an upgrade flag.
- Pre-activation: `OP_MUL` remains disabled; unknown `0xce` fails as an
  invalid/disabled opcode (same as any unused codepoint).
- Post-activation: existing covenants that never call these opcodes are
  unaffected. New ELotus / GLotus geneses can require them.
- No change to mempool policy beyond standard script verification.

---

## Security considerations

### `OP_MUL`

- Overflow must fail closed (no wrapping). Reuse the 63-bit overflow posture
  already reviewed for Shibusawa arithmetic.
- DoS: one multiply is cheap relative to existing `OP_CHECKSIG` / hashing;
  keep the 201-op meter (or whatever density limit eCash adopts later).

### `OP_MEDIANTIMEPAST`

- **Miner timestamp grinding:** MTP is median-of-11 and already bounds
  `nLockTime`. Covenants that equate eras to MTP inherit those bounds; they
  do not invent a tighter clock.
- **Edge at genesis / early blocks:** specify MTP for height &lt; 11 explicitly.
- **Reorgs:** MTP can move slightly on shallow reorgs; era boundaries should
  use periods ≫ typical reorg depth (day or 500-day eras are fine; sub-minute
  eras would be reckless and are not proposed).
- **Privacy / introspection surface:** pushes one public consensus value;
  no new UTXO or key material.

### Economic (application layer)

- With MTP era-equality, difficulty **must** advance at era boundaries —
  closes the “stay cheap forever” hole for ELotus / GLotus.
- With `OP_MUL`, daily δ can sit in the mint script — Moore trend can be
  smooth without leaving horizontal scaling.
- Neither opcode forces vertical “mint ∝ difficulty”; that remains an
  application choice (and still needs reward arithmetic that this CHIP does
  not require).

---

## Implementation sketch (Bitcoin ABC)

1. **`OP_MUL`:** remove `OP_MUL` from `IsOpcodeDisabled` when the upgrade flag
   is set; implement overflow-checked 63-bit multiply in `EvalScript` (mirror
   BCH May 2022, clamp to eCash’s Script Number limit).
2. **`OP_MEDIANTIMEPAST`:** plumb MTP from `BlockScriptContext` / signature
   checker into the interpreter (same path that already supplies introspection
   context for `OP_TXLOCKTIME` et al.); add opcode `0xce` pushing `CScriptNum(mtp)`.
3. Tests: script_tests vectors for multiply edges; functional test that a
   remint-style script fails when `era(locktime) != era(MTP)` and passes when
   equal.
4. Chronik / `ecash-lib` / Spedn: expose the opcode name for wallet and
  covenant compilers (follow-up, not consensus-blocking).

---

## Proposal asks (summary for reviewers)

| # | Ask | Priority for ELotus/GLotus money |
|---|-----|-----------------------------------|
| 1 | Re-enable **`OP_MUL`** (63-bit overflow-checked) | High — daily Ergon δ in one mint script |
| 2 | Add **`OP_MEDIANTIMEPAST`** (or previous-block time) | **Critical** — force Moore era advancement |
| — | Loops / BigInt / CashTokens | **Not requested** |

Either opcode alone is useful. Together they make a trustless, horizontally
scaled, Moore-adjusted PoW token enforceable on eCash without oracles and
without migrating to Bitcoin Cash.

---

## References

- Live product clock: [docs/CLOCK.md](../CLOCK.md)
- Economics: [docs/ECONOMICS.md](../ECONOMICS.md)
- Ergon-style issuance feasibility: [ergon-style-issuance-on-ecash.md](./ergon-style-issuance-on-ecash.md)
- eCash introspection codepoints: `src/covenant/opcodes.ts`
- BCH precedent for `OP_MUL`: CHIP-2021-03 Bigger Script Integers
- Shibusawa 63-bit integers: Bitcoin ABC D18469 / eCash Nov 2025 upgrade
