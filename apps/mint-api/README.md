# Mint API (Prayer memorial mint)

Server sponsors **XEC fees**, signs, and broadcasts. **PoW runs on the device.**
Memorial (`WLBR`) is embedded in the **mint** OP_RETURN — no separate burn tx.

**Open race (MVP):** many devices may hold challenges across **`MINT_SERVING_TIP_COUNT`**
tips (default **2**, matches live dPRAYER). First valid submit wins that tip; losers
restart. No global challenge lock. Concurrent open challenges are capped for desk CPU.

**Fee wallets:** the main desk (`MINT_MNEMONIC`, legacy single address) holds treasury
XEC. Each tip has its own HD fee account (`m/44'/1899'/(tipIndex+1)'/0/0`) so tips
operate independently. Racers on the same tip share that tip’s sized fee coin; only
the winner broadcasts.

**Critical:** remint has **no change output**. Fuel must be a small coin
(~40 XEC / 4000 sats). Attaching a large UTXO burns almost all of it as miner fee.

```
POST /api/challenge  { installId, note? }  → preimage + bits (note bound into OP_RETURN)
  device mines nonce
POST /api/submit     { installId, challengeId, nonceHex, powMs?, powAttempts? }
                     → verify PoW, pay fee, sign, broadcast remint (mint 1 to tip fee wallet)
```

Requires deployment from `TIER=prayer npm run create-dryrun-token` (MooreTipMemo, mintAtoms=1).
**Genesis baton count:** default **28** (ALP max) for launch tokens. Live **dPRAYER** PoC
has **2** tips — fine for testing. Override create with `BATONS=` only for cheap tests.

## Run

```bash
MINT_MNEMONIC="twelve words …" npm run mint-api
```

## Fund tip fee wallets (equal split from desk)

After depositing XEC to the **desk** address:

```bash
# Preview addresses / planned sends
FUND_DRY_RUN=1 MINT_MNEMONIC="…" MINT_SERVING_TIP_COUNT=2 npm run fund-tip-fee-wallets

# Equalize tip balances from desk surplus, peel ~40 XEC fuel coins on each tip
MINT_MNEMONIC="…" npm run fund-tip-fee-wallets
```

On Contabo (env already in `/etc/wlotus/mint.env`):

```bash
cd /root/wlotus/wlotus   # or /opt/wlotus
set -a && source /etc/wlotus/mint.env && set +a
npm run fund-tip-fee-wallets
```

Optional env: `MINT_DESK_RESERVE_SATS` (default 10000), `MINT_FUELS_PER_TIP` (default 3).

If a tip wallet is empty at challenge time, mint-api will try to top up **one** sized
fuel coin from the desk automatically — still prefer running the fund script first.

## Endpoints

| Method | Path | Body / query |
|--------|------|----------------|
| GET | `/health` | `ok`, `startedAt`, `deployedAt` (source file mtime), `deploy.gitSha`, `features.raceOpen` |
| GET | `/api/status?installId=` | remainingToday, tipEpochs, openChallenges, `raceOpen`, `tipFeeAccounts`, `deployedAt`, … |
| POST | `/api/challenge` | `{ installId, note? }` → includes `tipFeeAddress` |
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
