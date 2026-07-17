# Economics — mWLPOW → WLOTUS

## Ritual loop

| Action | Meaning | Supply |
|--------|---------|--------|
| **Burn** | Sacrifice / vàng mã offering | Destroys tokens |
| **Remint** | Pure PoW rebirth | Creates tokens |

Burn does **not** cancel remint. Burns tighten float → support price → incentivise miners to remint again.

## Incubation: mWLPOW

| Knob | Value |
|------|-------|
| Ticker | `mWLPOW` |
| Decimals | **0** (whole tokens) |
| Tokens / remint | **Always 100** (fixed) |
| PoW | Leading zero bytes on `hash256(preimage ‖ nonce)` |
| Genesis difficulty | **1** leading zero byte (~1/256) |
| Target market price | **~$0.00001 / token** (~$0.001 / remint) |
| vs WLOTUS | **~1/1000** energy / price |

Moore / Koomey (`δ = 99918/100000`, ~2.3y half-life) adjusts **required work**, not the 100-token mint. Incubation genesis uses **fixed** cheap difficulty; the same δ is in `src/lib/moore.ts` for the work schedule.

## Production: WLOTUS (later)

| Knob | Value |
|------|-------|
| Ticker | `WLOTUS` |
| Tokens / remint | **Always 100** |
| Target market price | **~$0.01 / token** (~$1 / remint) |
| Difficulty | ~**1000×** mWLPOW genesis work |

`$0.01` is a **market** target (energy + fees + hardware + miner margin), not a USD oracle.

## Energy peg / conversion

```
1000 mWLPOW  ≈  1 WLOTUS
```

for circulating and burned balances when the app matures.

## Elasticity

```
coins/time ≈ N_batons × (hashrate / hashes_per_solution) × 100
```

Many remints per eCash block, N ≥ 2 batons, no Mist 1-mint/block CLTV.

## Miner note

The remint covenant commits to exactly **3 outputs** (mint OP_RETURN + miner P2PKH + baton P2SH). Excess fuel is fee — `mine-once` splits a ~30 XEC fuel UTXO first.
