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
The mint desk MVP may **serve one tip** with an open multi-client race; more tips come later.

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
