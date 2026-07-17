# Repository status

Canonical home: **https://github.com/bcProFoundation/wlotus**

## Live incubation — **mWLPOW** (Moore-bit dogfood)

| | |
|--|--|
| Role | Cheap PoW token so anyone can mine & burn before the app |
| Economics | Always **100**/remint @ **0** decimals; ~**$0.00001**/token |
| Difficulty | Locktime-derived **bits** (+1 bit/day test); proven remint at **bits=9** |
| Peg | **1000 mWLPOW ≈ 1 WLOTUS** (later launch @ ~$0.01/token) |
| Token | [`edb72730…3dfe`](https://explorer.e.cash/tx/edb727306f7dfbbf051eacfebf29fe3fd6f27b3ee8bc3598bd4a70884ca43dfe) |
| Remint | [`8ef4607d…c7aa`](https://explorer.e.cash/tx/8ef4607dbbe6ed88894d65a36a86ed66a48df41cb5ae072ec45db30811f3c7aa) (387 attempts) |
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
- Redeem size-capped (BIP143 preimage push < 520B) → OP_RETURN is ALP MINT only; WLDF dual-EMPP deferred
- P2SH address stays stable; D comes from locktime; miner sets locktime ≤ MTP

## Next

1. Temple / burn app against mWLPOW  
2. Harden Moore (shared clock / anti-past-locktime) for production  
3. WLOTUS genesis (~1000× difficulty) + conversion UX  
