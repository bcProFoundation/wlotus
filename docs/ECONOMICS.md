# Economics — mWLPOW → WLOTUS

## Ritual loop

| Action | Meaning | Supply |
|--------|---------|--------|
| **Burn** | Sacrifice / vàng mã offering | Destroys tokens |
| **Remint** | Pure PoW rebirth | Creates tokens |

Burn does **not** cancel remint. Burns tighten float → support price → incentivise miners to remint again.

---

## Work required to mint 100 mWLPOW

PoW check (covenant):

```
hash256(bip143_preimage ‖ nonce)  has  D  leading zero bytes
```

| Quantity | Incubation (live mWLPOW) |
|----------|--------------------------|
| `D` (leading zero **bytes**) | **1** |
| Success probability per hash | \(1 / 256^{D}\) = **1/256** |
| **Expected hashes / remint** | **\(256^{D}\) ≈ 256** |
| Tokens minted | **100** (fixed) |
| Expected hashes / token | **≈ 2.56** |
| Hash function | Bitcoin-style **double SHA-256** (`hash256`) |
| Nonce | 4 bytes (miner increments until PoW hits) |

Observed dogfood remints were on that order (e.g. **210** attempts for the first mainnet remint).

Each extra leading zero **byte** multiplies expected work by **256**.  
Each extra leading zero **bit** (future Moore schedule) multiplies work by **2**.

```
E[hashes] = 256^D_bytes
          = 2^(8 · D_bytes)
```

---

## Energy cost (PoW only)

At **D = 1**, expected work is only hundreds of SHA-256d hashes — **negligible** on a laptop.

| Assumption | Ballpark |
|------------|----------|
| ~1 µJ / SHA-256d (order-of-magnitude CPU) | generous upper-ish consumer estimate |
| Energy / remint | \(256 × 10^{-6}\) J ≈ **0.00026 J** |
| @ $0.15 / kWh | **≪ $10^{-10}** USD |

So **pure hash energy does not set the incubation price**. The binding costs are:

1. **eCash remint fee** (fuel UTXO; covenant has no change output — use a small ~30 XEC fuel split)
2. Amortised miner time / ops
3. Later: hardware + margin when `D` is raised for WLOTUS

Typical remint fee today (after fuel split): on the order of **~10–30 XEC** (~**$10^{-4}`–`$10^{-3}`** USD at mid‑2026 XEC prices) — still small vs the **~$0.001 / remint** market target, so incubation stays “almost free” to mine.

---

## Price targets (market, not oracle)

These are **intended market prices** (energy + fees + hardware subsidy + miner profit), **not** an on-chain USD peg.

| | Per token | Per remint (100 tokens) |
|--|--|--|
| **mWLPOW** (incubation) | **~$0.00001** | **~$0.001** |
| **WLOTUS** (later) | **~$0.01** | **~$1** |
| Ratio | **1000×** | **1000×** |

### Incubation breakdown (conceptual)

| Component | Role at D=1 |
|-----------|-------------|
| PoW joules | ≈ 0 (noise) |
| XEC network fee | Dominant *on-chain* cash cost today |
| Hardware / miner margin | Intentionally tiny so everyone can mine & burn |
| **Target all-in** | **~$0.00001 / mWLPOW** |

### Production (WLOTUS) intent

Raise PoW so expected hashes are ~**1000×** mWLPOW genesis work (e.g. toward **~2 leading zero bytes** ≈ 65536 hashes, or a finer bit/target scheme), so that **PoW energy + hardware + margin** can support a **~$0.01 / token** market without relying on fees alone.

Moore / Koomey (`δ = 99918/100000`, ~2.3y half-life) then adjusts **required work** over time so real mining cost tracks efficiency gains — **mint size stays 100**.

---

## Incubation: mWLPOW (live)

| Knob | Value |
|------|-------|
| Ticker | `mWLPOW` |
| Token ID | `cc2ee91c0ed43da44fc115283ec4b5e523da9f1549f27eacc06b0a3e7dc1494f` |
| Decimals | **0** |
| Tokens / remint | **Always 100** |
| PoW | `D = 1` leading zero byte → **E[hashes] ≈ 256** |
| Target market price | **~$0.00001 / token** |
| vs WLOTUS | **~1/1000** energy / price |

## Production: WLOTUS (later)

| Knob | Value |
|------|-------|
| Ticker | `WLOTUS` |
| Tokens / remint | **Always 100** |
| Target market price | **~$0.01 / token** (~$1 / remint) |
| Difficulty | ~**1000×** mWLPOW genesis expected hashes |

## Energy peg / conversion

```
1000 mWLPOW  ≈  1 WLOTUS
```

for circulating and burned balances when the app matures (same fixed-100 + Moore-on-work family).

## Elasticity

```
coins/time ≈ N_batons × (hashrate / E[hashes_per_solution]) × 100
```

With `E[hashes_per_solution] = 256` at incubation, issuance rate scales linearly with hashrate across **N ≥ 2** batons (no Mist 1-mint/block CLTV).

## Miner note

The remint covenant commits to exactly **3 outputs** (mint OP_RETURN + miner P2PKH + baton P2SH). Excess fuel is fee — `mine-once` splits a ~30 XEC fuel UTXO first.
