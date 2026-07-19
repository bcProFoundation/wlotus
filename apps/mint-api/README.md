# Mint API — dual-mint Prayer offers

Server path for mobile-first offerings (no browser wallet yet):

1. MooreTip remint (**2** atoms) — server pays XEC fee + PoW  
2. Burn **1** with memorial EMPP  
3. Keep **1** on desk wallet

Rate limit: **2 offers / UTC day / installId**.

## Secrets: GitHub vs `.env` on the server

| Approach | Use for mint fee wallet? |
|----------|---------------------------|
| **`.env` / `EnvironmentFile` on Contabo** | **Yes — required for runtime** |
| **GitHub Actions secret only** | **No** — Actions is not the long-running mint process |
| GitHub secret → sync to `/etc/wlotus/mint.env` on deploy | Optional convenience for test |

**Recommendation:** put the 12-word phrase in **`/etc/wlotus/mint.env`** on the test VM (`MINT_MNEMONIC=…`). That is what `mint-api` reads when offering.

Optionally also store the same phrase as GitHub secret `MINT_MNEMONIC` so the deploy workflow can refresh the server file — useful for test, not required. Do **not** commit the mnemonic to git.

Hot wallet for fees should stay on the VM (or a dedicated signer later). CI secrets are for SSH + public Vite build vars.

## Env

```bash
# Preferred
MINT_MNEMONIC="twelve words … here"

# Or hex
MINT_SK_HEX=<64 hex>
# Legacy fallback:
GENESIS_SK_HEX=<64 hex>
```

Example: `deploy/contabo/mint.env.example` → `/etc/wlotus/mint.env` (`chmod 600`).

Fund the derived address with XEC (fees). Print address:

```bash
MINT_MNEMONIC="…" npx tsx -e "
import { config } from 'dotenv'; config();
import { createChronik } from './src/network/createChronik.ts';
import { loadMintWallet } from './src/mint/loadMintWallet.ts';
const c = await createChronik('closest');
const m = await loadMintWallet(c);
console.log(m.address, m.source);
"
```

## Run

```bash
npm run mint-api
# → http://127.0.0.1:8787
```

Production-ish on Contabo: `deploy/contabo/wlotus-mint-api.service` + nginx `/api/` proxy.

## Endpoints

| Method | Path | Body / query |
|--------|------|----------------|
| GET | `/health` | — |
| GET | `/api/status?installId=` | remainingToday, baseZeroBits, tokenId |
| POST | `/api/offer` | `{ installId, note? }` → includes `powMs`, `powAttempts`, `hashrateHps` |
