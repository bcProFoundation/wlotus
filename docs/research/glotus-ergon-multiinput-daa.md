# Ergon-like daily adjustment for GLotus via split covenant inputs

**Question:** can GLotus replace the coarse felt +1-bit (×2 per 845 days)
schedule with an Ergon-like smooth daily multiply
`target ← floor(target · 99918 / 100000)`, splitting the arithmetic across
multiple covenant inputs that cross-check each other's redeem scripts (ALP
author's hint)?

**Verdict: yes — feasible, with a state-carry + step-cap shape, not by
splitting unbounded iteration.** One day-step on a 32-bit compact target
measures **40 non-push ops** Spedn-compiled, so even a single step plus the
existing PoW/output logic (195 ops, 470 B) overflows one script. Two
covenant shards — a compute shard and a mint/PoW shard — cross-pinned with
native introspection fit comfortably. The multi-input split solves the
**op budget**, while a per-remint step cap `K` (recommended `K = 3`) keeps
the iteration count bounded; stale batons catch up with fee-only tick txs.

This is research for **dGLOTUS** (research token). It changes nothing live.

---

## 1. Updated constraint map (Sep 2026)

| Constraint | Status | Source |
|---|---|---|
| 201 non-push ops / script | Still assumed binding | `measure-glotus-mantissa.ts`: shipped GLotus shape is **195 ops / 470 B** (6 ops, 50 B headroom) |
| P2SH redeem ≤ 520 B | Still assumed binding | Same measurement; 8-slot mantissa variant already fails both limits (243 ops / 546 B) |
| `OP_DIV` / `OP_MOD` | Available | Live contracts already compile `/` and `%` for `xec` |
| `OP_MUL` | Assumed **absent** | Contracts header: "no OP_MUL"; design below needs only `ADD`/`DIV` |
| 64-bit script numbers | Believed live since the Nov 2025 eCash upgrade (ABC 0.32.x "64-Bit Integers in Script"); **must re-verify on chipnet before genesis** | e.cash upgrade page history |
| Native introspection (`OP_TXINPUTCOUNT` 0xc3, `OP_UTXOBYTECODE` 0xc7, `OP_INPUTBYTECODE` 0xca) | Believed live (Agora precedent, `src/covenant/opcodes.ts`); **must re-verify on chipnet** | `docs/research/ergon-style-issuance-on-ecash.md` §3 |
| Spedn 5.0 | **Cannot emit 0xc0–0xcd**; can express the step math (`ADD`/`DIV`/compares only) | `docs/CLOCK.md` |
| No script loops on eCash | Iteration must be **unrolled**; per-tx step count must be capped | Consensus |

## 2. Why "just split the computation" is not the whole answer

The Ergon schedule from genesis is `target_d = floor(target_0 · δ^d)`
iterated daily — `d` day-steps for day `d`, with `d` growing forever. No
fixed number of inputs can cover an unbounded `d`: a miner reminting after
a 3-year gap would need ~1000 chained multiplies. Splitting across inputs
divides the **per-step** cost, never the **step count**.

So the covenant must carry state forward instead of recomputing from
genesis: each shard's redeem bakes `(tipDay, target)` (32-bit compact
target, same direction as the `WlotusPowRemintErgon` dogfood), and each
remint advances `tipDay → newDay` applying `k = newDay − tipDay` steps with
a consensus cap `k ≤ K`. This is the same ratchet the live design already
uses for `tipLocktime`, extended to carry the target.

## 3. Measured cost: 40 ops per day-step

Probe: Spedn `xec` compile of `t ← t − (t·82)/100000` (equivalent to
`t·99918/100000` since `99918 = 100000 − 82`), multiply by double-and-add,
`N = 1` vs `N = 4` unrolled steps:

| Steps | Redeem bytes | Non-push ops | Marginal |
|---|---|---|---|
| 1 | 52 | 44 | — |
| 4 | 196 | 164 | **40 ops/step** |

(`t·82 < 2^38` needs the 64-bit range above. A pure-31-bit fallback
exists — `floor(t·82/100000) = 82·(t div 100000) + floor(82·(t mod 100000)/100000)`,
all intermediates `< 2^24` — at ~45–50 ops/step if 64-bit fails
verification. Prefer 64-bit.)

Compute-shard budget at `K = 3`: day math (~12) + 3 × 40 + output
construction/pinning (~35) + sibling pin (~10) ≈ **≈177 ops, ≈360 B** —
fits. `K = 4` (≈217 ops) does not; larger `K` wants a second compute
shard. Recommend **`K = 3`**.

## 4. Two-shard layout

The baton becomes **two** covenant UTXOs, both spent and recreated in
every mint or tick tx (outputs: OP_RETURN ALP MINT, miner P2PKH, `C'`
P2SH, `M'` P2SH).

- **Compute shard C.** Derives `(newDay, newTarget)` itself: checks
  `0 ≤ newDay − tipDay ≤ K`, unrolls the `K`-bounded step chain from its
  baked `(tipDay, target)`, constructs **all four outputs** in-script from
  the derived values, pins `hashOutputs` from its own BIP143 preimage.
- **Mint shard M.** Keeps the existing PoW + output logic, minus ~10 ops
  moved to balance budgets: takes `(newDay, newTarget)` as prover witness,
  verifies the full next-redeems byte-exact (fixed parts against baked
  `prefixHash`/`codeHash`, variable 8-byte `(newDay, newTarget)` at known
  offsets — the current `tipChunk` technique with 8 variable bytes instead
  of 4), checks PoW against `newTarget`, pins the same four outputs.

**Cross-binding (the ALP hint, concretely):** each script asserts
`OP_TXINPUTCOUNT == 2` and that the sibling input's UTXO locking bytecode
(`OP_UTXOBYTECODE`, 23-byte P2SH pattern) carries the expected
`hash160` of the sibling shard — ~8 ops and 20 pinned bytes per side.
Spedn cannot emit these; hand-assemble with `ecash-lib` `Script` (the
`src/covenant/opcodes.ts` codepoints exist for exactly this) and splice
with the Spedn-compiled body. Soundness argument: both shards pin the
full output set, but only C derives the state — any witness `(d, t) ≠`
C's derived `(d', t')` makes the two shards' `hashOutputs` disagree, so
the tx cannot satisfy both. No shard trusts the prover for state.

## 5. Stale batons: tick txs

If `newDay − tipDay > K`, the baton is unmintable until advanced. Anyone
may submit fee-only **tick** txs (both shards, no PoW, no mint), each
advancing ≤ `K` days. Cost lands on the next miner as part of mining
cost; with any real mining cadence (≥ 1 remint per 3 days at `K = 3`)
ticks never trigger in practice.

## 6. What multi-input does NOT fix (unchanged cheat surfaces)

- **Miner-picked locktime.** As today, the miner chooses `locktime ≤ MTP`;
  mining at `k = 0` freezes the clock. Production still needs the MTP-floor
  / active-miner conventions documented in `alp-empp-difficulty-state.md` —
  not enforceable on-chain (no MTP introspection).
- **Paid fast-forward griefing.** Ticks cost fees, so raising difficulty on
  others is expensive and self-harming, but possible. Same class as today's
  free wall-clock drift, now priced.
- **Shard liveness/dust.** Two shard UTXOs must stay funded; tick fees are
  small (2-in-4-out P2SH, no PoW data) under the miner-pays-XEC posture.
- Difficulty is monotone (δ < 1, time monotone) — no downward adjustment,
  same as the bit-shift design.

## 7. Alternatives considered

| Alternative | Fate |
|---|---|
| Full 256-bit target, limb arithmetic across 4–6 inputs | Rejected: carry chains must round-trip through outputs; 6 shards of machinery for precision GLotus does not need (compact 32-bit is already the dogfood direction) |
| Verify-instead-of-compute (`t'·100000 ≤ t·99918 < (t'+1)·100000`) | No savings: two 64-bit multiplies ≈ same cost as computing directly |
| Per-era tables (8-slot mantissa) | Measured infeasible in one script (243 ops / 546 B); across shards it only buys intra-era granularity, not the daily δ |
| BCH-2026 loops/bitops | Not on eCash; irrelevant |

## 8. Recommended next step

1. Chipnet: confirm 5-byte script numbers + `ADD`/`DIV` ≥ 2^31, and
   `OP_TXINPUTCOUNT` / `OP_UTXOBYTECODE` acceptance.
2. Prototype `K = 3` two-shard covenant (Spedn bodies + hand-assembled
   introspection splice), balanced per §4; extend `measure-glotus-mantissa.ts`
   with the shard variants.
3. Dogfood as a new `dGLOTUS` genesis (own clock, as today) — never a
   WLOTUS change.
