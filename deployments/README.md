# Deployments

On-chain deployment records for White Lotus incubation / production tokens.

| File | Meaning |
|------|---------|
| `mainnet-mwlotus.json` | Live **mWLOTUS** PoW incubation token (preferred alias) |
| `mainnet-pow-token.json` | Same as above (miner default path) |
| `mainnet-last-remint.json` | Last successful PoW remint |
| `pending-funding-mwlotus.json` | Fund address if genesis wallet is empty |
| `mainnet-test-token.json` | Custodial **WLTEST** (not for mining) |
| `mainnet-pow-token-v*-locked.json` | Broken predecessor covenants |

Private keys live only in `.env` (gitignored). Never commit `GENESIS_SK_HEX`.
