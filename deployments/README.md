# Deployments

On-chain records for W Lotus genesis / remint. **Live token ids** are on the
desks, not necessarily in this folder — see [docs/STATUS.md](../docs/STATUS.md)
and `GET /api/status`.

Tip state (`powAddress`, `lastRemintTxid`, `batonTips`) is written by mint-api
on the VM. Those files often **block `git pull`** and should not be committed
from the server.

## Live (102 miner + 6 temple)

Created on the Contabo VMs; usually **untracked** here.

| File (on VM) | Meaning |
|--------------|---------|
| `mainnet-wlotus.json` | Prod **WLOTUS** — `/opt/wlotus` on wlotus.org |
| `mainnet-dryrun-wlotus.json` | Test **dWLOTUS** — `/opt/wlotus` on test.wlotus.org |
| `mainnet-dryrun-active.json` | Alias of the active dryrun (mint-api fallback) |

Copies of the dryrun JSON in git may be an **older 1/107** genesis. If
`mintSplit.temple` is `"107"`, ignore that file and use `/api/status`.

After the failed felt cutover (#251), git `mainnet-wlotus.json` may be test
token `fcf7de59…` with `"role": "production"`. **That is not prod.** Live
prod is `a41bf9d0…` on wlotus.org. Deploy workflows must restore the VM copy
of this file after `git checkout --force` / `git reset --hard`.

## Incubation / dogfood (not the live desks)

Older experiments (Ergon / Moore / Prayer / mWLOTUS). Keep for archaeology.

| File | Meaning |
|------|---------|
| `mainnet-mwlotus.json` / `mainnet-pow-token.json` | Early **mWLOTUS** PoW token |
| `mainnet-*-archived-*.json` | Superseded genesis / remint records |
| `mainnet-pow-token-v*-locked.json` | Broken predecessor covenants |
| `mainnet-test-token.json` | Custodial **WLTEST** (not for mining) |
| `mainnet-dglotus.json` | Dogfood **dGLOTUS** — felt +1 bit MooreTip, no temple tax |

Private keys live only in `.env` (gitignored). Never commit `GENESIS_SK_HEX`.
