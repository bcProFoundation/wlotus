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
- Mint size **fixed**; Moore adjusts **work**
- Remint has exactly 3 covenant outputs — `mine-once` splits small fuel first

### Moore-bit dogfood (fine grain)

```bash
npm run create-moore-pow-token && npm run mine-moore-once
```

- Contract: `WlotusPowRemintMoore` — `bits = base + floor((nLockTime − genesis) / secondsPerExtraBit)`
- Test schedule: **+1 bit / day** (prod ≈ +1 bit / ~845 days)
- Redeem size-capped (BIP143 preimage push < 520B) → OP_RETURN is ALP MINT only; WLDF dual-EMPP deferred
- P2SH address stays stable; D comes from locktime; miner sets locktime ≤ MTP

## Next

1. Temple / burn app against mWLPOW  
2. Harden Moore (shared clock / anti-past-locktime) for production  
3. WLOTUS genesis (~1000× difficulty) + conversion UX  
