# Mint API (wLotus burn-after-mint)

Server sponsors **XEC fees**, signs, and broadcasts. **PoW runs on the device.**

**wLotus (live):** remint mints **108** (one mala: 1 → tip fee wallet, 107 → temple P2SH).
Memorial burn of the miner 1 (`DANA`) is **deferred** until after the client soft pray
window (`POST /api/burn`). Remint runs on submit so tip races are not delayed. Cancel
during the soft wait abandons the burn — desk keeps the miner atom.
The on-chain burn is the gift (memorial + dana). Remint tip EMPP also uses **`DANA` v4**
(same LOKAD; ver distinguishes tip vs memorial).
Re-offers send `parentBurnTxid` (**original** dedication burn) and encode
**DANA v2** with optional note + 32-byte parent txid for dana explorer linkage.
(star topology: all re-offers → root, not a tip chain).

Legacy Prayer memo path (mint 1 + DANA memorial on remint, no burn) still works if the
loaded deployment is `tier=prayer`.

**After pulling this change:** recreate genesis (`TICKER=dWLOTUS … npm run create-wlotus-token`) —
old tip covenants will not match the new redeem.

**Open race (MVP):** many devices may hold challenges across **`MINT_SERVING_TIP_COUNT`**
tips (default **1** at launch — bound fee burn; raise toward **28** if demand warrants).
First valid submit wins that tip; losers restart. Concurrent open challenges are capped
for desk CPU. Genesis still creates **28** batons so parallelism stays available.

**Fee wallets:** the main desk (`MINT_MNEMONIC`) holds treasury XEC. Each tip has its
own HD fee account (`m/44'/1899'/(tipIndex+1)'/0/0`). The tip fee wallet receives the
minted miner atom and must fund the burn fee.

**Critical:** remint has **no change output**. Fuel must be a small coin
(~40 XEC / 4000 sats). Attaching a large UTXO burns almost all of it as miner fee.

```
POST /api/challenge  { installId, note? }  → preimage + bits
  device mines nonce
POST /api/submit     { installId, challengeId, nonceHex, … }
                     → remint (108); temple returns burnPending
  soft pray wait (client)
POST /api/burn       { installId, remintTxid, burnToken }
                     → burn miner 1 + DANA
  (cancel with remintTxid + burnToken abandons burn; desk keeps atom)
```

Requires a deployment JSON:

| Env | File | Create with |
|-----|------|-------------|
| **Test** | `deployments/mainnet-dryrun-wlotus.json` | `TICKER=dWLOTUS BATONS=28 npm run create-wlotus-token` |
| **Prod** | `deployments/mainnet-wlotus.json` | `BATONS=28 npm run create-wlotus-token` (default ticker WLOTUS; see [PROD.md](../../deploy/contabo/PROD.md)) |

mint-api prefers **live** `mainnet-wlotus.json` when present. On Contabo **prod**, set `MINT_REQUIRE_LIVE=1` so dryrun JSON cannot be loaded by mistake.
**Genesis baton count:** **28** (ALP max). Desk soft-serves **1** tip via `MINT_SERVING_TIP_COUNT` (raise toward 28 if demand warrants).

## Run

```bash
MINT_MNEMONIC="twelve words …" npm run mint-api
```

## Fund tip fee wallets (equal split from desk)

After depositing XEC to the **desk** address:

```bash
# Preview addresses / planned sends
FUND_DRY_RUN=1 MINT_MNEMONIC="…" MINT_SERVING_TIP_COUNT=1 npm run fund-tip-fee-wallets

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
| POST | `/api/submit` | `{ installId, challengeId, nonceHex, … }` → remint; temple may set `burnPending` |
| POST | `/api/burn` | `{ installId, remintTxid, burnToken }` — memorial burn; `burnToken` from submit only |
| POST | `/api/cancel` | `{ installId, challengeId?, remintTxid?, burnToken? }` — abandon pending burn needs token |
| POST | `/api/offer` | **410** retired |

## Limits

- `MINT_MAX_OFFERS_PER_DAY` (default **20** on test)
- `MINT_MAX_OPEN_CHALLENGES` (default **32**) — concurrent open challenge objects the desk will hold
- `MINT_SERVING_TIP_COUNT` (default **1**) — tips load-balanced; raise toward **28** if demand warrants
- Challenges expire after 15 minutes (or when that tip is reminted by someone else)
- Pending memorial burns expire after 15 minutes if `/api/burn` is never called (desk keeps atom)

## Verify Contabo is on the open-race build

Web CI does **not** update mint-api. On the VM:

```bash
cd /root/wlotus/wlotus   # or your clone path
git pull origin master
systemctl restart wlotus-mint-api
curl -sS https://test.wlotus.org/health | jq .
```

Expect `features.raceOpen: true`, `features.servingTipCount: 1` (or your `MINT_SERVING_TIP_COUNT`), and a fresh `startedAt` / `deployedAt`.
Old builds only return `{"ok":true}` from `/health` and omit `raceOpen` from `/api/status`.

**Prod must not serve `dWLOTUS`:** set `MINT_REQUIRE_LIVE=1` in `/etc/wlotus/mint.env` and ensure `deployments/mainnet-wlotus.json` exists (see [PROD.md](../../deploy/contabo/PROD.md)).
