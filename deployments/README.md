# Deployments

On-chain deployment records for White Lotus test / production tokens.

| File | Meaning |
|------|---------|
| `pending-funding.json` | Genesis address waiting for XEC before first broadcast |
| `mainnet-test-token.json` | Written by `npm run create-test-token` after successful GENESIS |

Private keys live only in `.env` (gitignored). Never commit `GENESIS_SK_HEX`.
