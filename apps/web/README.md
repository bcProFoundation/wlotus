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

### Min prayer wait

Official Offer uses **one CPU Web Worker**. If PoW finds a nonce early, the
client waits until at least ~1 minute of wall time has passed before submit
(configurable):

```bash
VITE_MIN_PRAY_MS=60000   # default; set 0 to disable
```

Or in DevTools: `localStorage.setItem('wlotus.minPrayMs', '60000')`.

### Experimental phone PoW (research only)

Not used by the Offer button. Modules under `src/lib/pow/` remain for local
measurement — see
[docs/research/phone-webgpu-wasm-mining.md](../../docs/research/phone-webgpu-wasm-mining.md).

## Create dual-mint Prayer token

```bash
TIER=prayer npm run create-dryrun-token   # mintAtoms=2
```

See [docs/ECONOMICS_PRAYER.md](../../docs/ECONOMICS_PRAYER.md) and [docs/VISION.md](../../docs/VISION.md).
