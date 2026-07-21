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

### Why soft pray wait (product intent)

Anti-farming is **on-chain economics** (wLotus **1/107** mala + XEC fees): temple-sponsored
Offer beats commercial fee-paying miners even when electricity ≈ 0. Token hashrate does
**not** secure WLOTUS — eCash does. See
[docs/ECONOMICS_WLOTUS_GLOTUS.md](../../docs/ECONOMICS_WLOTUS_GLOTUS.md) § *Product intent*.

What the soft timer adds is **attention**: PoW is a presence gate. Remint
broadcasts **as soon as** a nonce is found (tip race). The client then holds
~1 minute before the **memorial burn**. Cancel in that window skips the burn;
the desk keeps the miner atom.

```bash
VITE_MIN_PRAY_MS=60000   # default; set 0 to disable
```

Or in DevTools: `localStorage.setItem('wlotus.minPrayMs', '60000')`.

API: `POST /api/submit` returns `burnPending` + one-time `burnToken` → soft wait →
`POST /api/burn` with that token. Cancel/abandon also requires `burnToken` (remintTxid
alone is public on-chain and insufficient).

Official Offer mining path: **one CPU Web Worker** for now (fairer early participation at
~24 bits). Experimental WebGPU/multi-worker code remains for research only.

### Experimental phone PoW (research only)

Not used by the Offer button. Modules under `src/lib/pow/` remain for local
measurement — see
[docs/research/phone-webgpu-wasm-mining.md](../../docs/research/phone-webgpu-wasm-mining.md).

## Create dual-mint Prayer token

```bash
TIER=prayer npm run create-dryrun-token   # mintAtoms=2
```

See [docs/ECONOMICS_PRAYER.md](../../docs/ECONOMICS_PRAYER.md) and [docs/VISION.md](../../docs/VISION.md).
