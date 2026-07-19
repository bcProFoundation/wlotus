# Mint API — dual-mint Prayer offers

Server path for mobile-first offerings (no browser wallet yet):

1. MooreTip remint (**2** atoms) — server pays XEC fee + PoW  
2. Burn **1** with memorial EMPP  
3. Keep **1** on desk wallet (`GENESIS_SK_HEX` / `MINT_SK_HEX`)

Rate limit: **2 offers / UTC day / installId**.

## Run

From repo root (needs `.env` with funded mint key + dual-mint deployment):

```bash
npm run mint-api
# → http://127.0.0.1:8787
```

## Endpoints

| Method | Path | Body / query |
|--------|------|----------------|
| GET | `/health` | — |
| GET | `/api/status?installId=` | remainingToday |
| POST | `/api/offer` | `{ installId, note? }` |

On Contabo, nginx proxies `/api/` → `:8787` (see `deploy/contabo/nginx-wlotus-test.conf`).
