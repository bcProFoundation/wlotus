# wLotus web deploy guide

**Live test site:** https://test.wlotus.org  
**Production:** https://wlotus.org — tag releases only; see **[PROD.md](./PROD.md)**

Static SPA (`apps/web`) — Prayer ALP burn, XEC fees from the browser wallet.

---

## Local vs VM vs CI — what runs where

| | **Local (your laptop)** | **VM (Contabo)** | **CI (GitHub Actions)** |
|--|-------------------------|------------------|-------------------------|
| **Purpose** | Develop and test UI | Host the built site | Build + publish on push |
| **You run** | `npm run web` | One-time bootstrap; nginx only after that | Workflow **Deploy web (test)** |
| **Needs Node/npm?** | Yes | No (only nginx serves files) | Yes (on GitHub runners) |
| **Needs git clone?** | Yes (full repo) | Optional (bootstrap only); **not** for each deploy | Checkout on each run |
| **Site files live at** | Vite dev server `:5173` | `/var/www/wlotus-test` | rsync → VM path above |
| **Updates when** | You save code / restart dev | CI rsync or manual rsync from laptop | Push to `master` or manual workflow run |

**Important:** `git pull` on the VM updates the **source repo** under `~/wlotus` — it does **not** update the live site. The live site is the **built** `dist/` folder rsync’d to `/var/www/wlotus-test`.

```
┌─────────────────────────────────────────────────────────────────┐
│  LOCAL (laptop)                                                 │
│  git clone → npm install → npm run web → localhost:5173         │
│  (hot reload, no deploy)                                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CI (GitHub Actions)                                            │
│  push master / workflow_dispatch → npm run web:build → rsync    │
└───────────────────────────────┬─────────────────────────────────┘
                                │ SSH (deploy user)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  VM (Contabo)                                                   │
│  nginx → /var/www/wlotus-test  →  https://test.wlotus.org       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Local development (laptop)

From a clone of this repo:

```bash
git clone https://github.com/bcProFoundation/wlotus.git
cd wlotus
npm install
npm run web
```

Open http://localhost:5173

Optional env — copy `apps/web/.env.example` → `apps/web/.env`:

```
VITE_PRAYER_TOKEN_ID=<current dryrun 64-hex from Contabo / deployments JSON>
VITE_PRAYER_TICKER=dWLOTUS
VITE_CHRONIK_URLS=https://chronik.e.cash,https://chronik.pay2stay.com/xec
```

Defaults should match live **dWLOTUS** on the test desk. The SPA also shows `/api/status.ticker` at runtime.
No VM or GitHub secrets needed for local dev.

---

## 2. One-time VM setup (Contabo)

Do this **once** on the VPS. Assumes Ubuntu 22.04/24.04 (or Debian), SSH as `root` or sudo.

### 2.1 — SSH in

```bash
ssh root@YOUR_VM_IP
```

### 2.2 — Get bootstrap files

**Option A — clone on VM:**

```bash
apt-get update -y && apt-get install -y git
git clone https://github.com/bcProFoundation/wlotus.git
cd wlotus
git checkout master
```

**Option B — copy two files from laptop:**

```bash
# laptop
scp deploy/contabo/bootstrap.sh deploy/contabo/nginx-wlotus-test.conf root@YOUR_VM_IP:~/

# VM
mkdir -p ~/wlotus-bootstrap && mv ~/bootstrap.sh ~/nginx-wlotus-test.conf ~/wlotus-bootstrap/
cd ~/wlotus-bootstrap && chmod +x bootstrap.sh
```

### 2.3 — Run bootstrap

```bash
# from repo root (Option A):
sudo bash deploy/contabo/bootstrap.sh test.wlotus.org

# or from bootstrap dir (Option B):
sudo bash bootstrap.sh test.wlotus.org
```

Creates `/var/www/wlotus-test`, nginx site `wlotus-test`, user `deploy`, ufw rules.

### 2.4 — DNS

At your `wlotus.org` DNS host, add:

| Type | Name | Value |
|------|------|-------|
| A | `test` | Contabo VM public IPv4 |

Verify: `dig +short test.wlotus.org A`

`CONTABO_HOST` in GitHub must be `test.wlotus.org` (no `https://`, no port).

### 2.5 — TLS (HTTPS)

After DNS resolves:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d test.wlotus.org
```

### 2.6 — Deploy SSH key (laptop → VM → GitHub)

The key is generated on your **laptop**, not the VM.

**On laptop:**

```bash
ssh-keygen -t ed25519 -C "wlotus-github-deploy" -f ./wlotus-deploy -N ""
```

**Copy public key to VM** (pick one):

```bash
# scp
scp ./wlotus-deploy.pub root@YOUR_VM_IP:~/
ssh root@YOUR_VM_IP 'cat ~/wlotus-deploy.pub >> /home/deploy/.ssh/authorized_keys && chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys'
```

**Test from laptop:**

```bash
ssh -i ./wlotus-deploy deploy@test.wlotus.org
```

**GitHub secret** — paste full private key (`cat ./wlotus-deploy`) into `CONTABO_SSH_PRIVATE_KEY`.

---

## 3. GitHub secrets (CI)

Repo → **Settings → Secrets and variables → Actions**:

| Secret | Required | Value (test env) |
|--------|----------|------------------|
| `CONTABO_HOST` | yes | `test.wlotus.org` |
| `CONTABO_USER` | yes | `deploy` |
| `CONTABO_SSH_PRIVATE_KEY` | yes | private key from laptop |
| `CONTABO_SSH_PORT` | no | `22` |
| `CONTABO_DEPLOY_PATH` | no | `/var/www/wlotus-test` |
| `CONTABO_SMOKE_URL` | no | `https://test.wlotus.org/` |
| `VITE_PRAYER_TOKEN_ID` | yes* | **current** dryrun token id (must match desk after every new genesis) |
| `VITE_PRAYER_TICKER` | no | `dWLOTUS` |
| `VITE_CHRONIK_URLS` | no | Chronik URLs |
| `VITE_TIP_POLL_MS` | no | Tip-epoch poll while mining (ms). Prefer an Actions **variable** (not sensitive): `1000` or `5000`. App default **2000** if unset. Secret also works. |
| `VITE_MIN_PRAY_SECONDS` | no | Soft pray floor in **seconds** (e.g. `108`). Prefer Actions **variable**. App default **108** (~2 min mala); `0` disables. |
| `VITE_EXPERIMENTAL_POW` | no | Set `1` for WebGPU → multi-worker Offer mining. |
| `MINT_MNEMONIC` | no* | 12/24-word **fee wallet** — synced to `/etc/wlotus/mint.env` |

\*After each **new genesis**, update `VITE_PRAYER_TOKEN_ID` (and dana-index `TOKEN_ID`) or the SPA / index keep the old token. See **Switch to a new genesis** below.

\*Mint fee wallet **must** exist on the VM for `mint-api`. Prefer writing `/etc/wlotus/mint.env` once on Contabo. GitHub `MINT_MNEMONIC` is only an optional way to refresh that file on deploy — Actions alone cannot pay fees.

See [apps/mint-api/README.md](../../apps/mint-api/README.md).

---

## Mint API on Contabo (required for Offer Prayer)

Static deploy alone is not enough. `/api` must hit mint-api or the UI stays on
“Connecting…” / returns HTML JSON errors.

**Canonical layout (same as prod):** `/opt/wlotus` owned by `deploy`, systemd
`User=deploy`, secrets in `/etc/wlotus/mint.env`. Do **not** run mint-api from
`/root/wlotus/wlotus`.

### Start over / migrate to `/opt/wlotus` (test)

If the VM still uses `~/wlotus/wlotus` or `/root/wlotus/wlotus`, reset once as root:

```bash
# From any checkout that has the script (or curl raw from GitHub after merge):
cd /root/wlotus/wlotus   # current tree — only needed to run the script
sudo bash deploy/contabo/bootstrap-opt-wlotus.sh
# Optional: OLD_REPO=/root/wlotus/wlotus BRANCH=master
```

That script: stops services → backs up `deployments/*.json` + `.env` → fresh clone
at `/opt/wlotus` as `deploy` → restores genesis JSON → `npm ci` → installs
`wlotus-mint-api` + `wlotus-dana-index` units → writes `/etc/wlotus/dana-index.env`
from dryrun `tokenId` → enables services. Keeps `/etc/wlotus/mint.env`.

Then nginx: **Deploy mint-api (test)** / **Deploy web (prod)** run
`apply-nginx-hardening.sh` (rate-limit zone, notify 403, challenge limit).
First time, refresh sudoers so that script is NOPASSWD:

```bash
sudo bash /opt/wlotus/deploy/contabo/install-wlotus-deploy-sudoers.sh
```

Manual paste of `nginx-api-snippet.conf` is only needed for a Certbot site that
does not yet proxy `/api/` or `/index-api/`.

### Update `/opt/wlotus` + restart dana-index (test)

`git pull` updates **source** under `/opt/wlotus`. It does **not** refresh
`/var/www/wlotus-test` (that is CI/rsync). After pulling code that changes
`apps/dana-index/`, you **must** restart `wlotus-dana-index` or `/og/:txid`
keeps returning `{"ok":false,"error":"Not found"}`.

**Always pull as `deploy`**, not root. Root hits:

```text
fatal: detected dubious ownership in repository at '/opt/wlotus'
```

Fix (prefer running as deploy; avoid making root the daily git user):

```bash
# Correct — same user that owns /opt/wlotus
sudo -u deploy -H bash -lc 'cd /opt/wlotus && git status -sb && git pull origin master'

# If you already used root and only need an exception (last resort):
#   sudo git config --global --add safe.directory /opt/wlotus
```

**Preserve live dryrun tip JSON.** Mint-api updates
`deployments/mainnet-dryrun-active.json` and
`deployments/mainnet-dryrun-wlotus.json` on the VM (baton tips / last remints).
Those local edits block `git pull`:

```text
error: Your local changes to the following files would be overwritten by merge:
        deployments/mainnet-dryrun-active.json
        deployments/mainnet-dryrun-wlotus.json
```

Backup → stash or checkout → pull → **restore the VM copies** (usually newer than git):

```bash
sudo -u deploy -H bash -lc '
set -euo pipefail
cd /opt/wlotus
mkdir -p /tmp/wlotus-deploy-bak
cp -a deployments/mainnet-dryrun-active.json \
      deployments/mainnet-dryrun-wlotus.json \
      /tmp/wlotus-deploy-bak/ 2>/dev/null || true

git stash push -m "vm dryrun tips" -- \
  deployments/mainnet-dryrun-active.json \
  deployments/mainnet-dryrun-wlotus.json \
  || git checkout -- deployments/mainnet-dryrun-active.json \
                    deployments/mainnet-dryrun-wlotus.json

git pull origin master

# Put live tip state back — do not commit these on the server
if [ -f /tmp/wlotus-deploy-bak/mainnet-dryrun-active.json ]; then
  cp -a /tmp/wlotus-deploy-bak/mainnet-dryrun-active.json deployments/
  cp -a /tmp/wlotus-deploy-bak/mainnet-dryrun-wlotus.json deployments/
fi
git status -sb
'

# Restart index (and mint-api if its code changed)
sudo systemctl restart wlotus-dana-index
# sudo systemctl restart wlotus-mint-api

curl -sS http://127.0.0.1:8788/health | jq .
# Expect service dana-index + tokenId matching dryrun
curl -sS "http://127.0.0.1:8788/og/<64-hex-burn-txid>?lang=vi" | grep og:title
curl -sS "https://test.wlotus.org/og/<64-hex-burn-txid>?lang=vi" | grep og:title
curl -sS "https://test.wlotus.org/<64-hex-burn-txid>?lang=vi" | grep og:title
```

If `rewrite` / share URL returns JSON `Not found` while `/og/<txid>` works,
nginx is proxying `/<txid>` without the `/og/` prefix. Prefer:

```nginx
location ~* "^/([0-9a-fA-F]{64})/?$" {
    error_page 502 503 504 = @wlotus_spa;
    proxy_pass http://127.0.0.1:8788/og/$1$is_args$args;
    ...
}
```

Do **not** use `rewrite … {64} … break` (brittle). After editing: `sudo nginx -t && sudo systemctl reload nginx`.
Also restart dana-index so bare `GET /<txid>` serves OG as a fallback.

### First-time mint-api (already on `/opt/wlotus`)

```bash
# 1) Fee wallet
sudo mkdir -p /etc/wlotus
sudo tee /etc/wlotus/mint.env >/dev/null <<'EOF'
MINT_MNEMONIC="word1 word2 ... word12"
MINT_API_PORT=8787
EOF
sudo chown root:deploy /etc/wlotus/mint.env
sudo chmod 640 /etc/wlotus/mint.env

# 2) App checkout + deps
sudo mkdir -p /opt/wlotus && sudo chown deploy:deploy /opt/wlotus
sudo -u deploy git clone https://github.com/bcProFoundation/wlotus.git /opt/wlotus
cd /opt/wlotus
sudo -u deploy git checkout master
sudo -u deploy npm ci

# 3) systemd (units already point at /opt/wlotus + User=deploy)
sudo cp deploy/contabo/wlotus-mint-api.service /etc/systemd/system/
sudo cp deploy/contabo/wlotus-dana-index.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wlotus-mint-api
sudo systemctl status wlotus-mint-api --no-pager

# 4) nginx /api (+ /index-api/) — do NOT overwrite Certbot SSL
# Prefer: paste deploy/contabo/nginx-api-snippet.conf into the existing
# test.wlotus.org server block, then: sudo nginx -t && sudo systemctl reload nginx

# 5) Check
curl -sS http://127.0.0.1:8787/health
curl -sS https://test.wlotus.org/api/status?installId=test
```

Fund the **desk** mint wallet address with XEC, then equal-split into per-tip
fee accounts (remint has no change out — never leave one large UTXO as fuel):

```bash
cd /opt/wlotus
set -a && source /etc/wlotus/mint.env && set +a
sudo -u deploy -H bash -lc 'cd /opt/wlotus && set -a && source /etc/wlotus/mint.env && set +a && npm run fund-tip-fee-wallets'
```

`MINT_MNEMONIC` currently derives **both** the desk treasury and the per-tip
mint keys. Keep it that way. Splitting those secrets later:
[apps/mint-api/README.md § Custody](../../apps/mint-api/README.md#custody-one-mnemonic-today-split-keys-later).

**W Lotus temple (launch):** covenant pays **6** → **P2SH** (`TEMPLE_ADDRESS` multisig / cold, IFP-style). Miner receives **102**; desk fee-sponsor burns **1** and keeps **101**. Temple spends are rare ops with redeem + keys — not a daily P2PKH sweep.

### Create `dWLOTUS` dryrun (on Contabo **test**)

For **live WLOTUS** on prod, see **[PROD.md](./PROD.md)** (`npm run create-wlotus-token` / `create-prod-token`).

Do this **on the test VM** (same machine as mint-api), with a funded `GENESIS_SK_HEX` in `.env` (or export it). **Prod and dryrun use the same script** — only `TICKER` differs (`dWLOTUS` vs default `WLOTUS`).

**Genesis parameters (immutable after create):**

| Param | Value |
|-------|------:|
| Remint mint | **108** (**102** miner + **6** temple) |
| **Initial fungible mint** | **108** → **temple P2SH** (not genesis wallet) |
| ALP name | **W Lotus** |
| `baseZeroBits` | **0** |
| Moore period | **500 days**/bit (五百罗汉) |
| Batons | **28** (ALP max; desk may serve fewer) |
| Hard sunset | remints fail when bits would be **> 128** |

Desk / rate limits (soft, changeable):

| Env | Launch default |
|-----|---------------:|
| `MINT_SERVING_TIP_COUNT` | **1** |
| `MINT_SERVING_TIP_INDEX` | **0** (prod tip 0; test on same token uses **27**) |
| `MINT_MAX_OFFERS_PER_DAY` | **20** / `installId` (device) |

```bash
cd /opt/wlotus
sudo -u deploy -H bash -lc 'cd /opt/wlotus && git pull origin master && npm ci'

# Fund GENESIS_ADDRESS with ≥ ~900 XEC before BATONS=28 (handoffs).
# Temple must be P2SH (IFP-style), e.g. test temple:
export TEMPLE_ADDRESS=ecash:ppzc7slfa9juf4gfr950qm9fn9gvctptkqdhtvf08j

# Optional: pin Moore period (default is already 500)
# export MOORE_DAYS_PER_EXTRA_BIT=500

TIER=wlotus BATONS=28 TEMPLE_ADDRESS="$TEMPLE_ADDRESS" \
  npm run create-dryrun-wlotus
# Equivalent:
#   TICKER=dWLOTUS BATONS=28 TEMPLE_ADDRESS="$TEMPLE_ADDRESS" npm run create-wlotus-token
# Writes deployments/mainnet-dryrun-wlotus.json
# and copies it to deployments/mainnet-dryrun-active.json

# Verify baked params:
jq '{ticker,name,tokenId,baseZeroBits,secondsPerExtraBit,mintAtomsPerRemint,initialMintAtoms,initialMintAddress,mintSplit,powBatonCount,templeAddress}' \
  deployments/mainnet-dryrun-wlotus.json
# Expect: ticker=dWLOTUS, name="W Lotus", baseZeroBits=0,
#         mintAtomsPerRemint="108", initialMintAtoms="108",
#         mintSplit.miner="102", mintSplit.temple="6",
#         initialMintAddress == templeAddress,
#         secondsPerExtraBit=43200000  (500*86400)

# Smoke one remint (optional; uses GENESIS wallet as miner+fuel):
TIER=wlotus BATON_INDEX=0 npm run mine-dryrun-once

# Tip fee wallets for the soft tip count:
set -a && source /etc/wlotus/mint.env && set +a
# ensure in mint.env:
#   MINT_SERVING_TIP_COUNT=1
#   MINT_SERVING_TIP_INDEX=0
#   MINT_MAX_OFFERS_PER_DAY=20
npm run fund-tip-fee-wallets
sudo systemctl restart wlotus-mint-api
```

Until mint-api is restarted with the new deployment JSON, `/api/status` may show the old `tokenId`. After deploy:

```bash
sudo systemctl restart wlotus-mint-api
curl -sS https://test.wlotus.org/api/status | jq '{ticker,tokenId,mintAtoms,baseZeroBits,memorialOnBurn,servingTipIndex,servingTipCount,powBatonCount,maxOffersPerDay}'
```

**Web (test):** set GitHub Actions variable/secret **`VITE_PRAYER_TOKEN_ID`** to the new `tokenId`, then run **Deploy web (test)** (or push to `master`). Hard-refresh https://test.wlotus.org.

Temple spends are rare ops with redeem + keys — not a daily P2PKH sweep.

### Switch to a new genesis (test) — required after economics / name / premine changes

ALP covenants and genesis metadata are **immutable**. A running desk on an **older**
token id (e.g. 1 miner + 107 temple, name `wLotus`, premine on genesis wallet)
**cannot** be patched in place. Create a **new** dryrun genesis and retarget the stack.

**What breaks if you only restart services**

| Component | If still on old token |
|-----------|------------------------|
| mint-api | Serves old batons / wrong mint split |
| SPA (`VITE_PRAYER_TOKEN_ID`) | Offers against obsolete id |
| dana-index | Chronik watch + **store still lists old memorials** |

Old burns remain valid **on-chain for the old token**; they must not appear as live
test history after the switch.

**Procedure (Contabo test)**

```bash
cd /opt/wlotus
# 1) Pull code that includes the new covenant params
sudo -u deploy -H bash -lc 'cd /opt/wlotus && git pull origin master && npm ci'

# 2) Archive the previous dryrun record (do not delete without a copy)
sudo -u deploy mkdir -p deployments/archive
sudo -u deploy bash -lc '
  cd /opt/wlotus
  for f in deployments/mainnet-dryrun-wlotus.json deployments/mainnet-dryrun-active.json; do
    [ -f "$f" ] && cp -a "$f" "deployments/archive/$(basename "$f")-$(date +%Y%m%d%H%M%S).json"
  done
'

# 3) New genesis (funded GENESIS_SK_HEX + TEMPLE_ADDRESS)
export TEMPLE_ADDRESS=ecash:p…   # test temple P2SH
BATONS=28 TEMPLE_ADDRESS="$TEMPLE_ADDRESS" npm run create-dryrun-wlotus
NEW_ID=$(jq -r .tokenId deployments/mainnet-dryrun-wlotus.json)
echo "NEW_ID=$NEW_ID"

# 4) mint-api → new deployment JSON
sudo systemctl restart wlotus-mint-api
curl -sS http://127.0.0.1:8787/api/status | jq '{ticker,tokenId,mintAtoms}'
# tokenId must equal NEW_ID

# 5) dana-index: point TOKEN_ID at NEW_ID and **wipe the store**
#    (store is not filtered by tokenId on read — old rows would stay in recent/search)
sudo tee /etc/wlotus/dana-index.env >/dev/null <<EOF
TOKEN_ID=${NEW_ID}
CHRONIK_URLS=https://chronik.e.cash,https://xec.paybutton.org,https://chronik.pay2stay.com/xec
DANA_INDEX_STORE=/opt/wlotus/data/dana-index-burns.json
PUBLIC_SITE_ORIGIN=https://test.wlotus.org
EOF
sudo chown root:deploy /etc/wlotus/dana-index.env
sudo chmod 640 /etc/wlotus/dana-index.env

sudo -u deploy mkdir -p /opt/wlotus/data
sudo -u deploy bash -lc '
  f=/opt/wlotus/data/dana-index-burns.json
  [ -f "$f" ] && mv "$f" "/opt/wlotus/data/dana-index-burns.old-$(date +%Y%m%d%H%M%S).json" || true
'

sudo systemctl restart wlotus-dana-index
curl -sS http://127.0.0.1:8788/health | jq .
# expect: tokenId == NEW_ID, burns near 0 until backfill finds new-token memorials

# 6) Refuel tip fee wallets if needed
set -a && source /etc/wlotus/mint.env && set +a
npm run fund-tip-fee-wallets

# 7) GitHub Actions: set variable/secret VITE_PRAYER_TOKEN_ID=${NEW_ID}
#    then Actions → Deploy web (test) → Run workflow (branch master)
```

**Client note:** the SPA drops localStorage Recent / own-history when the live
token id changes (`wlotus.liveTokenId`). Public `/index-api` only lists the new
token after the store wipe.

**Production** uses the same steps with `mainnet-wlotus.json`, `MINT_REQUIRE_LIVE=1`,
and Environment `production` variables — see **[PROD.md § Upgrade: new live genesis](./PROD.md#upgrade-new-live-genesis)**.

---

## 4. Deploy / update the live site (CI)

### Test — https://test.wlotus.org

Two workflows. The SPA and mint-api do **not** deploy together: rsyncing HTML
does not restart the API, and restarting the API should not wait on a Vite build.

#### Deploy web (test) — `.github/workflows/deploy-web-test.yml`

| Trigger | When |
|---------|------|
| **Automatic** | Push to `master` that touches `apps/web/**`, `src/**` (catalog used by the calendar), `package.json`, workflow, or `deploy/contabo/**` |
| **Manual** | Actions → **Deploy web (test)** → **Run workflow** (branch **master**) |

Steps: `npm ci` → `npm run web:build` → rsync `apps/web/dist/` → `/var/www/wlotus-test`.

#### Deploy mint-api (test) — `.github/workflows/deploy-mint-api-test.yml`

| Trigger | When |
|---------|------|
| **Automatic** | Push to `master` that touches `apps/mint-api/**`, `apps/dana-index/**`, `src/**`, or lockfile |
| **Manual** | Actions → **Deploy mint-api (test)** → **Run workflow** (branch **master**; optional SHA) |

Steps: SSH as `deploy` → `chown` `/opt/wlotus` → backup live dryrun JSON + claims → `git reset --hard` that SHA → restore JSON → `npm ci` → `apply-nginx-hardening.sh` → `systemctl restart wlotus-mint-api` (dana-index too) → wait until the unit is active and `GET /health` succeeds.

**`sudo: a password is required`:** CI uses `sudo -n`. Ubuntu usrmerge makes `/bin/systemctl` resolve to `/usr/bin/systemctl`, which does **not** match a sudoers rule that lists only `/bin/systemctl`. Fix once as **root** on the test VM (does not require a full bootstrap):

```bash
# After this file is on the VM (git fetch + reset, or copy the script):
sudo bash /opt/wlotus/deploy/contabo/install-wlotus-deploy-sudoers.sh
```

Until the script is on the VM, write the file by hand (user `deploy`; both `/usr/bin` and `/bin`). Escape `:` in `chown` as `\:` — sudoers treats `:` as a field separator:

```bash
cat >/etc/sudoers.d/wlotus-deploy <<'EOF'
# Exact-command NOPASSWD for CI (do not use ALL).
deploy ALL=(root) NOPASSWD: \
  /usr/bin/systemctl try-restart wlotus-mint-api.service, \
  /usr/bin/systemctl restart wlotus-mint-api.service, \
  /usr/bin/systemctl try-restart wlotus-dana-index.service, \
  /usr/bin/systemctl restart wlotus-dana-index.service, \
  /bin/systemctl try-restart wlotus-mint-api.service, \
  /bin/systemctl restart wlotus-mint-api.service, \
  /bin/systemctl try-restart wlotus-dana-index.service, \
  /bin/systemctl restart wlotus-dana-index.service, \
  /usr/bin/mkdir -p /etc/wlotus, \
  /bin/mkdir -p /etc/wlotus, \
  /usr/bin/tee /etc/wlotus/mint.env, \
  /usr/bin/tee /etc/wlotus/dana-index.env, \
  /bin/tee /etc/wlotus/mint.env, \
  /bin/tee /etc/wlotus/dana-index.env, \
  /usr/bin/chmod 600 /etc/wlotus/mint.env, \
  /usr/bin/chmod 600 /etc/wlotus/dana-index.env, \
  /bin/chmod 600 /etc/wlotus/mint.env, \
  /bin/chmod 600 /etc/wlotus/dana-index.env, \
  /usr/bin/chown -R deploy\:deploy /opt/wlotus, \
  /bin/chown -R deploy\:deploy /opt/wlotus, \
  /usr/bin/rm -rf /opt/wlotus/node_modules, \
  /bin/rm -rf /opt/wlotus/node_modules, \
  /usr/bin/bash /opt/wlotus/deploy/contabo/apply-nginx-hardening.sh, \
  /bin/bash /opt/wlotus/deploy/contabo/apply-nginx-hardening.sh
EOF
chmod 440 /etc/sudoers.d/wlotus-deploy
visudo -c -f /etc/sudoers.d/wlotus-deploy
```

Then re-run Actions → **Deploy mint-api (test)**.

Use **manual** after a catalog/API merge if you do not want to wait for the path filter, or to redeploy the same SHA again.

Feature branches do **not** trigger either deploy (cost control).

After a green **web** run, https://test.wlotus.org serves the new SPA (hard-refresh if cached). After a green **mint-api** run, `/api/status` is the matching server.

### Production — https://wlotus.org

Workflow: **Deploy web (prod)** — `.github/workflows/deploy-web-prod.yml`

| Trigger | When |
|---------|------|
| **Automatic** | Push a **`v*` tag** whose commit is on **`master`** |
| **Manual** | Actions → Deploy web (prod) → set `ref` to the tag |

Full guide: **[PROD.md](./PROD.md)** (separate VM, Environment `production`, `CONTABO_PROD_*` secrets).  
**Live covenant:** **102/6** on both test and prod (prod tag `v26.8.0`). Historical recut: **[PROD_CUTOVER_102_6.md](./PROD_CUTOVER_102_6.md)**. Snapshot: [docs/STATUS.md](../../docs/STATUS.md).

```bash
git checkout master && git pull
git tag -a v1.0.0 -m "wLotus prod v1.0.0"
git push origin v1.0.0
```

---

## 5. Manual deploy from laptop (optional)

Same as CI, without GitHub — useful to debug rsync/SSH:

```bash
npm run web:build
rsync -avz --delete -e ssh apps/web/dist/ deploy@test.wlotus.org:/var/www/wlotus-test/
```

Requires the deploy SSH key on your laptop and access to the `deploy` user.

---

## 6. VM maintenance (not deploy)

| Task | Command (on VM) |
|------|-----------------|
| Check nginx | `sudo nginx -t && systemctl status nginx` |
| See live files | `ls -la /var/www/wlotus-test/` |
| Renew TLS | `sudo certbot renew` |
| Update clone | `sudo -u deploy -H bash -lc 'cd /opt/wlotus && git pull origin master'` — **does not update the website**; see **Update `/opt/wlotus` + restart dana-index** above for dryrun JSON + service restart |
| Restart dana-index | `sudo systemctl restart wlotus-dana-index` then `curl -sS http://127.0.0.1:8788/health` |
| New genesis cutover | See **Switch to a new genesis (test)** (archive JSON, new create, wipe dana store, update `VITE_PRAYER_TOKEN_ID`) |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `git pull` but site unchanged | Repo ≠ web root | Run CI workflow or manual rsync |
| `dubious ownership` on `/opt/wlotus` | Ran `git` as **root** | `sudo -u deploy -H bash -lc 'cd /opt/wlotus && git pull origin master'` |
| Pull blocked by `mainnet-dryrun-*.json` | Live tip state on VM | Backup → stash/checkout → pull → **restore** backups (see update section) |
| Share link OG is brand-only / JSON `Not found` | Old dana-index or `/<txid>` not mapped to `/og/` | `git pull` as deploy + restart dana-index; in **443** use `proxy_pass http://127.0.0.1:8788/og/$1$is_args$args;` (no rewrite) |
| Recent history still shows **old-token** offerings after new genesis | dana-index store not wiped / `TOKEN_ID` stale | Archive `DANA_INDEX_STORE`, set `TOKEN_ID` to new id, restart dana-index (see **Switch to a new genesis**) |
| SPA offers fail / wrong token after genesis | GitHub `VITE_PRAYER_TOKEN_ID` still old | Update Actions var + **Deploy web (test)** |
| `nginx: rewrite is not terminated by ";"` | Unquoted `{64}` in `rewrite` | Drop rewrite; use `proxy_pass …/og/$1$is_args$args` |
| `getaddrinfo: Name or service not known` | Bad `CONTABO_HOST` | Use `test.wlotus.org` or IP, no scheme |
| `Permission denied (publickey)` | Key not on VM | Copy `.pub` to `/home/deploy/.ssh/authorized_keys` |
| iPhone (Safari/PWA) keeps showing an old build after deploy, but Android/desktop is fine | `/sw.js` had no explicit `Cache-Control`, so WebKit can serve it from its HTTP cache instead of hitting the network on `registration.update()`, pinning the old JS/CSS bundle | Merge the `location = /sw.js { add_header Cache-Control "no-cache"; }` (+ `manifest.webmanifest`) block from `nginx-wlotus-test-tls.conf` into the live **443** server block, then `sudo nginx -t && sudo systemctl reload nginx`. On the phone, fully close the PWA/tab (not just background it) once to pick up the fix. |
| `wlotus-deploy.pub` not on VM | Expected | Generate on laptop; only **public** key goes on VM |
| Node 20 deprecation warning in Actions | GitHub runner notice | Warning only — not a deploy failure |
| Smoke check fails | Site/DNS/TLS not ready | Fix HTTP first; set `CONTABO_SMOKE_URL` after |
| 403 / blank page | nginx or empty dist | `ls /var/www/wlotus-test`; re-run workflow |
| Deploy mint-api (test): `sudo: a password is required` | `/etc/sudoers.d/wlotus-deploy` missing, or lists only `/bin/systemctl` while sudo matches `/usr/bin/systemctl` | As root: `sudo bash /opt/wlotus/deploy/contabo/install-wlotus-deploy-sudoers.sh` then re-run the workflow. Do not add `NOPASSWD: ALL`. |
| Deploy mint-api (test): nginx hardening skipped | sudoers lacks `apply-nginx-hardening.sh` | As root: `sudo bash /opt/wlotus/deploy/contabo/install-wlotus-deploy-sudoers.sh` then re-run the workflow |
| Deploy mint-api (test): `insufficient permission … .git/objects` / unpack-objects failed | Clone was created or fetched as **root**; `git fetch` ran before `chown` | Workflow now chowns first. One-time on the VM: `sudo chown -R deploy:deploy /opt/wlotus`. Re-run after that PR is on master. |
| Deploy mint-api (test): `curl: (7) Failed to connect … 8787` | `systemctl restart` returns when tsx is spawned (`Type=simple`); HTTP is not listening yet. `curl --retry` does not retry connection refused | Workflow now waits for `is-active` then polls `/health` up to 45s. |

---

## Architecture (reference)

```
GitHub Actions (build Vite dist)
        │  SSH + rsync
        ▼
Contabo VM  →  nginx  →  /var/www/wlotus-test  →  test.wlotus.org
```

Fees are paid in XEC by the user’s browser wallet; this stack only hosts the frontend.
