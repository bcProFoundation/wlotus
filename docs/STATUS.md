# Repository status

Canonical home: **https://github.com/bcProFoundation/wlotus**

## Live dogfood

### Test Prayer tip (`tPRAYTIP`) — Moore D + tip anti-rewind

| | |
|--|--|
| Token | [`fd1abc1a…69aa`](https://explorer.e.cash/tx/fd1abc1a8edb51adcad808be380b916b72b58344348be61a28973a918e8d69aa) |
| Remints | [`a0a3e7aa…5c2b`](https://explorer.e.cash/tx/a0a3e7aa3369e60b5cc938407ced723b78fccf797ca2fccbcac9957cc2245c2b) · [`fdea0bf7…879b`](https://explorer.e.cash/tx/fdea0bf7ce5c38f51f53a926a1bc7b1f7d0941995ea8210c6d53f9bd3ba9879b) · [`ed1a9e92…d874`](https://explorer.e.cash/tx/ed1a9e92cef94c1df017313d5d37efa637ffe7b7a4701f9520a182e6d5bcd874) — all **bits=8** (Moore day 0; no activity bump) |
| Mode | Moore calendar D + tipLocktime + **2** batons |

```bash
npm run create-prayer-tip-pow-token
BATON_INDEX=0 npm run mine-prayer-tip-once
BATON_INDEX=1 npm run mine-prayer-tip-once
```

See [CLOCK.md](./CLOCK.md).

### Test Prayer (`tPRAYER`) — non-economic toy PoW (fixed-D)

| | |
|--|--|
| Token | [`04317ffa…e352`](https://explorer.e.cash/tx/04317ffa6983692fa0ef326c6a8fcb75135fddfca5ece62f918aa73a7902e352) |
| Remint | [`0a7693fb…e15c`](https://explorer.e.cash/tx/0a7693fbe7d68276809b2bc2d3fafd20893873ec69a6d670c096759c74b7e15c) (**1** atom) |
| Mode | Fixed-D, 1 leading zero byte, **no height clock** |

```bash
npm run create-prayer-pow-token && npm run mine-prayer-once
```

### Moore-bit + Ergon mWLPOW (earlier toys)

Moore [`c7fe2bf2…77dc`](https://explorer.e.cash/tx/c7fe2bf272c9d8ab08e17202a33397294a24ec96e47b06d849f998972d5a77dc) · Ergon [`de640661…0e8e`](https://explorer.e.cash/tx/de640661109f9a56d6404a7a68d054d01094958f466dc01bdc1c4e23f1a50e8e)

## Economics (production plan)

| Product | Bits | Mint | Target HW | Market $/baton |
|---------|------|------|-----------|----------------|
| Incense | 8 | 100 | fee | — (non-econ) |
| Prayer | 22 | 1 | phone | — (non-econ) |
| Candle | 43 | 1 | GPU ~2.4 h | ~$0.001 |
| Flower | 59 | 100 | ASIC ~1.6 h | **$1** |

**Clock:** covenant cannot read chain height — [CLOCK.md](./CLOCK.md). Moore/Ergon miners set `nLockTime ≤ MTP` via Chronik. Tip test uses mutating P2SH.

[ECONOMICS.md](./ECONOMICS.md) · `npm run pricing`

## Next

1. Real Prayer @ 22 bits / Incense fee-tier  
2. Candle @ 43 + Flower @ 59 genesis  
3. Temple burn UX  
4. More batons (N≫2) when concurrent prayer load needs it — D stays fixed  
