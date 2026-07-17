# Repository status

Canonical home: **https://github.com/bcProFoundation/wlotus**

Scaffold was first drafted on a temporary orphan branch of `eminer`
(`cursor/wlotus-scaffold-d6bb`) while the Cursor GitHub App lacked push
access to this repo. That work is now landed here.

## Design sources

| Doc | Role |
|-----|------|
| [PROPOSAL.md](./PROPOSAL.md) | Product decision (ALP on eCash first; L1 deferred) |
| [SPEC.md](./SPEC.md) | Consensus draft parameters |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Covenant / multi-baton flow |
| [research/](./research/) | Feasibility notes from [eminer#1](https://github.com/bcProFoundation/eminer/pull/1) |

## Live

- **WLTEST** mainnet: `e64406bdda45fb46a642d9b6b2a949d9a12910046e3266e68158d7481e8b08a3`
  ([TEST_TOKEN.md](./TEST_TOKEN.md))

## Next ops

1. Harden `contracts/WlotusRemint.cash` + Chronik miner wiring  
2. Raise PoW from 1 → higher when targeting ~$0.01/token (`WLOTUS`)  
3. Temple / burn UI in a separate app repo  
