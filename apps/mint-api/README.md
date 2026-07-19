# Mint API (Prayer memorial mint)

Server sponsors **XEC fees**, signs, and broadcasts. **PoW runs on the device.**
Memorial (`WLBR`) is embedded in the **mint** OP_RETURN — no separate burn tx.

**Open race (MVP):** many devices may hold challenges on the **same serving tip** at once.
First valid submit wins; losers’ challenges expire and they Offer again. No global
challenge lock. Concurrent open challenges are capped for desk resources.

```
POST /api/challenge  { installId, note? }  → preimage + bits (note bound into OP_RETURN)
  device mines nonce
POST /api/submit     { installId, challengeId, nonceHex, powMs?, powAttempts? }
                     → verify PoW, pay fee, sign, broadcast remint (mint 1 to desk)
```

Requires deployment from `TIER=prayer npm run create-dryrun-token` (MooreTipMemo, mintAtoms=1).
**Genesis baton count:** default **28** (ALP max). Override with `BATONS=` only for cheap tests — production tokens must use the max (cannot add batons later).

## Run

```bash
MINT_MNEMONIC="twelve words …" npm run mint-api
```

## Endpoints

| Method | Path | Body / query |
|--------|------|----------------|
| GET | `/health` | — |
| GET | `/api/status?installId=` | remainingToday, tipEpoch, openChallenges, … |
| POST | `/api/challenge` | `{ installId, note? }` |
| POST | `/api/submit` | `{ installId, challengeId, nonceHex, powMs?, powAttempts? }` |
| POST | `/api/cancel` | `{ installId, challengeId? }` — release open challenge |
| POST | `/api/offer` | **410** retired |

## Limits

- `MINT_MAX_OFFERS_PER_DAY` (default **20** on test)
- `MINT_MAX_OPEN_CHALLENGES` (default **32**) — concurrent open races the desk will hold
- `MINT_SERVING_TIP_INDEX` (default **0**) — which baton tip the desk serves in MVP
- Challenges expire after 15 minutes (or when the tip is reminted by someone else)
