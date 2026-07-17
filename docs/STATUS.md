# Repository status

Canonical home: **https://github.com/bcProFoundation/wlotus**

## Live incubation — **mWLOTUS**

| | |
|--|--|
| Role | Cheap PoW token so anyone can mine & burn before the app |
| Economics | Always **100.00**/remint @ **2** decimals; ~**$0.00001**/token; 1-byte PoW |
| Peg | **1000 mWLOTUS ≈ 1 WLOTUS** (later launch @ ~$0.01/token) |
| Docs | [ECONOMICS.md](./ECONOMICS.md) · [TEST_TOKEN.md](./TEST_TOKEN.md) |

```bash
npm run mine-once
```

## Design sources

| Doc | Role |
|-----|------|
| [ECONOMICS.md](./ECONOMICS.md) | Ritual loop, mWLOTUS ↔ WLOTUS, Moore-on-work |
| [PROPOSAL.md](./PROPOSAL.md) | Product decision (ALP on eCash first) |
| [SPEC.md](./SPEC.md) | Consensus draft |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Covenant / multi-baton flow |

## Covenant notes (eCash)

- No native introspection → Spedn Mist-style BIP143 preimage covenant
- Mint size **fixed**; Moore δ schedules **work** (lib + future stateful D)

## Next

1. Temple / burn app (separate repo) against mWLOTUS  
2. Stateful Moore-on-difficulty covenant revision  
3. WLOTUS genesis (~1000× difficulty) + conversion UX  
