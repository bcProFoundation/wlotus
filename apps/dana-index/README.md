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
curl -sS 'http://127.0.0.1:8788/api/trending?limit=8' | jq .
curl -sS 'http://127.0.0.1:8788/api/search?q=quả&limit=20' | jq .
curl -sS http://127.0.0.1:8788/api/memorial/<txid> | jq .
# Social preview HTML (nginx proxies every /<txid> share URL here):
curl -sS http://127.0.0.1:8788/og/<txid> | head
curl -sS 'http://127.0.0.1:8788/<txid>?lang=en' | head
curl -sS 'http://127.0.0.1:8788/og/<txid>?lang=en' | head
```

Web Vite proxies `/index-api` → `:8788`. Prod/test nginx: `/index-api/` plus
every `/<txid>` → `proxy_pass …/og/$1` (see `deploy/contabo/nginx-api-snippet.conf`).
dana-index also serves OG on bare `GET /:txid` so a missing nginx rewrite still works.
The OG page boots the SPA in browsers; crawlers keep the meta tags.

## Open Graph / share previews

| Case | `og:title` (default VI) |
|------|-------------------------|
| Altar / named dedication | `Tưởng nhớ {name}` |
| No name | `W Lotus - Kết nối các thế hệ` |

`og:description` (no name): `Đoá sen của sự tưởng nhớ.`

Optional `?lang=en|vi|zh` localizes the card. The web Share action embeds the
**sender's** current app locale in the URL. Crawler `Accept-Language` is
**ignored** (TelegramBot usually sends `en`). Without `?lang=`, previews use
Vietnamese. Messengers cache one card per URL — refresh Telegram via
[@WebpageBot](https://t.me/WebpageBot) after fixing tags.

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
| `DANA_INDEX_NOTIFY_SECRET` | unset | Optional bearer for non-loopback `POST /api/notify`. Direct `127.0.0.1` is always allowed. Public `/index-api/api/notify` is 403 in nginx. |

Mint-api optional: `DANA_INDEX_URL=http://127.0.0.1:8788` to `POST /api/notify`
after each memorial burn (loopback; no public client notify).

## Contabo (test / prod)

Unit: `wlotus-dana-index.service` (`User=deploy`, cwd `/opt/wlotus`, env
`/etc/wlotus/dana-index.env`). Full update procedure — **pull as `deploy`**,
backup `deployments/mainnet-dryrun-*.json` tip state, restart, OG smoke — is in
[deploy/contabo/README.md](../../deploy/contabo/README.md) under
**Update `/opt/wlotus` + restart dana-index**.

Quick restart after a successful pull:

```bash
sudo systemctl restart wlotus-dana-index
curl -sS http://127.0.0.1:8788/health | jq .
curl -sS 'http://127.0.0.1:8788/api/search?q=test&limit=5' | jq .
curl -sS "http://127.0.0.1:8788/og/<txid>?lang=vi" | grep og:title
```

If `/api/search` returns 404, the web app falls back to ranking `/api/recent`
client-side (works for small indexes; restart dana-index after pulling search support).
If `/api/trending` returns 404, home Trending likewise ranks `/api/recent` by
burns in the last 24 hours.
