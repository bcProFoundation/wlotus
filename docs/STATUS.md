# Repository status

Canonical home: **https://github.com/bcProFoundation/wlotus**

## Production dryrun (MooreTip hard-bind)

Covenant: `WlotusPowRemintMooreTip` — Moore calendar D + tipLocktime + **hard next-P2SH** (`codeHash`).

| Tier | Bits | Mint | Script |
|------|------|------|--------|
| Prayer | 22 | 1 | `TIER=prayer npm run create-dryrun-token` |
| Candle | 43 | 1 | `TIER=candle npm run create-dryrun-token` |
| Flower | 59 | 100 | `TIER=flower npm run create-dryrun-token` |

```bash
TIER=prayer npm run create-dryrun-token
BATON_INDEX=0 npm run mine-dryrun-once
BATON_INDEX=1 npm run mine-dryrun-once
```

See [CLOCK.md](./CLOCK.md). Deployments: `deployments/mainnet-dryrun-*.json`.

### Not for production

- **Ergon** (`WlotusPowRemintErgon`) — dogfood only  
- **Legacy Moore** (`WlotusPowRemintMoore`) — soft batonHash, +8 cap  
- Soft **PrayerTip** — superseded  

## Economics (production plan)

| Product | Bits | Mint | Target HW | Market $/baton |
|---------|------|------|-----------|----------------|
| Incense | 8 | 100 | fee | — (non-econ) |
| Prayer | 22 | 1 | phone | — (non-econ) |
| Candle | 43 | 1 | GPU ~2.4 h | ~$0.001 |
| Flower | 59 | 100 | ASIC ~1.6 h | **$1** |

[ECONOMICS.md](./ECONOMICS.md) · `npm run pricing`

## Next

1. Dryrun Prayer remints on mainnet with MooreTip  
2. Dryrun Candle / Flower when funded for longer PoW  
3. Temple burn UX  
