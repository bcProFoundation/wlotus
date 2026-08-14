# Prod cutover: last release → 102/6 WLOTUS

**Status: completed (2026-08).** Prod tag **[`v26.8.0`](https://github.com/bcProFoundation/wlotus/releases/tag/v26.8.0)**. Both https://wlotus.org and https://test.wlotus.org serve **102 miner + 6 temple**. Live ids: [docs/STATUS.md](../../docs/STATUS.md). **Do not treat this file as the next deploy.**

The remainder is the historical runbook from tag **`v26.7.12`** (2026-07-31), when prod still served mint **108** = **1** miner + **107** temple.

The split is baked into the ALP remint Script. **Code deploy cannot change it.**
You must create a **new live `WLOTUS` genesis**, then retarget mint-api,
dana-index, and the SPA.

Generic first-time prod setup (VM, DNS, TLS, GitHub Environment) stays in
[PROD.md](./PROD.md). This file is the **ordered cutover** from that last tag.

---

## Current vs target

| | On prod now (`v26.7.12`) | After this cutover |
|--|--------------------------|--------------------|
| Tag | `v26.7.12` | new `v*` on **current `master`** (e.g. `v26.8.0`) |
| Ticker | `WLOTUS` | `WLOTUS` (new `tokenId`) |
| ALP name | `wLotus` (typical of that genesis) | **W Lotus** |
| Remint split | **1** miner + **107** temple | **102** miner + **6** temple |
| Premine (108) | genesis wallet (typical) | **temple P2SH** |
| Site / desk / index | old `tokenId` | **new** `tokenId` only |

Old memorials stay valid **on-chain for the old token**. They must not appear
as live history on wlotus.org after dana-index is retargeted.

Confirm before touching anything:

```bash
curl -sS https://wlotus.org/api/status | jq '{ticker,tokenId,mintAtoms,name,deployedAt}'
# If the VM JSON is reachable:
jq '{ticker,name,tokenId,mintSplit,initialMintAddress,templeAddress}' \
  /opt/wlotus/deployments/mainnet-wlotus.json
```

Expect `mintSplit.temple == "107"` (or missing `mintSplit` on a very old record).
If it already shows `"6"`, stop — genesis was already recut.

---

## What else this release includes (since `v26.7.12`)

Tagging current `master` also ships everything merged after 31 Jul, including:

- **New covenant / genesis params** — 102/6, name **W Lotus**, premine to temple
- **Fee path** — desk peels one ~40 XEC fuel onto the mint/tip address; leftover
  XEC stays on mint receive (do not sweep back to desk during an offering)
- **Offer UI** — Dâng Hoa session, elapsed time, related altars, search,
  living-profile / relationship work, PWA title **W Lotus**
- **Temple specials** — Vu Lan + Cô Hồn are **not** created by tagging.
  After the new genesis, burn two root altars (`npm run create-temple-specials`)
  and register `TEMPLE_SPECIALS_JSON` on mint-api (step 8). See
  [TEMPLE_SPECIALS.md](../../docs/TEMPLE_SPECIALS.md).
- **Ops** — `MINT_REQUIRE_LIVE=1`, www→apex redirect, `/sw.js` `Cache-Control: no-cache`

Test (`test.wlotus.org`) already tracks `master` on every push. Prod does **not**
until you push a `v*` tag.

---

## Do not

- Tag `master` **before** the new genesis is live on the VM. New mint-api
  **builds** remint outputs as `[102, 6]`. That will not redeem the old 1/107
  batons.
- Reuse the **test** mnemonic, `GENESIS_SK_HEX`, or `dWLOTUS` JSON on prod.
- Point dana-index at the new `tokenId` while leaving the old burns JSON in
  place (the store is not filtered by token on read).
- Set GitHub secret `MINT_MNEMONIC_PROD` for this tag if `/etc/wlotus/mint.env`
  already has `MINT_REQUIRE_LIVE=1`. The prod workflow **rewrites** that file
  to only `MINT_MNEMONIC` + `MINT_API_PORT` and would drop the live pin.
  Leave the secret unset; the mnemonic stays on the VM.
- Run `npm run new-wallet -- --force` unless the genesis wallet is truly empty
  and you intend to replace `GENESIS_SK_HEX`.
- Skip `create-temple-specials` if you want Vu Lan / Cô Hồn on this token —
  genesis does not create those roots. JSON without on-chain burns will not
  show in search or accept re-offers.

---

## Prerequisites

On your laptop / GitHub:

- [ ] `master` is the code you want (includes 102/6 + fee-path fixes)
- [ ] Environment **`production`**: `CONTABO_PROD_*` SSH secrets work
- [ ] `VITE_PRAYER_TICKER=WLOTUS` (you will change `VITE_PRAYER_TOKEN_ID` in step 8)
- [ ] `MINT_MNEMONIC_PROD` **unset** (or you will restore `mint.env` after the tag)

On the **prod VM** (SSH as `deploy` / root as noted):

- [ ] `/opt/wlotus` clone + `/etc/wlotus/mint.env` (existing **prod** desk mnemonic)
- [ ] `GENESIS_SK_HEX` in `/opt/wlotus/.env` (same key as the last live genesis is fine)
- [ ] Genesis address has **≥ ~920 XEC** (28 baton handoffs):
      `grep GENESIS_ADDRESS /opt/wlotus/.env` then check the explorer / Chronik.
      Do **not** run `npm run new-wallet -- --force` unless you intend to replace the key.
- [ ] Prod **temple P2SH** (`ecash:p…`). Reuse the current one from the archived JSON
      (`templeAddress`). Do not wrap a P2PKH.

Announce a short freeze if people may offer during the cutover.

---

## Procedure

### 1. Freeze the desk

```bash
sudo systemctl stop wlotus-mint-api
curl -sS -o /dev/null -w '%{http_code}\n' https://wlotus.org/api/status || true
```

Leave dana-index up until step 7 (or stop it too if you prefer a hard freeze).

### 2. Pull current `master` onto `/opt/wlotus`

Prod CI checks out **tags** (detached HEAD). Switch back to `master` before genesis:

```bash
sudo -u deploy -H bash -lc '
  set -euo pipefail
  cd /opt/wlotus
  git fetch origin master
  git checkout master
  git pull origin master
  npm ci
  git log -1 --oneline
'
```

If `git pull` refuses because of local `deployments/mainnet-wlotus.json`,
move that file aside (step 3 does this anyway), then pull.

### 3. Archive the old live record

```bash
sudo -u deploy mkdir -p /opt/wlotus/deployments/archive
sudo -u deploy bash -lc '
  set -euo pipefail
  cd /opt/wlotus
  src=deployments/mainnet-wlotus.json
  dst="deployments/archive/mainnet-wlotus-1-107-$(date +%Y%m%d%H%M%S).json"
  cp -a "$src" "$dst"
  echo "archived $dst"
  jq "{ticker,name,tokenId,mintSplit,templeAddress,initialMintAddress}" "$dst"
'
```

Keep that `templeAddress` for step 4. The create script also archives the live
path if it still exists.

### 4. Create the new live genesis (102 miner + 6 temple)

On the prod VM, as the user that owns `/opt/wlotus` (usually `deploy`):

```bash
cd /opt/wlotus
set -a && source .env && set +a          # GENESIS_SK_HEX
set -a && source /etc/wlotus/mint.env && set +a   # not required for genesis

# Paste templeAddress from the archive jq in step 3 (must be ecash:p…):
export TEMPLE_ADDRESS=ecash:p…
echo "TEMPLE_ADDRESS=$TEMPLE_ADDRESS"

BATONS=28 TEMPLE_ADDRESS="$TEMPLE_ADDRESS" npm run create-wlotus-token
# same as: npm run create-prod-token
```

Need **≥ ~920 XEC** on `GENESIS_ADDRESS`. The script writes
`deployments/mainnet-wlotus.json` (untracked — tag checkout will **not** delete it).

Confirm **before** restarting mint-api:

```bash
jq '{ticker,name,tokenId,mintAtomsPerRemint,mintSplit,initialMintAddress,templeAddress,role,powBatonCount}' \
  deployments/mainnet-wlotus.json
```

Required:

- `ticker`: `WLOTUS`
- `name`: `W Lotus`
- `mintSplit`: `{ "miner": "102", "temple": "6" }`
- `initialMintAddress` == `templeAddress` (P2SH)
- `role`: `production`
- `powBatonCount`: `28`

```bash
NEW_ID=$(jq -r .tokenId deployments/mainnet-wlotus.json)
echo "NEW_ID=$NEW_ID"
# Optional smoke remint (genesis wallet as miner+fuel) — skip if you will
# offer through the site instead:
# TIER=wlotus BATON_INDEX=0 TOKEN_ID="$NEW_ID" npm run mine-dryrun-once
```

### 5. Pin mint-api to the live file

```bash
sudo grep -E 'MINT_REQUIRE_LIVE|MINT_DEPLOYMENT_JSON|MINT_MNEMONIC|MINT_SERVING' /etc/wlotus/mint.env
```

`mint.env` must include (keep the existing mnemonic):

```bash
MINT_REQUIRE_LIVE=1
MINT_DEPLOYMENT_JSON=deployments/mainnet-wlotus.json
MINT_SERVING_TIP_COUNT=1
```

If those lines are missing, append them — do **not** replace the mnemonic:

```bash
sudo tee -a /etc/wlotus/mint.env >/dev/null <<'EOF'
MINT_REQUIRE_LIVE=1
MINT_DEPLOYMENT_JSON=deployments/mainnet-wlotus.json
MINT_SERVING_TIP_COUNT=1
EOF
sudo chmod 640 /etc/wlotus/mint.env
sudo chown root:deploy /etc/wlotus/mint.env
```

### 6. Refuel tip wallets + start mint-api

Same **prod** desk mnemonic as before. Tips only hold ~40 XEC fuels; treasury
stays on the desk.

```bash
cd /opt/wlotus
set -a && source /etc/wlotus/mint.env && set +a
sudo -u deploy -H bash -lc 'cd /opt/wlotus && set -a && source /etc/wlotus/mint.env && set +a && npm run fund-tip-fee-wallets'

sudo systemctl start wlotus-mint-api
sleep 2
curl -sS --fail-with-body http://127.0.0.1:8787/api/status | jq '{ticker,tokenId,mintAtoms,servingTipCount}'
```

`tokenId` must equal `NEW_ID`. If you see `dWLOTUS`, live JSON was not loaded —
fix `MINT_REQUIRE_LIVE` / path and restart.

### 7. Retarget dana-index (wipe old-token store)

```bash
NEW_ID=$(jq -r .tokenId /opt/wlotus/deployments/mainnet-wlotus.json)

sudo tee /etc/wlotus/dana-index.env >/dev/null <<EOF
TOKEN_ID=${NEW_ID}
CHRONIK_URLS=https://chronik.e.cash,https://xec.paybutton.org,https://chronik.pay2stay.com/xec
DANA_INDEX_STORE=/opt/wlotus/data/dana-index-burns.json
PUBLIC_SITE_ORIGIN=https://wlotus.org
EOF
sudo chown root:deploy /etc/wlotus/dana-index.env
sudo chmod 640 /etc/wlotus/dana-index.env

sudo -u deploy bash -lc '
  f=/opt/wlotus/data/dana-index-burns.json
  [ -f "$f" ] && mv "$f" "/opt/wlotus/data/dana-index-burns.old-$(date +%Y%m%d%H%M%S).json" || true
'

sudo systemctl restart wlotus-dana-index
curl -sS http://127.0.0.1:8788/health | jq .
# tokenId == NEW_ID; burns near 0 until new memorials exist
```

Do this **before** creating specials so the two root burns are indexed on the
new token.

### 8. Create temple specials (Vu Lan + Cô Hồn)

Specials are **not** JSON-only and are **not** created by genesis. Search and
re-offers need real root dedication burns; `TEMPLE_SPECIALS_JSON` only
*registers* those txids so mint-api raises the burn in-window.

After a new genesis the premine sits on temple P2SH — the desk has **no**
WLOTUS inventory yet. `create-temple-specials` will **auto-remint once**
(102 miner atoms onto the tip) unless you set `CREATE_TEMPLE_SPECIALS_NO_MINT=1`.
That spends baton 0; do it while the public SPA still points at the **old**
tokenId (before the tag) so nobody else is racing that tip.

```bash
cd /opt/wlotus
set -a && source /etc/wlotus/mint.env && set +a
set -a && source .env && set +a   # mnemonic from mint.env is what matters

# Plan only (no remint, no burns). Empty inventory is OK — a warning, not an error.
CREATE_TEMPLE_SPECIALS_DRY_RUN=1 npm run create-temple-specials

# Live: auto-remint ~102 miner atoms onto the tip if inventory is 0, persist the
# new baton tip into deployments JSON, restart mint-api, then burn two roots.
npm run create-temple-specials
```

The script writes `deployments/temple-specials-created.json`. Register that
**file** on mint-api (do not paste the array into `mint.env` — quotes break
dotenv and the unit never binds `:8787`). **Prod must keep
`TEMPLE_SPECIAL_TEST_OFFSET_DAYS=0`.** `TEMPLE_SPECIAL_DESK_KEEP` defaults to
**6** (burn 96 of the miner 102); set `0` for a full miner-share burn.

```bash
cd /opt/wlotus
sudo cp deployments/temple-specials-created.json /etc/wlotus/temple-specials.json
sudo chmod 644 /etc/wlotus/temple-specials.json

sudo sed -i \
  -e '/^TEMPLE_SPECIALS_JSON=/d' \
  -e '/^TEMPLE_SPECIALS_JSON_FILE=/d' \
  -e '/^TEMPLE_SPECIAL_DESK_KEEP=/d' \
  -e '/^TEMPLE_SPECIAL_TEST_OFFSET_DAYS=/d' \
  /etc/wlotus/mint.env

sudo tee -a /etc/wlotus/mint.env >/dev/null <<'EOF'
TEMPLE_SPECIALS_JSON_FILE=/etc/wlotus/temple-specials.json
TEMPLE_SPECIAL_DESK_KEEP=6
TEMPLE_SPECIAL_TEST_OFFSET_DAYS=0
EOF
sudo chmod 640 /etc/wlotus/mint.env
sudo chown root:deploy /etc/wlotus/mint.env

sudo systemctl restart wlotus-mint-api
sleep 2
sudo systemctl is-active wlotus-mint-api
# Hit the process, not nginx — a down desk returns HTML 502 and jq dies
# with "Invalid numeric literal at line 1, column 7".
curl -sS --fail-with-body http://127.0.0.1:8787/health
curl -sS --fail-with-body http://127.0.0.1:8787/api/status \
  | jq '{tokenId, ticker, templeSpecials: .templeSpecials}'
```

If that health curl fails:

```bash
sudo systemctl status wlotus-mint-api --no-pager
sudo journalctl -u wlotus-mint-api -n 80 --no-pager
```

Expect `templeSpecials.enabled == true`, `testOffsetDays == 0`, and **two**
profiles (`Vu Lan`, `Cô Hồn`) with 64-hex `profileId`s. The SPA reads this
from `/api/status` (no `VITE_TEMPLE_SPECIALS_JSON` bake required).

Optional later: add a `hero` (e.g. Hồ Chí Minh, `eventCalendar: "solar"`) by
burning another root and appending to the JSON — not part of the default
script. Full reference: [TEMPLE_SPECIALS.md](../../docs/TEMPLE_SPECIALS.md).

### 9. GitHub Environment `production`

Repo → **Settings → Environments → production → Variables**:

| Variable | Value |
|----------|--------|
| `VITE_PRAYER_TOKEN_ID` | **`NEW_ID`** from step 4 |
| `VITE_PRAYER_TICKER` | `WLOTUS` |
| `VITE_MIN_PRAY_SECONDS` | `108` (or your current value) |
| `VITE_EXPERIMENTAL_POW` | `1` if you want WebGPU on prod (test already uses this; prod workflow must pass it — see note below) |

Do this **before** pushing the tag. The SPA bakes `VITE_PRAYER_TOKEN_ID` at
build time. Specials UI comes from `/api/status`, not a Vite variable.

**Prod workflow note:** `.github/workflows/deploy-web-prod.yml` currently
forwards `VITE_PRAYER_TOKEN_ID`, `VITE_PRAYER_TICKER`, `VITE_CHRONIK_URLS`,
`VITE_TIP_POLL_MS`, `VITE_MIN_PRAY_SECONDS`. It does **not** pass
`VITE_EXPERIMENTAL_POW`. Leave that unset unless you add it to the workflow
in the same release.

### 10. Tag `master` → Deploy web (prod)

Only after steps 4–9. The job rsyncs the SPA **and** force-checkouts this tag
under `/opt/wlotus` (untracked `mainnet-wlotus.json` and
`temple-specials-created.json` stay).

```bash
git checkout master
git pull origin master
git tag -a v26.8.0 -m "WLOTUS 102/6 genesis + desk since v26.7.12"
git push origin v26.8.0
```

Watch **Actions → Deploy web (prod)**. After green:

```bash
curl -sS https://wlotus.org/api/status | jq '{ticker,tokenId,mintAtoms}'
curl -sS https://wlotus.org/index-api/health | jq '{tokenId}'
# both tokenId == NEW_ID
```

If mint-api comes up on `dWLOTUS`, the tag checkout did not see
`mainnet-wlotus.json` or `mint.env` lost `MINT_REQUIRE_LIVE` (mnemonic sync).
Restore `mint.env` from step 5 and `sudo systemctl restart wlotus-mint-api`.

### 11. Smoke + nginx (iPhone cache)

1. Offer once on https://wlotus.org (hard-refresh / fully close the PWA on iPhone).
2. Confirm the remint explorer shows **102** to the mint/tip address and **6**
   to temple P2SH, then the memorial burn of **1**.
3. `curl -sS https://wlotus.org/api/status | jq .templeSpecials.profiles`
   — Vu Lan + Cô Hồn present. In-window re-offers to those roots burn **96**
   (deskKeep 6) instead of 1.
4. If iPhones stay on the old bundle, merge `/sw.js` + `manifest.webmanifest`
   `Cache-Control: no-cache` from `nginx-wlotus-prod-tls.conf` into the live
   443 server block, then `sudo nginx -t && sudo systemctl reload nginx`.

---

## Aftercare

- **Old token:** still on eCash. Cashtab / explorers can show it; wlotus.org
  will not index it after step 7.
- **PWA Recent:** device `localStorage` may list old-token rows until the user
  clears site data.
- **Desk XEC:** same funding address as before. Tips only need a few ~40 XEC
  coins (`fund-tip-fee-wallets`).
- **Next deploys:** ordinary `v*` tags on `master` are enough **until** you
  change the covenant again (split, Moore, batons, temple hash).

---

## `jq: parse error: Invalid numeric literal`

That is **nginx HTML**, not mint-api JSON. Prod `https://wlotus.org/api/status`
proxies to `127.0.0.1:8787`. When the unit is stopped (cutover step 1) or
failed to start, nginx returns:

```
<html>
<head><title>502 Bad Gateway</title></head>
```

`jq` then errors at line 1 column 7. Confirm on the VM:

```bash
curl -sS -D - -o /tmp/status.body --max-time 5 https://wlotus.org/api/status | head
head -c 200 /tmp/status.body; echo
curl -sS --max-time 5 http://127.0.0.1:8787/health || true
sudo systemctl status wlotus-mint-api --no-pager
sudo journalctl -u wlotus-mint-api -n 80 --no-pager
```

`curl: (7) Failed to connect to 127.0.0.1 port 8787` means the unit is
**still stopped** (cutover step 1 freeze) or ExecStart is crashing. Curl
alone cannot start it.

```bash
sudo bash /opt/wlotus/deploy/contabo/mint-api-doctor.sh
sudo systemctl start wlotus-mint-api
sleep 2
curl -sS --fail-with-body http://127.0.0.1:8787/health
```

Bring the desk back (as `deploy` so `node_modules` stays writable):

```bash
sudo -u deploy -H bash -lc 'cd /opt/wlotus && git log -1 --oneline && npm ci'
sudo systemctl restart wlotus-mint-api
sleep 2
curl -sS --fail-with-body http://127.0.0.1:8787/health
curl -sS --fail-with-body http://127.0.0.1:8787/api/status | jq '{ticker,tokenId}'
```

`systemctl try-restart` does **nothing** if the unit is inactive — use
`restart` after a freeze.

---

## Rollback

You cannot mutate the new genesis. To put the **site** back on the old token:

1. Copy the archived `mainnet-wlotus-1-107-*.json` back to
   `deployments/mainnet-wlotus.json`
2. Restore dana-index `TOKEN_ID` + the `.old-*.json` store
3. Set `VITE_PRAYER_TOKEN_ID` to the **old** id and tag a build that still
   **encodes 1/107** (not current `master`)

Current `master` will not remint the old batons. Rollback means a tag from
**before** the 102/6 covenant change (e.g. `v26.7.12`), not a config toggle.

---

## Related

- [PROD.md](./PROD.md) — VM, GitHub Environment, tag mechanics
- [README.md](./README.md) — test genesis switch (same idea, `dWLOTUS`)
- [docs/ECONOMICS.md](../../docs/ECONOMICS.md) — why 102/6
- [apps/mint-api/README.md](../../apps/mint-api/README.md) — fee wallets / custody
