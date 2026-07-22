# WLotus web — Offer / burn

Minimal mobile-first UI for **WLOTUS** / **dWLOTUS**. No browser wallet yet — remint via mint-api.

Flow: device PoW → mint API remint (**108** → **1** miner + **107** temple) → soft pray hold → **burn 1** (memorial + dana).

## Local

```bash
# terminal 1 — mint API (needs GENESIS_SK_HEX + deployment JSON)
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
broadcasts **as soon as** a nonce is found (tip race). The UI then shows
**Offering…** (`Đang dâng hoa…`) until the soft floor elapses, then memorial burn.
Cancel in that window skips the burn; the desk keeps the miner atom.

```bash
VITE_MIN_PRAY_SECONDS=60   # set 0 to disable
```

Or in DevTools: `localStorage.setItem('wlotus.minPraySeconds', '60')`.

**UX labels:** mining → Finding a lotus… · soft wait / burn → Offering…

API: `POST /api/submit` returns `burnPending` + one-time `burnToken` → soft wait →
`POST /api/burn` with that token. Cancel/abandon also requires `burnToken`.

### WebGPU Offer mining (launch)

```bash
VITE_EXPERIMENTAL_POW=1 npm run web
# optional: VITE_POW_BACKEND=webgpu|multi-worker|auto
```

Bake `VITE_EXPERIMENTAL_POW=1` in Actions for test/prod builds. Fallback: multi-worker → single CPU.

## Create test / prod token

```bash
TICKER=dWLOTUS TEMPLE_ADDRESS=ecash:p… BATONS=28 npm run create-wlotus-token
TEMPLE_ADDRESS=ecash:p… BATONS=28 npm run create-wlotus-token   # prod WLOTUS
```

See [docs/VISION.md](../../docs/VISION.md) and [docs/ECONOMICS_WLOTUS_GLOTUS.md](../../docs/ECONOMICS_WLOTUS_GLOTUS.md).
