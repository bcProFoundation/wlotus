# Repository status

Canonical home: **https://github.com/bcProFoundation/wlotus**

## Live mainnet

| Token | Mode | Token ID | Mine? |
|-------|------|----------|-------|
| **WLPOW** | PoW covenant | `2c5d106eec1fbe5f266d762c7d523f4467438e144c10a3a8e633a654b978e546` | **Yes** |
| WLTEST | Custodial | `e64406bdda45fb46a642d9b6b2a949d9a12910046e3266e68158d7481e8b08a3` | No |

Proven PoW remint: `3c37dd37aa846819af11dadba22afe8c707fa07ae9751f5147118dbd0eeef80a`

Details: [TEST_TOKEN.md](./TEST_TOKEN.md)

## Design sources

| Doc | Role |
|-----|------|
| [PROPOSAL.md](./PROPOSAL.md) | Product decision (ALP on eCash first; L1 deferred) |
| [SPEC.md](./SPEC.md) | Consensus draft parameters |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Covenant / multi-baton flow |
| [research/](./research/) | Feasibility notes from [eminer#1](https://github.com/bcProFoundation/eminer/pull/1) |

## Covenant notes (eCash)

- eCash has **no** native introspection opcodes (`OP_OUTPUTBYTECODE`, etc.).
- PoW remint uses a **Spedn Mist-style BIP143 preimage** covenant (`contracts/WlotusPowRemint.spedn`).
- Unlock: PoW nonce + Schnorr `Sig` + `DataSig` (toDataSig) + miner pubkey + preimage.
- Difficulty for dogfood: **1 leading zero byte** on `hash256(preimage ‖ nonce)`.

## Next ops

1. Raise PoW from 1 → higher when targeting ~$0.01/token (`WLOTUS`)
2. Temple / burn UI in a separate app repo
3. Optional: multi-baton concurrent miner
