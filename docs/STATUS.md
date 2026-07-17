# Repository status

Canonical home: **https://github.com/bcProFoundation/wlotus**

## Live incubation tokens

### Moore-bit (+1 bit/day steep test) + WLDF v1

| | |
|--|--|
| Token | [`c7fe2bf2…77dc`](https://explorer.e.cash/tx/c7fe2bf272c9d8ab08e17202a33397294a24ec96e47b06d849f998972d5a77dc) |
| Remint | [`a5180012…dbfa`](https://explorer.e.cash/tx/a51800126256ac7249f25377b3a0b9149d5ef37aa848555a504849ddab0bdbfa) (WLDF bits=9) |

```bash
npm run create-moore-pow-token && npm run mine-moore-once
```

### Ergon daily-δ (99918/100000) + WLDF v2

| | |
|--|--|
| Token | [`de640661…0e8e`](https://explorer.e.cash/tx/de640661109f9a56d6404a7a68d054d01094958f466dc01bdc1c4e23f1a50e8e) |
| Remint | [`a0fe1941…9fe6`](https://explorer.e.cash/tx/a0fe1941aaa5a4e590140956ea4a890489e10a5d0cfd1d65712063401d9e9fe6) (day=1, target=16763458) |
| δ | `target' = floor(target · 99918 / 100000)` per Moore day |

```bash
npm run create-ergon-pow-token && npm run mine-ergon-once
```

Economics: ritual **offer** ladder (Prayer → Incense → Candle → Flower). Mint atoms **1 / 1 / 10 / 100**. **Start with Incense** (or Prayer). Parallel OK.

**Flower (WLotus) = $1/baton market** + **40%** new-market risk margin. Work: Prayer≈Incense/10 · Candle=Incense×100 · Flower=Candle×100.

| Product | Bits | Tokens/baton | Phone | PC | Market $/baton |
|---------|------|--------------|-------|-----|----------------|
| **Prayer** | 22 | 1 | **~28 s** | ~5 s | ~$10⁻⁷ |
| **Incense** | 25 | 1 | **~3.7 min** | ~40 s | ~$10⁻⁶ |
| **Candle** | 32 | 10 | **~8 h** | ~1.4 h | ~$10⁻³ |
| **Flower** | 38 | 100 | ~21 d | ~3.7 d | **$1** |

[ECONOMICS.md](./ECONOMICS.md) · `npm run pricing`

## Covenant notes (eCash)

- No native introspection → Spedn Mist-style BIP143 + `OP_CODESEPARATOR`
- Mint size **fixed**; Moore/Ergon adjust **work** (WLDF in eMPP)
- Remint has exactly 3 covenant outputs — miners split small fuel first

## Next

1. Temple / burn app against mWLPOW  
2. Harden Moore (shared clock / anti-past-locktime) for production  
3. Flower (WLotus) genesis (~38 bits, $1/baton market) + conversion UX
4. Optional Prayer @ 22 bits for ~30 s offers 
