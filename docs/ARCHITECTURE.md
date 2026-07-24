# Architecture

Product meaning (memorial + dana): **[VISION.md](./VISION.md)**.  
Altar / on-chain memorial policy: **[ALTAR.md](./ALTAR.md)** (star fragments, separator fields, no WLotus off-chain).  
Economics: **[ECONOMICS_WLOTUS_GLOTUS.md](./ECONOMICS_WLOTUS_GLOTUS.md)**.

## Flow

```
GENESIS (ALP)
  └─ creates N PoW mint batons → each locked to remint covenant P2SH
        │
        ├─ miner solves PoW on baton i
        │     outputs: ALP MINT 108 → 1 miner + 107 temple
        │              baton → next covenant state (same rules)
        │
        └─ devotee acquires WLOTUS → alpBurn
              ├── memorial dedication (for the dead — sen trắng)
              └── dana: wealth destroyed for the community
```

## Why multi-baton

A single ALP mint baton tip is **serial**: only one spend wins at a time.  
`N` independent PoW batons allow **true parallel** remints in one eCash block.

**Genesis must use the ALP maximum (`POW_BATON_COUNT` = 28).** Batons cannot be added later.  
The mint desk serves **1 tip** at launch (`MINT_SERVING_TIP_COUNT=1`) with an open multi-client race and **one fee UTXO per tip**; raise served tips toward 28 without a new token.

### Concurrent miners / remints per minute

**One baton = one serial tip race.** Many devices may hash the same tip; only **one remint wins** per baton per cycle. Soft pray (`VITE_MIN_PRAY_SECONDS`) runs **after** remint and does **not** hold the baton.

\[
R_{\text{wins/min}} \approx \frac{N_{\text{served}}}{T_{\text{cycle}}} \times 60
\quad\text{where}\quad
T_{\text{cycle}} \approx T_{\text{PoW}} + T_{\text{broadcast+tip sync}}
\]

At genesis (wLotus base **0**, PoW instant; cycle ≈ broadcast+tip sync): \(T_{\text{net}}\sim 2\text{–}7\,\text{s}\) → \(T_{\text{cycle}}\sim 5\text{–}10\,\text{s}\). Later Moore eras add \(T_{\text{PoW}}\).

| Setup | \(N\) | ~Wins / min | Notes |
|-------|------:|------------:|-------|
| **Launch desk** | **1** | **~6–12** | Bound XEC fees; raise toward 28 if demand warrants |
| Full desk / permissionless | **28** | **~170–340** | Load-balance across tips |
| Soft-pray myth (108 s holds baton) | — | **wrong** | Soft pray does not serialize remints |

Desk extras: `MINT_MAX_OPEN_CHALLENGES` (default **32**), `MINT_MAX_OFFERS_PER_DAY` (**20**/installId), in-process chain lock on one mint-api until scaled.

Atoms minted/min ≈ \(108 \times R\) (1 miner + 107 temple). Moore period does **not** change short-term capacity — only long-term PoW wall time.

## Covenant responsibilities

For each remint spend, Script must enforce:

1. PoW: `hash256(preimage || nonce)` meets required zero bits (Moore calendar)
2. Mint atoms = **108** with **1** miner + **107** temple outputs
3. Outputs include valid ALP MINT section for this `tokenId`
4. Exactly one mint baton returned to the covenant (hard next-P2SH)
5. `locktime ≥ tipLocktime`; bits ≤ **128**

ALP validity is still indexer-enforced (Chronik); the covenant must emit **byte-exact** MINT pushdata.

## Components

| Path | Role |
|------|------|
| `contracts/` | Spedn remint covenants (`WlotusPowRemintMooreTipTemple`) |
| `src/params/consensus.ts` | Shared constants |
| `src/lib/moore.ts` | Moore bit schedule |
| `apps/mint-api/` | Sponsored challenge / remint / burn desk |
| `apps/web/` | Offerings SPA |
| `scripts/create-wlotus-token.ts` | Genesis (`WLOTUS` / `dWLOTUS`) |

## Networks

Target: **mainnet** for dryrun (`dWLOTUS`) and prod (`WLOTUS`).  
Do not ship live **WLOTUS** genesis until temple P2SH, mint.env, and nginx are healthy — [deploy/contabo/PROD.md](../deploy/contabo/PROD.md).
