# Architecture

Product meaning (memorial + dana): **[VISION.md](./VISION.md)**.

## Flow

```
GENESIS (ALP)
  └─ creates N PoW mint batons → each locked to remint covenant P2SH
        │
        ├─ miner solves PoW on baton i
        │     outputs: ALP MINT M(k) → miner
        │              baton → next covenant state (same rules)
        │
        └─ devotee acquires WLOTUS → alpBurn
              ├── memorial dedication (for the dead — sen trắng)
              └── dana: wealth destroyed for the community (not sold like vàng mã)
```

## Why multi-baton

A single ALP mint baton tip is **serial**: only one spend wins at a time.  
`N` independent PoW batons allow **true parallel** remints in one eCash block, so:

`coins/time ≈ N × (hashrate/N) / work_per_solution × M(k) ≈ hashrate × M(k) / work`

**Genesis must use the ALP maximum (`POW_BATON_COUNT` = 28).** Batons cannot be added later.
The mint desk PoC serves **2 tips** (live dPRAYER) with an open multi-client race and
**one fee UTXO per tip**; raise served tips toward 28 without a new token.

### Concurrent miners / remints per minute

**One baton = one serial tip race.** Many phones may hash the same tip; only **one remint wins** per baton per cycle. Soft pray (`VITE_MIN_PRAY_SECONDS`) runs **after** remint and does **not** hold the baton.

\[
R_{\text{wins/min}} \approx \frac{N_{\text{served}}}{T_{\text{cycle}}} \times 60
\quad\text{where}\quad
T_{\text{cycle}} \approx T_{\text{PoW}} + T_{\text{broadcast+tip sync}}
\]

At genesis (wLotus base **0**, PoW instant; cycle ≈ broadcast+tip sync): \(T_{\text{net}}\sim 2\text{–}7\,\text{s}\) → \(T_{\text{cycle}}\sim 5\text{–}10\,\text{s}\) still. Later Moore eras add \(T_{\text{PoW}}\).

| Setup | \(N\) | ~Wins / min | Concurrent hashers |
|-------|------:|------------:|--------------------|
| Desk PoC / **launch** | **1–2** | **~6–24** | Start with **1** tip to bound fees; raise toward 28 if demand warrants |
| Full desk / permissionless | **28** | **~170–340** | Same formula; load-balance across tips |
| Soft-pray myth (60 s holds baton) | — | **wrong** | Soft pray does not serialize remints |

Desk extras (not chain physics): `MINT_MAX_OPEN_CHALLENGES` (default **32** open jobs), `MINT_MAX_OFFERS_PER_DAY` (**20**/installId), in-process `withChainLock` (serializes challenge/submit/burn on one mint-api until scaled). Launch serves **1** tip; raise `MINT_SERVING_TIP_COUNT` toward **28** if demand warrants.

Atoms minted/min ≈ \(108 \times R\) (1 miner + 107 temple). Moore period (**500 vs 840**) does **not** change this short-term capacity — only long-term PoW wall time.

## Covenant responsibilities

For each remint spend, Script must enforce:

1. PoW: `hash256(preimage || nonce)` has `POW_LEADING_ZERO_BYTES` leading zero bytes  
2. Mint atoms equal Moore-adjusted `M(k)` from host time  
3. Outputs include valid ALP MINT section for this `tokenId`  
4. Exactly one mint baton returned to the covenant (P2SH with updated state if any)  
5. No destruction of PoW baton set cardinality

ALP validity is still indexer-enforced (Chronik); the covenant must emit **byte-exact** MINT pushdata.

## Components

| Path | Role |
|------|------|
| `contracts/WlotusRemint.cash` | CashScript draft of remint covenant |
| `src/params/consensus.ts` | Shared constants |
| `src/lib/moore.ts` | `M(k)` integer math |
| `src/genesis/` | Build GENESIS + hand off `N` batons |
| `src/miner/` | Watch Chronik baton UTXOs, mine, broadcast |

## Networks

Target order: **chipnet → test → mainnet**.  
Do not mainnet-genesis until Script is reviewed and `D` / `M₀` / `N` are tuned.
