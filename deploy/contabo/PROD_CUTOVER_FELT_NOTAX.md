# Cutover: drop temple tax + felt +1 bit / 730 days

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
| Felt D | 256× / ~11 y | **2× / ~2 y** (730 d/bit) |
| Remint EMPP | ALP + DANA tip | ALP MINT only |
| Desk keep after burn-1 | 101 | 107 |

Temple P2SH stays in JSON as **inventory / premine**, not a remint tax.

## Genesis

```bash
# Test first
TICKER=dWLOTUS FELT=1 BATONS=28 TEMPLE_ADDRESS=ecash:p… \
  GENESIS_SK_HEX=… npm run create-wlotus-token

# Prod
FELT=1 BATONS=28 TEMPLE_ADDRESS=ecash:p… \
  GENESIS_SK_HEX=… npm run create-wlotus-token
```

Override period with `MOORE_DAYS_PER_EXTRA_BIT=365..730` (felt default **730**).

Then the 102/6 playbook: freeze mint-api, pin the new JSON,
`MINT_REQUIRE_LIVE=1`, wipe/retarget dana-index `TOKEN_ID`, recreate temple
specials, bake `VITE_PRAYER_TOKEN_ID`, tag deploy.

Old batons on the previous tokenId remain spendable under the old covenant.
The site stops indexing them after dana-index retarget.
