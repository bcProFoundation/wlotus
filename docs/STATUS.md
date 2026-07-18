# Repository status

Canonical home: **https://github.com/bcProFoundation/wlotus**

## Live dogfood

### Test Prayer tip (`tPRAYTIP`) — stateful tip + multi-baton

| | |
|--|--|
| Token | [`359edff6…5d6d`](https://explorer.e.cash/tx/359edff69708b24e63b3aef224bf8809060675d0b70005bf56c06c6375755d6d) |
| Remints | baton0 activity↑ [`b99e1d4a…b09f`](https://explorer.e.cash/tx/b99e1d4a6c0fda98d615f53325b2a0c6b2f097edfc018a4bfb2a951c8cdfb09f) → [`64dcb8c6…dfc9`](https://explorer.e.cash/tx/64dcb8c6c348c8ab0d507145592fb79589c6b50e17cba34ce1f04b53a646dfc9) (activity **2**, 3 zero bytes); baton1 independent [`a55408cb…b3dc`](https://explorer.e.cash/tx/a55408cbf984ecc484f9ab2d506131fe2b4c6c0912fa5150a931241acb11b3dc) (activity **1**) |
| Mode | Mutating tip P2SH; gap&lt;60s bumps activity; **2** batons |

```bash
npm run create-prayer-tip-pow-token
PRAYER_TIP_RAPID=1 npm run mine-prayer-tip-once
```

See [CLOCK.md](./CLOCK.md). Deployment: `deployments/mainnet-prayer-tip-test.json`.

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
4. Harden tip nextRedeem binding beyond soft hash160 + tip args  
