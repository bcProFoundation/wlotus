# Mint API (Prayer memorial mint)

Server sponsors **XEC fees**, signs, and broadcasts. **PoW runs on the device.**
Memorial (`WLBR`) is embedded in the **mint** OP_RETURN — no separate burn tx.

**Open race (MVP):** many devices may hold challenges across **`MINT_SERVING_TIP_COUNT`**
tips (default **2**, matches live dPRAYER). First valid submit wins that tip; losers
restart. No global challenge lock. Concurrent open challenges are capped for desk CPU.

**Fee UTXOs:** **one fee coin per tip** (shared by all racers on that tip). Only the
winner broadcasts, so concurrent miners on one tip do not need separate fee splits.

```
POST /api/challenge  { installId, note? }  → preimage + bits (note bound into OP_RETURN)
  device mines nonce
POST /api/submit     { installId, challengeId, nonceHex, powMs?, powAttempts? }
                     → verify PoW, pay fee, sign, broadcast remint (mint 1 to desk)
```

Requires deployment from `TIER=prayer npm run create-dryrun-token` (MooreTipMemo, mintAtoms=1).
**Genesis baton count:** default **28** (ALP max) for launch tokens. Live **dPRAYER** PoC
has **2** tips — fine for testing. Override create with `BATONS=` only for cheap tests.

## Run

```bash
MINT_MNEMONIC="twelve words …" npm run mint-api
```

## Endpoints

| Method | Path | Body / query |
|--------|------|----------------|
| GET | `/health` | `ok`, `startedAt`, `deployedAt` (source file mtime), `deploy.gitSha`, `features.raceOpen` |
| GET | `/api/status?installId=` | remainingToday, tipEpochs, openChallenges, `raceOpen`, `deployedAt`, … |
| POST | `/api/challenge` | `{ installId, note? }` |
| POST | `/api/submit` | `{ installId, challengeId, nonceHex, powMs?, powAttempts? }` |
| POST | `/api/cancel` | `{ installId, challengeId? }` — release open challenge |
| POST | `/api/offer` | **410** retired |

## Limits

- `MINT_MAX_OFFERS_PER_DAY` (default **20** on test)
- `MINT_MAX_OPEN_CHALLENGES` (default **32**) — concurrent open challenge objects the desk will hold
- `MINT_SERVING_TIP_COUNT` (default **2**) — tips load-balanced for PoC; raise toward 28 at launch
- Challenges expire after 15 minutes (or when that tip is reminted by someone else)

## Verify Contabo is on the open-race build

Web CI does **not** update mint-api. On the VM:

```bash
cd /root/wlotus/wlotus   # or your clone path
git pull origin master
systemctl restart wlotus-mint-api
curl -sS https://test.wlotus.org/health | jq .
```

Expect `features.raceOpen: true`, `features.servingTipCount: 2`, and a fresh `startedAt` / `deployedAt`.
Old builds only return `{"ok":true}` from `/health` and omit `raceOpen` from `/api/status`.
