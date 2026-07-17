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

**Incubation PoW token `mWLPOW`** — always 100/remint @ 0 decimals,
~$0.00001/token (~1/1000 of future `WLOTUS` @ ~$0.01). See [docs/ECONOMICS.md](./docs/ECONOMICS.md).

```bash
npm run create-pow-token
npm run mine-once
```

```
contracts/          # Spedn PoW remint covenant (BIP143 preimage)
docs/               # Consensus / product spec + research
src/params/         # Consensus constants (Moore, batons, …)
src/lib/            # Moore math
src/covenant/       # Contract loader, PoW mine, output templates
src/genesis/        # ALP GENESIS tooling
src/miner/          # PoW remint miner (Chronik + ecash-lib)
scripts/            # create-pow-token, mine-once, …
tests/              # Unit tests
deployments/        # Live mainnet records
```

## Quick start

```bash
npm install
npm test
npm run moore -- --days 365   # print M after 365 wall-days
```

## Create the low-difficulty test token (mainnet)

Target economics: **~$0.000001 / token** now; later raise PoW toward **~$0.01 / token**.

Chronik fleet: `chronik.e.cash`, `xec.paybutton.org`, `chronik.pay2stay.com/xec`.

```bash
npm run new-wallet            # writes .env + deployments/pending-funding.json
# Send ≥ 200 XEC to the printed address
npm run create-test-token     # ALP GENESIS → deployments/mainnet-test-token.json
```

Ticker for this dogfood deployment: **`mWLPOW`**. Keep **`WLOTUS`** for the later ~$0.01 launch
(1000:1 energy peg). See [docs/ECONOMICS.md](./docs/ECONOMICS.md).

```bash
npm run create-pow-token   # mWLPOW genesis + handoff to covenant P2SH
npm run mine-once          # one permissionless remint (100 tokens)
```

## License

MIT
