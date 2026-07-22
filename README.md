# wLotus

**wLotus** (ticker **WLOTUS**) — burnable white lotus on eCash: offered **in memory of the dead**, and as **dana** to the living (real wealth sacrificed, not paper sold).

Companion economic token: **Golden Lotus** (ticker **GLOTUS**) — permissionless remint, premine, event burns. See [docs/ECONOMICS_WLOTUS_GLOTUS.md](./docs/ECONOMICS_WLOTUS_GLOTUS.md).

This repository holds the **covenant, remint miner, mint-api, and offerings app**.

## Design (short)

| Piece | Choice |
|-------|--------|
| Meaning | Memorial (hoa sen trắng) + dana — [docs/VISION.md](./docs/VISION.md) |
| Host | eCash (XEC) |
| Token | ALP (`SLP2` / eMPP) |
| Issuance | MooreTip PoW remint — mint **108** → **1** miner + **107** temple (mala) |
| Burn | Intentional ALP burn — `apps/web` (XEC fees; postage later) |
| Clock | Base **0** bits; +1 bit / **500** days; hard sunset at **128** |

## Status

| Environment | URL / notes |
|-------------|-------------|
| **Test** | https://test.wlotus.org — ticker **dWLOTUS** |
| **Prod** | https://wlotus.org — live **WLOTUS** (tag releases) |
| **Local** | `npm run mint-api` + `npm run web` |

Docs: [VISION](./docs/VISION.md) · [ECONOMICS](./docs/ECONOMICS_WLOTUS_GLOTUS.md) · [SPEC](./docs/SPEC.md) · [STATUS](./docs/STATUS.md) · [CLOCK](./docs/CLOCK.md)

Deploy: [test Contabo](./deploy/contabo/README.md) · [prod Contabo](./deploy/contabo/PROD.md)

```
apps/web/           # Offerings SPA
apps/mint-api/      # Sponsored remint + burn desk
deploy/contabo/     # Test + prod VM bootstrap + nginx
.github/workflows/  # Deploy web (test) + Deploy web (prod)
contracts/          # Spedn PoW remint covenants
docs/               # Spec + research
src/                # Params, covenant loaders, miners
scripts/            # create-wlotus-token, mine-dryrun-once, …
deployments/        # Mainnet records
```

## Quick start

```bash
npm install
npm test
npm run moore -- --days 365   # print required bits after 365 wall-days
```

### Create test / prod token

```bash
# Test dryrun (same covenant as prod; ticker only differs)
TICKER=dWLOTUS TEMPLE_ADDRESS=ecash:p… BATONS=28 npm run create-wlotus-token
# or: npm run create-dryrun-wlotus

# Live prod (default ticker WLOTUS)
TEMPLE_ADDRESS=ecash:p… BATONS=28 npm run create-wlotus-token
# or: npm run create-prod-token

BATON_INDEX=0 TIER=wlotus npm run mine-dryrun-once
```

## License

MIT
