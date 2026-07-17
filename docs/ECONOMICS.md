# Economics — mWLOTUS → WLOTUS

## Ritual loop

| Action | Meaning | Supply |
|--------|---------|--------|
| **Burn** | Sacrifice / vàng mã offering | Destroys tokens |
| **Remint** | Pure PoW rebirth | Creates tokens |

Burn does **not** cancel remint. Burns tighten float → support price → incentivise miners to remint again.

## Incubation: mWLOTUS

| Knob | Value |
|------|-------|
| Ticker | `mWLOTUS` (milli White Lotus) |
| Decimals | **2** |
| Tokens / remint | **Always 100.00** (fixed) |
| PoW | Leading zero bytes on `hash256(preimage ‖ nonce)` |
| Genesis difficulty | **1** leading zero byte (~1/256) — anyone can mine |
| Target market price | **~$0.00001 / token** (~$0.001 / remint) |
| vs WLOTUS | **~1/1000** energy / price |

Moore / Koomey (`δ = 99918/100000`, ~2.3y half-life) adjusts **required work**, not the 100-token mint. Incubation genesis uses a **fixed** cheap difficulty so the network can be dogfooded immediately; the same δ is used in `src/lib/moore.ts` to schedule how work should grow (library + future stateful covenant). Full on-chain Moore-on-difficulty (time-derived or baton-state) lands with the WLOTUS upgrade path — Script cannot read “now”, so a naïve locktime day-index is cheatable with old timestamps.

## Production: WLOTUS (later)

| Knob | Value |
|------|-------|
| Ticker | `WLOTUS` |
| Tokens / remint | **Always 100.00** |
| Target market price | **~$0.01 / token** (~$1 / remint) |
| Difficulty | ~**1000×** mWLOTUS genesis work (retune `D₀`; then Moore on work) |

`$0.01` is a **market** target: energy + XEC fees + hardware subsidy + miner profit — not a pure joule oracle.

## Energy peg / conversion

Because both tokens use the same fixed-100 + Moore-on-work family:

```
1000 mWLOTUS  ≈  1 WLOTUS
```

for **circulating and burned** balances when the app matures (conversion / memorial ledger). Exact redemption UX is app-layer; consensus only needs compatible issuance physics.

## Elasticity

```
coins/time ≈ N_batons × (hashrate / hashes_per_solution) × 100
```

Many remints per eCash block, N ≥ 2 batons, no Mist 1-mint/block CLTV.
