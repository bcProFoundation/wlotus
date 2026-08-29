# Mint API (wLotus burn-after-mint)

Server sponsors **XEC fees**, signs, and broadcasts. **PoW runs on the device.**

**wLotus (live):** remint mints **108** (one mala: **102** → miner / tip fee wallet, **6** → temple P2SH).
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

**Genesis is immutable.** A new split or redeem requires a new token id. Prod and
test already run **102/6** — see [docs/STATUS.md](../../docs/STATUS.md).

**Open race (MVP):** many devices may hold challenges across **`MINT_SERVING_TIP_COUNT`**
tips (default **1** at launch — bound fee burn; raise toward **28** if demand warrants).
First valid submit wins that tip; losers restart. Concurrent open challenges are capped
for desk CPU. Genesis still creates **28** batons so parallelism stays available.

**Live tip:** JSON `powAddress` is a cache. Open miners remint without this API and
move the baton to a new P2SH. `POST /api/challenge` walks Chronik `spentBy` from
`lastRemintTxid` / the genesis handoff until the mint baton is unspent, rebuilds
the covenant from that tx locktime, and persists the followed tip.

**Fee wallets:** the main desk (`MINT_MNEMONIC`) holds treasury XEC. Each tip has its
own HD fee account (`m/44'/1899'/(tipIndex+1)'/0/0`) — the **mint address**. It
signs remint, receives the miner atoms, and burns the offering.

**Critical:** remint has **no change output**. Fuel must be a small coin
(~40 XEC / 4000 sats). Attaching a large UTXO burns almost all of it as miner fee.

**Offering fee flow** (one extra hop is required; a large “chunk” on the mint
does not save a transaction):

1. Desk → mint: one sized ~40 XEC fuel (change stays on desk).
2. Mint remint spends that fuel (leftover is miner fee, not change).
3. Mint burn spends the miner-atom UTXO. Pure-XEC change stays on the **mint
   receive** address — never swept back to the desk (that was swallowing the
   next fuel and causing insufficient-fee failures). Leftover WLOTUS inventory
   still goes to temple P2SH.

`fund-tip-fee-wallets` pre-places several sized fuels on the mint (change on
desk) so offerings often skip the auto top-up.

### Custody: one mnemonic today, split keys later

Addresses are already separate. **Keys are not.** One `MINT_MNEMONIC` derives
the desk (non-HD) and every tip HD account, and mint-api loads both. A
compromise of the process can spend the treasury, even though remint never
touches desk UTXOs.

Keep them the same for now (auto-peel + one-secret ops). Split when the desk
holds value worth stealing.

| Role | Must be hot? | Today | Later |
|------|----------------|-------|--------|
| **Tip / mint keys** | Yes — remint and burn are in the request path | Same mnemonic | Stay in mint-api (own secret) |
| **Desk / treasury key** | No — only peels ~40 XEC onto an empty tip | Same mnemonic, same process | Different secret, not on the mint host |

**Why one desk funds all tips:** remint cannot attach a large UTXO, so treasury
cannot sit on a remint-capable wallet. Per-tip HD keys still isolate fuel
across parallel races. Pre-place `MINT_FUELS_PER_TIP` coins per tip; do not
move treasury onto the tips.

**When splitting keys:**

1. Give tips their own mnemonic (or `TIP_SK` per account). mint-api keeps only
   those keys.
2. Keep the desk mnemonic off the mint host. Refill tips with
   `fund-tip-fee-wallets` from a machine that has the desk key.
3. Offerings fail closed when a tip is empty until ops peels from the desk
   (no in-process auto-peel).
4. Optional middle ground: mint-api holds a **small float** funding key (a few
   thousand XEC) and the real desk stays cold.

Do not treat address separation as key separation — anyone with today’s
`MINT_MNEMONIC` can derive the desk and all 28 tip accounts.

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

# Equalize: send sized ~40 XEC fuels from desk → mint (change remains on desk)
MINT_MNEMONIC="…" npm run fund-tip-fee-wallets
```

On Contabo (env already in `/etc/wlotus/mint.env`):

```bash
cd /root/wlotus/wlotus   # or /opt/wlotus
set -a && source /etc/wlotus/mint.env && set +a
npm run fund-tip-fee-wallets
```

Optional env: `MINT_DESK_RESERVE_SATS` (default 10000), `MINT_FUELS_PER_TIP` (default 3).

If the mint/tip wallet has no sized fuel at challenge time, mint-api sends **one
~40 XEC** coin from the desk (`sendSizedFuelFromDesk`). Change stays on the desk.
Do not send leftover mint XEC back to the desk during burn.

## Endpoints

| Method | Path | Body / query |
|--------|------|----------------|
| GET | `/health` | `ok`, `startedAt`, `deployedAt` (source file mtime), `deploy.gitSha`, `features.raceOpen` |
| GET | `/api/status?installId=` | remainingToday, tipEpochs, openChallenges, `raceOpen`, `tipFeeAccounts`, `deployedAt`, … |
| GET | `/api/root-creator?txid=&installId=` | Soft ownership: `{ isCreator, known }` (never returns stored id) |
| GET | `/api/push/vapid` | Web Push VAPID public key |
| POST | `/api/push/subscribe` | `{ installId, endpoint, keys, locale, timeZone, altars }` morning giỗ reminders |
| POST | `/api/push/unsubscribe` | `{ endpoint }` |
| POST | `/api/challenge` | `{ installId, note? }` → includes `tipFeeAddress` |
| POST | `/api/submit` | `{ installId, challengeId, nonceHex, … }` → remint; temple may set `burnPending` |
| POST | `/api/burn` | `{ installId, remintTxid, burnToken }` — memorial burn; `burnToken` from submit only |
| POST | `/api/cancel` | `{ installId, challengeId?, remintTxid?, burnToken? }` — abandon pending burn needs token |
| POST | `/api/offer` | **410** retired |

## Limits

- `MINT_MAX_OFFERS_PER_DAY` (default **20** on test) — per `installId`
  (client-generated `localStorage` UUID; trivial to reset — see docs/MOBILE.md).
- `MINT_MAX_OFFERS_PER_DAY_PER_IP` (default **`MINT_MAX_OFFERS_PER_DAY` × 5**)
  — coarser secondary cap keyed on the client IP (`X-Real-IP`, normalized —
  IPv6 collapses to its `/64` prefix so a single customer can't bypass it by
  rotating the low 64 bits for free; see `src/lib/rateLimit.ts`). Deliberately
  looser than the per-`installId` cap so a household/office sharing one
  public IPv4 isn't throttled by ordinary, independent use; it exists only to
  bound how much sponsored XEC fee one IP can drain by minting fresh
  `installId`s. `remainingToday` in `/api/status` reports the more
  restrictive of the two.
  - **Why IP-only is proportionate here, not a real security boundary:**
    each offer costs the desk on the order of a few XEC in sponsored network
    fees (fee-only — on the official path the devotee does not withdraw the
    miner share; the desk burns 1 for the flower and keeps inventory, and
    temple still receives 6). At XEC's
    typical price (order of $0.00001–0.0001), maxing out one identity's daily
    cap drains cents at most — far less than the cost of real IP-rotation
    infrastructure (residential proxies, VPN churn) an attacker would need to
    repeat that at scale. Treat this cap as a good-faith UX guard against
    casual re-offering, not a defense against a determined attacker — the
    Moore-clock PoW difficulty ramp (see docs/CLOCK.md) is the mechanism that
    scales the real cost of abuse as the token (hopefully) gains value over
    time.
- `MINT_MAX_OPEN_CHALLENGES` (default **32**) — concurrent open challenge objects the desk will hold
- `MINT_MAX_CHALLENGES_PER_IP_PER_MIN` (default **8**) — Chronik-heavy challenge builds per IP per minute. nginx `limit_req zone=wl_challenge` is the matching edge limit (`POST /api/challenge`).
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
