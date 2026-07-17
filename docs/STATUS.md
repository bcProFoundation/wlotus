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

## Next ops

1. Chipnet GENESIS with `N` PoW batons  
2. Harden `contracts/WlotusRemint.cash` + Chronik miner wiring  
3. Temple / burn UI in a separate app repo  
