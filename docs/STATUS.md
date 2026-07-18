# Repository status

Canonical home: **https://github.com/bcProFoundation/wlotus**

## Live incubation tokens

### Moore-bit + WLDF v1

Token [`c7fe2bf2…77dc`](https://explorer.e.cash/tx/c7fe2bf272c9d8ab08e17202a33397294a24ec96e47b06d849f998972d5a77dc) · remint [`a5180012…dbfa`](https://explorer.e.cash/tx/a51800126256ac7249f25377b3a0b9149d5ef37aa848555a504849ddab0bdbfa)

### Ergon daily-δ + WLDF v2

Token [`de640661…0e8e`](https://explorer.e.cash/tx/de640661109f9a56d6404a7a68d054d01094958f466dc01bdc1c4e23f1a50e8e) · remint [`a0fe1941…9fe6`](https://explorer.e.cash/tx/a0fe1941aaa5a4e590140956ea4a890489e10a5d0cfd1d65712063401d9e9fe6)

## Economics (canonical)

**Non-economic:** Incense (fee/trivial) · Prayer (~30 s phone).  
**Economic:** Candle (**1/10** Flower token, **10**/baton, ~52 bits) · Flower (**$1**, 100/baton, **59 bits**).  
Fine grain → **mFlower** later, not 1/1000 Candle.

| Product | Bits | Mint | Weak 1 TH/s | ASIC 100 TH/s | Market $/baton |
|---------|------|------|-------------|---------------|----------------|
| Incense | 8 | 100 | &lt;1 ms | &lt;1 ms | — |
| Prayer | 22 | 1 | &lt;1 ms | &lt;1 ms | — |
| Candle | 52 | 10 | **~1.6 h** | **~56 s** | **$0.01** |
| Flower | 59 | 100 | ~6.5 d | **~1.6 h** | **$1** |

[ECONOMICS.md](./ECONOMICS.md) · `npm run pricing`

## Next

1. Temple burn UX: free incense / pray; buy Candle/Flower  
2. Flower + Candle genesis on economic bits  
3. Optional mFlower for fine units  
