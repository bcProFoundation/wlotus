# Mint API (Prayer memorial mint)

Server sponsors **XEC fees**, signs, and broadcasts. **PoW runs on the device.**
Memorial (`WLBR`) is embedded in the **mint** OP_RETURN — no separate burn tx.

```
POST /api/challenge  { installId, note? }  → preimage + bits (note bound into OP_RETURN)
  device mines nonce
POST /api/submit     { installId, challengeId, nonceHex, powMs?, powAttempts? }
                     → verify PoW, pay fee, sign, broadcast remint (mint 1 to desk)
```

Requires deployment from `TIER=prayer npm run create-dryrun-token` (MooreTipMemo, mintAtoms=1).

## Run

```bash
MINT_MNEMONIC="twelve words …" npm run mint-api
```

## Endpoints

| Method | Path | Body / query |
|--------|------|----------------|
| GET | `/health` | — |
| GET | `/api/status?installId=` | remainingToday, baseZeroBits, memorialOnMint |
| POST | `/api/challenge` | `{ installId, note? }` |
| POST | `/api/submit` | `{ installId, challengeId, nonceHex, powMs?, powAttempts? }` |
| POST | `/api/offer` | **410** retired |

## Limits

- `MINT_MAX_OFFERS_PER_DAY` (default **20** on test)
- Challenges expire after 15 minutes
