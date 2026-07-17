# Repository status

Canonical home: **https://github.com/bcProFoundation/wlotus**

## Live incubation — **mWLPOW**

| | |
|--|--|
| Role | Cheap PoW token so anyone can mine & burn before the app |
| Economics | Always **100**/remint @ **0** decimals; ~**$0.00001**/token; 1-byte PoW |
| Peg | **1000 mWLPOW ≈ 1 WLOTUS** (later launch @ ~$0.01/token) |
| Docs | [ECONOMICS.md](./ECONOMICS.md) · [TEST_TOKEN.md](./TEST_TOKEN.md) |

```bash
npm run create-pow-token && npm run mine-once
# or: npm run wait-create-mwlotus
```

## Covenant notes (eCash)

- No native introspection → Spedn Mist-style BIP143 preimage covenant
- Mint size **fixed**; Moore δ schedules **work** (lib + future stateful D)
- Remint has exactly 3 covenant outputs — `mine-once` splits small fuel first

## Next

1. Temple / burn app against mWLPOW  
2. Stateful Moore-on-difficulty covenant revision  
3. WLOTUS genesis (~1000× difficulty) + conversion UX  
