# Cutover: drop temple tax + felt +1 bit / 500 days

The live 102/6 whole-byte covenant **cannot be upgraded in place**.
`templeScriptHash`, `codeHash`, `bits % 8 == 0`, and `secondsPerExtraBit` are
committed on every baton. Same pattern as the completed
[102/6 recut](./PROD_CUTOVER_102_6.md): **new genesis**, then retarget
mint-api, dana-index, and the SPA.

## One genesis (locked)

**One genesis, ticker `WLOTUS`, dogfood on test, then point prod at the same
`tokenId`.** No second genesis. No genesis from a laptop in parallel.

1. Abandon failed test token `fcf7de59…` (cloned mixed history). Abandon old
   test `ffc15eb4…` (`dWLOTUS`) and retired prod `154d229b…`.
2. **Genesis on the test VM** with ticker **`WLOTUS`** (writes
   `deployments/mainnet-wlotus.json` — intentional; this **is** the prod token).
3. Felt 108, 28 batons, 500 d/bit. Listing sink:
   `TEMPLE_ADDRESS=ecash:qz2cyuu3y5h0tanf8wy3esr64drpzzweeyu2c5dyen`.
4. **Migrate FROM live prod only**:
   `f4e452ef78eaf61908d30ecbd804df5588c6bb6aeea61cf0cbe8bf2186764456`
   (wlotus.org now). Never FROM `ffc15eb4…` / `fcf7de59…` / `154d229b…`.
5. After genesis, test.wlotus.org is **not a sandbox** — every burn is on the
   token that will be prod.
6. Later: new prod desk mnemonic (sweep batons/inventory if the desk key
   changes), **copy the same JSON**, retarget mint-api / dana-index /
   `VITE_PRAYER_TOKEN_ID`. Same `tokenId`. No genesis, no second clone.
7. Do **not** point prod at `fcf7de59…`. Git `deployments/mainnet-wlotus.json`
   on master after #251 **is** that failed test token — ignore it.

Merge [PR #253](https://github.com/bcProFoundation/wlotus/pull/253) (Nepal
bind by altar name) onto master **before** this genesis so catalog stars that
were never in `temple-special-claims.json` still attach.

## What changes

| | Live (`f4e452ef…`) | Recut |
|--|--|--|
| Covenant | `WlotusPowRemintMooreTipTemple` | `GlotusPowRemintMooreTip` |
| Split | 102 + 6 | **108 miner** |
| Felt D | 256× / ~11 y | **2× / ~1.4 y** (500 d/bit, felt every bit) |
| Remint EMPP | ALP + DANA tip | ALP MINT only |
| Desk keep after burn-1 | 101 | 107 |
| Special-event burn | 102 − 6 = 96 | **108 − 6 = 102** |

WLotus is ceremonial, not a currency — keep the aggressive 500-day arhat
clock from bits=0. GLotus stays 845. Temple address is inventory / premine
/ soft listing tax only (no covenant tax).

## Genesis (test VM only)

```bash
# On /opt/wlotus on the TEST VM. Ticker WLOTUS. New genesis SK.
# Do NOT TICKER=dWLOTUS. Do NOT genesis prod in parallel.
FELT=1 BATONS=28 \
  TEMPLE_ADDRESS=ecash:qz2cyuu3y5h0tanf8wy3esr64drpzzweeyu2c5dyen \
  GENESIS_SK_HEX=… npm run create-wlotus-token
```

Felt default is **500** days (`MOORE_DAYS_PER_EXTRA_BIT` still clamps 365–730).

Empty dest dana-index + `temple-special-claims.json` on the test VM first.
Do **not** `INDEX_ONLY` into the live store path.

## Migrate offerings

Clone **live prod** (`f4e452ef…`) onto the new token. `FROM_TOKEN_ID` is
required (no silent `154d229b…` fallback). Abandoned sources and dests are
refused unless `ALLOW_ABANDONED_FROM=1` / `ALLOW_ABANDONED_TO=1`.

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

## Promote the same token to prod

No genesis. Copy `deployments/mainnet-wlotus.json` from the test VM to prod.
Retarget mint-api (`MINT_REQUIRE_LIVE=1`), dana-index `TOKEN_ID` (keep the
migrated store), bake `VITE_PRAYER_TOKEN_ID`. New prod desk mnemonic only
if you sweep batons and inventory onto it.

The SPA drops this device's Recent / hidden roots / created-root cache /
in-flight challenge when `/api/status` (or the baked `VITE_PRAYER_TOKEN_ID`)
is a new token. **Deploy this web build on the current token first** so
clients record `wlotus.liveTokenId`; the genesis deploy then clears old
own-history automatically. Morning reminders resync to an empty follow list.
`installId` is kept.

Old batons on the previous tokenId remain spendable under the old covenant.
