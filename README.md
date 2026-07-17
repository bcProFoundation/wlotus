# WLotus

**White Lotus (WLOTUS)** — Ergon-like ritual ALP token on eCash with permissionless PoW remint.

This repository holds the **covenant, parameters, genesis tooling, and remint miner**.  
Website / temple UI live in a separate repo.

## Design (short)

| Piece | Choice |
|-------|--------|
| Host | eCash (XEC) |
| Token | ALP (`SLP2` / eMPP) |
| Issuance | Fixed PoW difficulty; atoms/remint with Moore decay; **many remints/block** |
| Parallelism | **`N ≥ 2` mint batons** (true concurrent remints) |
| Moore factor | Ergon post-fix **`99918/100000`** per wall-day (~2.3y half-life) |
| Supply cap | None — PoW batons never die |
| Burn | Intentional ALP burn (temple / vàng mã offerings) — app layer |

Issuance elasticity comes from **remint frequency ∝ hashrate**, not from `mint ∝ D`.  
Do **not** use Mist-style 1-mint-per-host-block CLTV.

See [docs/SPEC.md](./docs/SPEC.md) and [docs/PROPOSAL.md](./docs/PROPOSAL.md).

## Status

Scaffold for covenant + miner (migrated from the temporary
`eminer` branch `cursor/wlotus-scaffold-d6bb`). Chipnet genesis and
audited Script are TODO. See [docs/STATUS.md](./docs/STATUS.md).

## Layout

```
contracts/          # CashScript remint covenant
docs/               # Consensus / product spec + research
src/params/         # Consensus constants (Moore, batons, …)
src/lib/            # Moore math, ALP helpers
src/genesis/        # GENESIS + baton handoff tooling
src/miner/          # PoW remint miner (Chronik + ecash-lib)
scripts/            # Utilities
tests/              # Unit tests
```

## Quick start

```bash
npm install
npm test
npm run moore -- --days 365   # print M after 365 wall-days
```

## License

MIT
