# Repository status

Canonical home: **https://github.com/bcProFoundation/wlotus**

## Production dryrun (MooreTip hard-bind)

Covenant: `WlotusPowRemintMooreTip` — Moore calendar D + tipLocktime + **hard next-P2SH** (`prefixHash`/`codeHash`).

Whole-byte PoW only (`bits % 8 == 0`) so the redeem fits eCash’s **201-op** limit together with hard bind. Dryrun bases (nearby the phone/GPU/ASIC targets):

| Tier | Dryrun bits | Mint | Script |
|------|-------------|------|--------|
| Prayer | 24 | 1 | `TIER=prayer npm run create-dryrun-token` |
| Candle | 40 | 1 | `TIER=candle npm run create-dryrun-token` |
| Flower | 56 | 100 | `TIER=flower npm run create-dryrun-token` |

```bash
TIER=prayer npm run create-dryrun-token
BATON_INDEX=0 npm run mine-dryrun-once
BATON_INDEX=1 npm run mine-dryrun-once
```

See [CLOCK.md](./CLOCK.md). Deployments: `deployments/mainnet-dryrun-*.json`.

### Live Prayer dryrun (mainnet)

| | |
|--|--|
| Token | [`a108b17f…4914`](https://explorer.e.cash/tx/a108b17f5050e354641c7de26d16d97e6a1019dd0a273e92bc8aced2fff74914) (`dPRAYER`) |
| Remint baton 0 | [`c79039b5…bfca`](https://explorer.e.cash/tx/c79039b5e8d5fe2b45701e881fdc211d15d069899aa7f061db7e324fef38bfca) |
| Remint baton 1 | [`bd8ac640…e7bd`](https://explorer.e.cash/tx/bd8ac64005c2105271c51ba3c67f783c879ac7e81a4ff4d9b75ac4e3a33fe7bd) |

Hard next-P2SH + tipLocktime anti-rewind confirmed on-chain (no Ergon).

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

## Offerings app (`apps/web`)

Migrated from Lotus Temple UX → **WLotus** branding. Burns **Prayer** (ALP); fees in **XEC** (postage later).

```bash
npm run web
```

Defaults to live dryrun `dPRAYER` (`a108b17f…4914`).

## Test hosting (Contabo)

CI/CD for `apps/web`: GitHub Actions → rsync → nginx on Contabo.

- Workflow: `.github/workflows/deploy-web-test.yml`
- VM bootstrap: `deploy/contabo/`

## Next

1. Wire Contabo secrets + first test deploy  
2. Dryrun Candle / Flower when funded for longer PoW  
3. Postage server for fee sponsorship  
4. Fractional-bit PoW if/when eCash raises the 201-op limit  
