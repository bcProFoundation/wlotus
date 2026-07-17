# Repository status

Canonical home: **https://github.com/bcProFoundation/wlotus**

## Live incubation — **mWLPOW** (Moore-bit + eMPP WLDF)

| | |
|--|--|
| Role | Cheap PoW token so anyone can mine & burn before the app |
| Economics | Always **100**/remint @ **0** decimals; ~**$0.00001**/token |
| Difficulty | Locktime-derived **bits** (+1 bit/day test); **WLDF** EMPP stores D |
| Peg | **1000 mWLPOW ≈ 1 WLOTUS** (later launch @ ~$0.01/token) |
| Token | [`c7fe2bf2…77dc`](https://explorer.e.cash/tx/c7fe2bf272c9d8ab08e17202a33397294a24ec96e47b06d849f998972d5a77dc) |
| Remint | [`a5180012…dbfa`](https://explorer.e.cash/tx/a51800126256ac7249f25377b3a0b9149d5ef37aa848555a504849ddab0bdbfa) (WLDF bits=9) |
| Docs | [ECONOMICS.md](./ECONOMICS.md) · [TEST_TOKEN.md](./TEST_TOKEN.md) |

```bash
npm run create-moore-pow-token && npm run mine-moore-once
# fixed-D legacy: npm run create-pow-token && npm run mine-once
```

## Covenant notes (eCash)

- No native introspection → Spedn Mist-style BIP143 preimage covenant
- Mint size **fixed**; Moore adjusts **work**
- Remint has exactly 3 covenant outputs — `mine-once` splits small fuel first

### Moore-bit dogfood (fine grain)

```bash
npm run create-moore-pow-token && npm run mine-moore-once
```

- Contract: `WlotusPowRemintMoore` — `bits = base + floor((nLockTime − genesis) / secondsPerExtraBit)`
- Test schedule: **+1 bit / day** (prod ≈ +1 bit / ~845 days)
- **eMPP WLDF** stores difficulty beside ALP MINT (Agora dual-push); covenant binds `hashOutputs`
- `OP_CODESEPARATOR` keeps BIP143 preimage under the 520B push limit
- P2SH address stays stable; miner sets locktime ≤ MTP

## Next

1. Temple / burn app against mWLPOW  
2. Harden Moore (shared clock / anti-past-locktime) for production  
3. WLOTUS genesis (~1000× difficulty) + conversion UX  
