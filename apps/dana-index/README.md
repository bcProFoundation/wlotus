# DANA memorial index

Chronik-backed public history of wLotus / dWLOTUS **DANA** memorial burns
(all clients — not localStorage).

This service is a **read-only mirror of on-chain data**. It is not an off-chain
content store. WLotus altar policy: [docs/ALTAR.md](../../docs/ALTAR.md)
(star fragments → original burn; richer fields via separator encoding later).

## Run locally

```bash
TOKEN_ID=<64-hex> npm run dana-index
# listens :8788
curl -sS http://127.0.0.1:8788/health | jq .
curl -sS 'http://127.0.0.1:8788/api/recent?limit=20' | jq .
curl -sS http://127.0.0.1:8788/api/memorial/<txid> | jq .
# Social preview HTML (nginx routes crawler UAs here for /<txid>):
curl -sS http://127.0.0.1:8788/og/<txid> | head
curl -sS 'http://127.0.0.1:8788/og/<txid>?lang=en' | head
```

Web Vite proxies `/index-api` → `:8788`. Prod nginx: `/index-api/` plus
crawler → `/og/:txid` (see `deploy/contabo/nginx-og-snippet.conf` and
`nginx-wlotus-prod-tls.conf`).

## Open Graph / share previews

| Case | `og:title` (default VI) |
|------|-------------------------|
| Altar / named dedication | `Tưởng nhớ {name}` |
| No name | `White Lotus — Tưởng niệm vĩnh hằng` |

Optional `?lang=en|vi|zh` localizes the card. The web Share action embeds the
**sender's** current app locale in the URL. Facebook / Zalo cache **one** card
per URL; without `?lang=`, previews fall back to `Accept-Language` then
Vietnamese.

## Env

| Var | Default | Meaning |
|-----|---------|---------|
| `TOKEN_ID` | — | ALP token id (required) |
| `CHRONIK_URLS` | public mirrors | Comma-separated |
| `DANA_INDEX_PORT` | `8788` | Listen port |
| `DANA_INDEX_STORE` | `./data/dana-index-burns.json` | Durable JSON |
| `DANA_INDEX_POLL_MS` | `30000` | Mempool/tip poll |
| `DANA_INDEX_BACKFILL_PAGES` | `30` | Startup history pages |
| `PUBLIC_SITE_ORIGIN` | from Host / `https://wlotus.org` | Absolute OG URLs |

Mint-api optional: `DANA_INDEX_URL=http://127.0.0.1:8788` to `POST /api/notify`
after each memorial burn.
