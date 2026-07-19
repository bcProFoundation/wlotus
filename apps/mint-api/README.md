# Mint API (Prayer dual-mint)

Server sponsors **XEC fees**, signs, broadcasts, and burns. **PoW runs on the device.**

```
POST /api/challenge  → contract challenge (preimage, bits)
  device mines nonce
POST /api/submit     → verify PoW, pay fee, sign, broadcast remint, burn 1
```

## Run

```bash
# From repo root
MINT_MNEMONIC="twelve words …" npm run mint-api
# Contabo: EnvironmentFile=/etc/wlotus/mint.env
```

## Endpoints

| Method | Path | Body / query |
|--------|------|----------------|
| GET | `/health` | — |
| GET | `/api/status?installId=` | remainingToday, baseZeroBits, clientPow |
| POST | `/api/challenge` | `{ installId }` → preimageHex, powPrefixHex, bits, challengeId |
| POST | `/api/submit` | `{ installId, challengeId, nonceHex, note?, powMs?, powAttempts? }` |
| POST | `/api/offer` | **410** retired (server PoW removed) |

## Flow

1. Client requests a challenge (server reserves baton + fee UTXO, builds sighash preimage).
2. Device mines `sha256d(powPrefix || nonce)` to tip bits.
3. Client submits nonce; server verifies, signs fuel+baton, broadcasts remint, burns 1 atom (desk keeps 1).
4. Daily limit: `MINT_MAX_OFFERS_PER_DAY` (default **20** on test) successful submits per `installId` (UTC day). Challenges expire after 15 minutes.
