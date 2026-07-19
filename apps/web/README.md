# WLotus web — offerings (Prayer burn)

Migrated from **Lotus Temple** UX (flower / incense / candle offering steps),
retargeted to **eCash ALP Prayer burn** with **XEC network fees**.

No “temple” product framing — brand is **WLotus**.

## Run

From repo root (workspaces):

```bash
npm install
npm run web
```

Or:

```bash
cd apps/web && npm install && npm run dev
```

Open http://localhost:5173

## Env (optional)

Copy `.env.example` → `.env`:

```
VITE_PRAYER_TOKEN_ID=<alp token id>
VITE_PRAYER_TICKER=dPRAYER
VITE_CHRONIK_URLS=https://chronik.e.cash,https://chronik.pay2stay.com/xec
```

Defaults to the live dryrun `dPRAYER` token.

## Flow

1. Create or unlock a browser wallet (sk stored in `localStorage`).
2. Fund address with **XEC** (fees) and **Prayer** tokens.
3. Choose 1 / 10 / 100 Prayer and burn — ALP `BURN` + `WLBR` memorial EMPP.
4. Postage server can replace the XEC fee input later; burn path stays the same.

## Deploy (Contabo test)

CI builds this SPA and rsyncs `dist/` to the Contabo test VM.

See **[deploy/contabo/README.md](../../deploy/contabo/README.md)** for VM bootstrap,
GitHub secrets, and the **Deploy web (test)** workflow.

## Not ported (yet)

Lotus Temple GraphQL social graph, OAuth, Meili search, posts, and XPI settlement.
Those stay in the lixi monorepo until a thin indexer is needed.
