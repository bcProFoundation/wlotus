# WLotus web — Prayer offering (dual mint)

Minimal mobile-first UI: one **Prayer** offering, no browser wallet yet.

Flow: device → mint API → remint **2** dPRAYER → **burn 1** (memorial) → **keep 1** (desk).

## Local

```bash
# terminal 1 — mint API (needs GENESIS_SK_HEX + dual-mint deployment)
npm run mint-api

# terminal 2 — web UI
npm run web
```

Open http://localhost:5173 — Vite proxies `/api` → `:8787`.

## Env

`apps/web/.env.example` · root `.env` for `GENESIS_SK_HEX`.

## Create dual-mint Prayer token

```bash
TIER=prayer npm run create-dryrun-token   # mintAtoms=2
```

See [docs/ECONOMICS_PRAYER.md](../../docs/ECONOMICS_PRAYER.md) and [docs/VISION.md](../../docs/VISION.md).
