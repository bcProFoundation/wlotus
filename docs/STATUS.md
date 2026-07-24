# Repository status

Canonical home: **https://github.com/bcProFoundation/wlotus**

## Tokens

| Token | Ticker | Role | Status |
|-------|--------|------|--------|
| **wLotus** | `WLOTUS` | Memorial + dana (ceremonial) | Prod: https://wlotus.org |
| **wLotus dryrun** | `dWLOTUS` | Same covenant; test desk | https://test.wlotus.org |
| **Golden Lotus** | `GLOTUS` | Economic / event burns | Design — [ECONOMICS_WLOTUS_GLOTUS.md](./ECONOMICS_WLOTUS_GLOTUS.md) |

## Covenant (production)

`WlotusPowRemintMooreTipTemple` — Moore calendar D + tipLocktime + hard next-P2SH + temple split.

| Param | Value |
|-------|-------|
| Mint / remint | **108** atoms (one mala) |
| Split | **1** miner + **107** temple P2SH |
| Base bits | **0** (whole-byte only; `bits % 8 == 0`) |
| Moore | **+1 bit / 500 days** (override 365–730) |
| Sunset | remint fails when bits would exceed **128** |
| Batons | **28** at genesis (ALP max; immutable) |
| Desk launch tips | **1** (`MINT_SERVING_TIP_COUNT`; raise toward 28 if needed) |

```bash
TICKER=dWLOTUS BATONS=28 TEMPLE_ADDRESS=ecash:p… npm run create-wlotus-token
TEMPLE_ADDRESS=ecash:p… BATONS=28 npm run create-wlotus-token   # prod WLOTUS
BATON_INDEX=0 TIER=wlotus npm run mine-dryrun-once
```

See [CLOCK.md](./CLOCK.md). Deployments: `deployments/mainnet-dryrun-wlotus.json`, `deployments/mainnet-wlotus.json` (after live genesis).

### Not for production

- **Ergon** (`WlotusPowRemintErgon`) — dogfood only
- **Legacy Moore** (`WlotusPowRemintMoore`) — soft batonHash, +8 cap

## Economics

[ECONOMICS_WLOTUS_GLOTUS.md](./ECONOMICS_WLOTUS_GLOTUS.md) — anti-farm = **1/107 + XEC fees**; presence = soft pray timer + base-0 Moore ramp; token hashrate does not secure the ledger (eCash does).

## Vision

Burn wLotus = white lotus **in memorial of the dead** + **dana** for everybody. [VISION.md](./VISION.md).

Altar / memorial wire policy (star fragments, separator fields, minter amend ≤10, no WLotus off-chain): [ALTAR.md](./ALTAR.md).

## Offerings app (`apps/web`)

Mobile-first Offer / burn UI. No browser wallet yet — remint via mint-api.

| | |
|--|--|
| **Test** | https://test.wlotus.org (`dWLOTUS`) |
| **Prod** | https://wlotus.org (`WLOTUS`) |
| **Local** | `npm run mint-api` + `npm run web` |

## Hosting

| Env | Guide |
|-----|-------|
| Test Contabo | [deploy/contabo/README.md](../deploy/contabo/README.md) |
| Prod Contabo | [deploy/contabo/PROD.md](../deploy/contabo/PROD.md) |

## Next

1. Live **WLOTUS** genesis on prod (`create-wlotus-token` + `MINT_REQUIRE_LIVE=1`)
2. Enable **dana-index** on Contabo (`/index-api/`) after merge — mirror of on-chain DANA history
3. Altar separator packing + minter-only ≤10 amendments ([ALTAR.md](./ALTAR.md))
4. Postage / fee sponsorship polish
5. **GLOTUS** genesis when economic layer ships
6. Fractional-bit PoW if/when eCash raises the 201-op limit
