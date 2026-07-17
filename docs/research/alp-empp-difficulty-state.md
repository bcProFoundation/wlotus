# ALP / EMPP for fine-grained PoW difficulty

**Question:** Can ALP “extra payload” / EMPP attach difficulty so Moore-on-work is finer than leading-zero **bytes** (×256)?

**Short answer:** ALP mint batons **cannot** carry state. EMPP **can** advertise difficulty beside `MINT`, but that alone is **not** consensus continuity. Enforceable fine-grained D on eCash needs **Mist-style stateful redeem** (and/or baton sats), with EMPP as an optional mirror.

---

## What ALP can carry

| Mechanism | Remint-usable state? | Notes |
|-----------|----------------------|-------|
| Mint baton UTXO | **No** | `tokenId`, `atoms=0`, `isMintBaton` only — no CashTokens-style commitment |
| ALP `MINT` section | **No** | Fixed layout; trailing bytes → invalid |
| ALP GENESIS `data` / `authPubkey` | **No** (for remints) | Genesis metadata only |
| **eMPP second push** | **Yes (bytes in this tx)** | Custom LOKAD next to `SLP2` MINT; ignored by ALP coloring |

Live mWLPOW OP_RETURN is a single EMPP push (`alpMint` only). Policy headroom (~223 B) leaves ~**170 B** for another push.

---

## Why EMPP-alone is not enough

BIP143 covenants only see **this** preimage (`hashOutputs`, input value, `scriptCode`, …).

- Difficulty in **this** EMPP can be forced to match params for **this** remint (rebuild OP_RETURN in Script).
- The **next** remint cannot read the previous EMPP unless that state was copied into:
  - the **next P2SH redeem** (constructor params), and/or
  - the **next baton satoshi value**.

So EMPP without stateful redeem is a **label**, not Ergon continuity.

---

## Design options (ranked)

### 1. Stateful redeem (recommended)

On remint:

1. PoW vs **current** `zeroBits` / compact `target` in redeem.
2. Compute next (Moore): e.g. `+1 bit` every ~**845** days, or daily `target' = floor(target · 99918/100000)` on a multi-limb target.
3. `hashOutputs` requires baton → `P2SH(hash160(redeem'))` with updated params.

| Pros | Cons |
|------|------|
| True on-chain continuity | P2SH address changes per update; track tip per baton |
| Bit or target precision (Ergon-like) | Redeem size / 520-byte push discipline |
| Matches Mist | Multi-baton tips must stay aligned (prefer **deterministic** schedule from genesis clock) |

### 2. Baton satoshis (Mist v2 hybrid)

Encode tier / packed target in baton value; next spend reads BIP143 input value.

Good for coarse ×2 steps; limited range; must strictly gate transitions.

### 3. EMPP `WLDF` section (mirror only)

Example layout:

```
WLDF | ver:u8 | zeroBits:u16 | dayIndex:u32 | target:bytes?
```

Covenant requires EMPP bytes == redeem (or sat) state. Useful for Chronik/miners/Cashtab; **not** sole authority.

### 4. Separate state UTXO

Co-spend state P2SH + baton. Feasible, more fees/races; little gain over (1).

---

## Recommended path for mWLPOW → WLOTUS

1. Keep ALP `MINT` dumb: **always 100**, one baton returned.
2. Move PoW from **byte** zeros to **bit** or **compact target** compare.
3. Enforce Moore in Script via **stateful redeem** (deterministic day index from locktime/height policy ≈ Ergon δ).
4. Optionally emit EMPP `WLDF` mirroring that state for indexers.
5. New genesis/handoff required — live mWLPOW tip cannot grow state without migration.

Incubation today: **fixed `D = 1` byte**, mint **100**, Moore only in `src/lib/moore.ts` (off-chain).

---

## Cheat surfaces if EMPP is treated as truth

- Announce hard D in EMPP, remint later at easy D (no continuity).
- Soft off-chain schedule while covenant stays at genesis D.
- Independent DAA per baton tip → unfair parallel issuance (prefer shared genesis clock).

---

## Minimal implementation sketch (future)

1. Spec LOKAD `WLDF` fixed layout.
2. `emppScript([alpMint(...), wldf(...)])` + Spedn `hashOutputs` template.
3. Same revision: baton → updated redeem (or sats); bit/target PoW check.
4. Property-test vs `moore.ts` (~845 days/bit or daily target δ).
5. Chipnet: measure redeem size vs 520; Chronik still colors MINT with extra EMPP.

**Bottom line:** EMPP is the right **announcement** channel; ALP batons are not a state channel. Fine-grained Ergon-like difficulty = **stateful covenant params (± sats)**, EMPP optional.
