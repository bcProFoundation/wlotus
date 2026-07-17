# Test token deployments (mainnet)

## Which token for mining?

| Token | Mode | Mineable? |
|-------|------|-----------|
| **WLPOW** | PoW covenant (Spedn BIP143 preimage) | **Yes** — use this |
| WLTEST | Custodial genesis wallet | No (batons not in PoW covenant) |

## Live PoW token (`WLPOW`) — use for mining tests

| Field | Value |
|-------|-------|
| Ticker | `WLPOW` |
| Name | White Lotus PoW Test |
| Token ID | `2c5d106eec1fbe5f266d762c7d523f4467438e144c10a3a8e633a654b978e546` |
| Mode | **PoW** (not custodial) |
| PoW P2SH | `ecash:pz0k74f8nkytqh7ntcjhfaccc7wytjdj9ypy8f9z32` |
| Decimals | 6 |
| Mint atoms / remint | 100,000,000 (100 WLPOW) |
| PoW leading zero bytes | 1 |
| Batons | 4 (locked in PoW P2SH) |
| Proven remint | `3c37dd37aa846819af11dadba22afe8c707fa07ae9751f5147118dbd0eeef80a` |

- Explorer: https://explorer.e.cash/tx/2c5d106eec1fbe5f266d762c7d523f4467438e144c10a3a8e633a654b978e546
- Cashtab: https://cashtab.com/#/token/2c5d106eec1fbe5f266d762c7d523f4467438e144c10a3a8e633a654b978e546
- Record: [`deployments/mainnet-pow-token.json`](../deployments/mainnet-pow-token.json)
- Last remint: [`deployments/mainnet-last-remint.json`](../deployments/mainnet-last-remint.json)

```bash
# .env must contain GENESIS_SK_HEX (same wallet that funded genesis)
npm run mine-once
```

## Custodial token (`WLTEST`) — not for PoW mining

| Field | Value |
|-------|-------|
| Ticker | `WLTEST` |
| Token ID | `e64406bdda45fb46a642d9b6b2a949d9a12910046e3266e68158d7481e8b08a3` |
| Mode | **Custodial** |
| Mint batons | Genesis wallet (some later sent to broken introspection P2SH → locked) |

- Record: [`deployments/mainnet-test-token.json`](../deployments/mainnet-test-token.json)

## Goals

| Knob | Test now | Later |
|------|----------|-------|
| Target price | **~$0.000001 / token** | **~$0.01 / token** |
| PoW leading zero bytes | `1` | raise (2–3+) |
| Ticker | `WLPOW` / `WLTEST` | `WLOTUS` |

## Chronik

```
https://chronik.e.cash
https://xec.paybutton.org
https://chronik.pay2stay.com/xec
```

## Recreate PoW token

```bash
npm run create-pow-token   # genesis + handoff batons to Spedn PoW P2SH
npm run mine-once          # one remint
```

## Locked predecessors (do not use)

- Introspection P2SH handoff (eCash has no native introspection opcodes)
- `mainnet-pow-token-v1-locked.json` — `size-56` trailer bug
- `mainnet-pow-token-v2-locked.json` — Spedn `0x00` empty-push mint bug
