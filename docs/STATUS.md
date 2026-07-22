# Repository status

Canonical home: **https://github.com/bcProFoundation/wlotus**

## Production dryrun (MooreTip hard-bind)

Covenant: `WlotusPowRemintMooreTip` — Moore calendar D + tipLocktime + **hard next-P2SH** (`prefixHash`/`codeHash`).

Whole-byte PoW only (`bits % 8 == 0`) so the redeem fits eCash’s **201-op** limit together with hard bind. Dryrun bases (nearby the phone/GPU/ASIC targets):

| Tier | Dryrun bits | Mint | Script |
|------|-------------|------|--------|
| **wLotus** | **0** | **108** | `TICKER=dWLOTUS npm run create-wlotus-token` (prod: default `WLOTUS`) |
| Prayer | 24 | 1 | `TIER=prayer npm run create-dryrun-token` |
| Candle | 40 | 1 | `TIER=candle npm run create-dryrun-token` |
| Flower | 56 | 100 | `TIER=flower npm run create-dryrun-token` |

```bash
TICKER=dWLOTUS BATONS=28 TEMPLE_ADDRESS=ecash:p… npm run create-wlotus-token
TIER=prayer npm run create-dryrun-token
BATON_INDEX=0 npm run mine-dryrun-once
```

See [CLOCK.md](./CLOCK.md). Deployments: `deployments/mainnet-dryrun-*.json`.

### Live Prayer dual-mint dryrun (mainnet)

| | |
|--|--|
| Token | [`d9004b41…ca5b`](https://explorer.e.cash/tx/d9004b411d4cbcd2ec16235d506efd6e266186153bd1a2b1db3a1d5118c2ca5b) (`dPRAYER`) |
| Mint / remint | **2** atoms → burn 1 + desk keep 1 |
| Bits | 24 (phone ~2 min class) |
| Prior mint=1 dryrun | archived under `deployments/mainnet-dryrun-prayer-archived-*.json` |

Hard next-P2SH + tipLocktime anti-rewind confirmed on-chain (no Ergon).

### Not for production

- **Ergon** (`WlotusPowRemintErgon`) — dogfood only  
- **Legacy Moore** (`WlotusPowRemintMoore`) — soft batonHash, +8 cap  
- Soft **PrayerTip** — superseded  

## Economics (production plan)

**Launch (decision):** [ECONOMICS_WLOTUS_GLOTUS.md](./ECONOMICS_WLOTUS_GLOTUS.md) — **wLotus** (mint 108 → 1 prayer + 107 temple mala; ceremonial) + **Golden Lotus** (permissionless; premine; event burns; no platform mint tax).

**Intent (settled):** anti-farm = **1/107 + fees** (sponsored Offer wins vs commercial miners even if energy ≈ 0); ritual = **attention** via soft pray timer + ~**24**-bit presence — not token-hashrate “security.” Details: that doc § *Product intent*.
Longer-term hardware ladder (background):

| Product | Bits | Mint | Target HW | Market $/baton |
|---------|------|------|-----------|----------------|
| Incense | 8 | 100 | fee | — (non-econ) |
| Prayer | 22 | 1 | phone | — (non-econ) |
| Candle | 43 | 1 | GPU ~2.4 h | ~$0.001 |
| Flower | 59 | 100 | ASIC ~1.6 h | **$1** |

[ECONOMICS.md](./ECONOMICS.md) · `npm run pricing`

## Vision

Burn wLotus = white lotus **in memorial of the dead** + **dana** for everybody (wealth destroyed; unlike vàng mã, no seller captures the gift). Full thesis: [VISION.md](./VISION.md).

## Offerings app (`apps/web`)

Minimal **Prayer-only** UI (mobile-first). No browser wallet yet — offerings via mint API.

| | |
|--|--|
| **Test site** | https://test.wlotus.org |
| **Local** | `npm run mint-api` + `npm run web` |
| **Token** | memorial mint `dPRAYER` `173e0260…6078` |

Desk MVP: **open race on 2 tips** (dPRAYER PoC), 1 fee UTXO/tip, `MINT_MAX_OPEN_CHALLENGES` caps concurrent jobs. Launch genesis must use **`POW_BATON_COUNT=28`** (ALP max; immutable).

Defaults to live memorial dryrun. See [ECONOMICS_PRAYER.md](./ECONOMICS_PRAYER.md).

## Test hosting (Contabo)

**Live:** https://test.wlotus.org

CI/CD: GitHub Actions → rsync → nginx on Contabo (`/var/www/wlotus-test`).

- Workflow: `.github/workflows/deploy-web-test.yml`
- Guide (local vs VM vs CI): [deploy/contabo/README.md](../deploy/contabo/README.md)

## Next

1. Adopt Prayer bootstrap (phone PoW → server mint 2: burn + inventory) — [ECONOMICS_PRAYER.md](./ECONOMICS_PRAYER.md)  
2. Dryrun Candle / Flower when funded for longer PoW  
3. Postage server for fee sponsorship  
4. Fractional-bit PoW if/when eCash raises the 201-op limit  
