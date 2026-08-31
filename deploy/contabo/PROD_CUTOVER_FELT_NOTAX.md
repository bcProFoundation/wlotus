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

Do **not** wipe the dana-index store this time. Copy the live feed, then
re-burn onto the new token so Cashtab / explorers show the new tokenId.

```bash
# 1. Snapshot the public feed (no wallet)
FROM_TOKEN_ID=154d229bab3cf228a2d40b507e1fc5f21a09542ec66776d3e797b455ab77a091 \
  INDEX_ONLY=1 TO_STORE=/var/lib/wlotus/dana-index-burns.json \
  npm run migrate-offerings

# 2. After the new genesis has inventory on tip-0 (1 atom per offering)
FROM_TOKEN_ID=154d229bab3cf228a2d40b507e1fc5f21a09542ec66776d3e797b455ab77a091 \
  TO_TOKEN_ID=<new> DRY_RUN=1 npm run migrate-offerings

FROM_TOKEN_ID=154d229bab3cf228a2d40b507e1fc5f21a09542ec66776d3e797b455ab77a091 \
  TO_TOKEN_ID=<new> TEMPLE_SCRIPT_HASH_HEX=<20-byte hex> \
  npm run migrate-offerings
```

Step 2 writes `deployments/offering-migration.json` (old txid → new txid),
rewrites `temple-special-claims.json` so Vu Lan / Cô Hồn roots follow, and
replaces `TO_STORE` with remapped burns (new txids + `TO_TOKEN_ID`). Keep that
file when retargeting dana-index.

## Nepal 26/8

Catalog id **`nepal-26-08`** (solar 26 Aug–2 Sep, Global, temple story in
vi/en/zh). No pre-burn — first visitor claims the root. After cutover:

```bash
CREATE_TEMPLE_SPECIALS_IDS=nepal-26-08 npm run create-temple-specials
```

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
