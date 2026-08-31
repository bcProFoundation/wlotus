# Cutover: drop temple tax + felt +1 bit / 500 days

The live 102/6 whole-byte covenant **cannot be upgraded in place**.
`templeScriptHash`, `codeHash`, `bits % 8 == 0`, and `secondsPerExtraBit` are
committed on every baton. Same pattern as the completed
[102/6 recut](./PROD_CUTOVER_102_6.md): **new genesis**, then retarget
mint-api, dana-index, and the SPA.

Do not run this against the live desks until `GENESIS_SK_HEX` is funded and
you intend to abandon `154d229b…` / `ffc15eb4…`.

## What changes

| | Live | Recut |
|--|--|--|
| Covenant | `WlotusPowRemintMooreTipTemple` | `GlotusPowRemintMooreTip` |
| Split | 102 + 6 | **108 miner** |
| Felt D | 256× / ~11 y | **2× / ~1.4 y** (500 d/bit, felt every bit) |
| Remint EMPP | ALP + DANA tip | ALP MINT only |
| Desk keep after burn-1 | 101 | 107 |

WLotus is ceremonial, not a currency — keep the aggressive 500-day arhat
clock from bits=0. GLotus stays 845. Temple P2SH is inventory / premine only.

## Genesis

```bash
# Test first
TICKER=dWLOTUS FELT=1 BATONS=28 TEMPLE_ADDRESS=ecash:p… \
  GENESIS_SK_HEX=… npm run create-wlotus-token

# Prod
FELT=1 BATONS=28 TEMPLE_ADDRESS=ecash:p… \
  GENESIS_SK_HEX=… npm run create-wlotus-token
```

Felt default is **500** days (`MOORE_DAYS_PER_EXTRA_BIT` still clamps 365–730).

## Migrate offerings

Genesis on **test** with ticker `WLOTUS`, then clone **live prod**
(`f4e452ef…`) — not old test `dWLOTUS` / `fcf7de59…` / retired `154d229b…`.

Wipe the dest dana-index store first. Do **not** `INDEX_ONLY` into the live
path. After re-burn, claims are remapped **and** rebound by altar name so
visitor stars that were never in `temple-special-claims.json` still attach
to the catalog event (Nepal 26/8 on prod is this case).

```bash
FROM_TOKEN_ID=f4e452ef78eaf61908d30ecbd804df5588c6bb6aeea61cf0cbe8bf2186764456 \
  TO_TOKEN_ID=<new> TEMPLE_ADDRESS=ecash:qz2cyuu3y5h0tanf8wy3esr64drpzzweeyu2c5dyen \
  DRY_RUN=1 npm run migrate-offerings

FROM_TOKEN_ID=f4e452ef78eaf61908d30ecbd804df5588c6bb6aeea61cf0cbe8bf2186764456 \
  TO_TOKEN_ID=<new> TEMPLE_ADDRESS=ecash:qz2cyuu3y5h0tanf8wy3esr64drpzzweeyu2c5dyen \
  npm run migrate-offerings
```

Then (optional if migrate-offerings already bound names):

```bash
FROM_TOKEN_ID=f4e452ef78eaf61908d30ecbd804df5588c6bb6aeea61cf0cbe8bf2186764456 \
  TEMPLE_ADDRESS=ecash:qz2cyuu3y5h0tanf8wy3esr64drpzzweeyu2c5dyen \
  npm run migrate-catalog-specials
```

That second script **rebinds** a dest star that already matches; it does not
remint a duplicate Nepal root.

## Nepal 26/8

Catalog id **`nepal-26-08`**. On live prod the 7 offerings sit on visitor
root `22df868b…` (`Nepal 26/08`) and the special is **unbound**. Migration
must claim that star (by packed name), not create an empty event.

Remembrance Day and All Saints' Day **are** claimed on prod (one temple
root each, no extra flowers). They are EN-country events — the VN home
Events list hides them; Search / English locale still show them.

Then the 102/6 playbook: freeze mint-api, pin the new JSON,
`MINT_REQUIRE_LIVE=1`, retarget dana-index `TOKEN_ID` (keep the migrated
store), bake `VITE_PRAYER_TOKEN_ID`, tag deploy.

The SPA drops this device's Recent / hidden roots / created-root cache /
in-flight challenge when `/api/status` (or the baked `VITE_PRAYER_TOKEN_ID`)
is a new token. **Deploy this web build on the current token first** so
clients record `wlotus.liveTokenId`; the genesis deploy then clears old
own-history automatically. Morning reminders resync to an empty follow list.
`installId` is kept.

Old batons on the previous tokenId remain spendable under the old covenant.
