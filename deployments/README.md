# Deployments

On-chain deployment records for White Lotus test / production tokens.

| File | Meaning |
|------|---------|
| `mainnet-pow-token.json` | Live **WLPOW** PoW-mineable token (use this) |
| `mainnet-last-remint.json` | Last successful PoW remint |
| `mainnet-test-token.json` | Custodial **WLTEST** (not for mining) |
| `mainnet-pow-token-v1-locked.json` | Broken covenant (size-56) — batons locked |
| `mainnet-pow-token-v2-locked.json` | Broken covenant (`0x00` push) — batons locked |
| `mainnet-pow-handoff.json` | Obsolete introspection handoff record |

Private keys live only in `.env` (gitignored). Never commit `GENESIS_SK_HEX`.
