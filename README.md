# WLotus

**WLotus** — burnable white lotus on eCash: offered **in memory of the dead**, and as **dana** to the living (real wealth sacrificed, not paper sold).

Ergon-like ritual ALP token with permissionless PoW remint. This repository holds the **covenant, remint miner, and offerings app**.

## Design (short)

| Piece | Choice |
|-------|--------|
| Meaning | Memorial (hoa sen trắng) + dana — see [docs/VISION.md](./docs/VISION.md) |
| Host | eCash (XEC) |
| Token | ALP (`SLP2` / eMPP) |
| Issuance | MooreTip PoW remint (calendar D + tipLocktime + hard next-P2SH) |
| Burn | Intentional ALP burn — `apps/web` (XEC fees; postage later) |

See [docs/VISION.md](./docs/VISION.md), [docs/SPEC.md](./docs/SPEC.md), and [docs/STATUS.md](./docs/STATUS.md).

## Status

Production **Prayer dryrun** is live. Offerings UI:

| Environment | URL / command |
|-------------|----------------|
| **Test (deployed)** | https://test.wlotus.org |
| **Local dev** | `npm run web` → http://localhost:5173 |

Deploy guide (local vs VM vs CI): [deploy/contabo/README.md](./deploy/contabo/README.md)

```
apps/web/           # WLotus offerings (migrated from Lotus Temple UX)
deploy/contabo/     # Test VM bootstrap + nginx (CI → Contabo)
.github/workflows/  # Deploy web (test)
contracts/          # Spedn PoW remint covenants
docs/               # Spec + research
src/                # Params, covenant loaders, miners
scripts/            # create-dryrun-token, mine-dryrun-once, …
deployments/        # Live mainnet records
```

Test deploy: [deploy/contabo/README.md](./deploy/contabo/README.md)

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
