# Production deploy (wlotus.org)

**Prod site:** https://wlotus.org (separate Contabo VM from test)  
**Release rule:** GitHub Actions **Deploy web (prod)** runs when a **`v*` tag** is pushed, and only if that commit is on **`master`**.

Test (`test.wlotus.org`) stays on push-to-master via **Deploy web (test)**.

**Live (since tag [`v26.8.0`](https://github.com/bcProFoundation/wlotus/releases/tag/v26.8.0), 2026-08-13):**
prod serves the **102 miner + 6 temple** covenant. Token id and `/api/status`
snapshot: [docs/STATUS.md](../../docs/STATUS.md). The 1/107 → 102/6 recut
runbook is historical: **[PROD_CUTOVER_102_6.md](./PROD_CUTOVER_102_6.md)**.

If **prod already runs an older WLOTUS token** (different mint split, name, or
premine destination), code deploy alone is not enough — cut a **new live genesis**
and retarget mint-api + dana-index + `VITE_PRAYER_TOKEN_ID`. See
[Upgrade: new live genesis](#upgrade-new-live-genesis).

---

## Architecture

```
git tag vX.Y.Z on master ──► GitHub Actions (Deploy web (prod))
                                    │
                                    ├─ npm run web:build (prod VITE_*)
                                    ├─ rsync dist → /var/www/wlotus
                                    └─ git checkout tag on /opt/wlotus + restart mint-api
                                              │
                                              ▼
                                    Contabo PROD VM → nginx → wlotus.org
```

---

## 1. One-time: provision the prod VM

SSH as root on the **new** Contabo server:

```bash
apt-get update -y && apt-get install -y git
git clone https://github.com/bcProFoundation/wlotus.git /tmp/wlotus-bootstrap
cd /tmp/wlotus-bootstrap
git checkout master
sudo bash deploy/contabo/bootstrap-prod.sh wlotus.org
```

Creates `/var/www/wlotus`, nginx site `wlotus`, user `deploy`, ufw, limited sudo for mint-api restart.

**Do not re-run `bootstrap-prod.sh` after Certbot.** Older versions overwrote the TLS site and rewrote every `server_name` to `wlotus.org www.wlotus.org`, which merges the www→apex `return 301` onto apex and causes an infinite HTTPS redirect loop. Current bootstrap **skips** nginx overwrite when `listen 443` / `ssl_certificate` is present (safe for sudoers / `/opt/wlotus` chown refresh).

### Fix: https://wlotus.org returns 301 to itself

On the prod VM as root:

```bash
# Confirm loop
curl -sI https://wlotus.org/ | head -5   # Location: https://wlotus.org/ → broken

cd /opt/wlotus && sudo -u deploy git pull origin master   # not as root — dubious ownership
# or copy nginx-wlotus-prod-tls.conf from this repo
sudo cp /etc/nginx/sites-available/wlotus "/etc/nginx/sites-available/wlotus.bak.$(date +%s)"
sudo cp deploy/contabo/nginx-wlotus-prod-tls.conf /etc/nginx/sites-available/wlotus

# If cert live/ name differs:
sudo certbot certificates
# edit ssl_certificate paths in sites-available/wlotus if needed

# Disable a separate www-redirect site if it also names apex (optional)
# sudo rm -f /etc/nginx/sites-enabled/wlotus-www-redirect

sudo nginx -t && sudo systemctl reload nginx
curl -sI https://wlotus.org/ | head -5          # expect HTTP/2 200
curl -sI https://www.wlotus.org/ | head -5      # expect 301 → https://wlotus.org/
curl -sS https://wlotus.org/api/status | head -c 200
```

### DNS

| Type | Name | Value |
|------|------|-------|
| A | `@` (wlotus.org) | Prod Contabo IPv4 |
| A | `www` | **Same** Contabo IPv4 |

DNS only points `www` at the server. The **HTTP 301** to apex is done in nginx (see below) — registrars’ “URL redirect” records are optional and often break HTTPS.

Verify:

```bash
dig +short wlotus.org A
dig +short www.wlotus.org A   # must resolve to the same IP
```

### www → apex redirect

Repo config already separates hosts: `www` returns `301 https://wlotus.org$request_uri`.

**If the site is already live with Certbot**, do not overwrite the whole site file. On the prod VM:

```bash
cd /opt/wlotus && sudo -u deploy git pull origin master   # or copy files from laptop
# If mainnet-*.json blocks pull, see README.md “Update /opt/wlotus + restart dana-index”.

# 1) Ensure cert covers both names
sudo certbot --nginx -d wlotus.org -d www.wlotus.org --expand

# 2) Add www redirect servers (adjust ssl paths if certbot used a different live/ name)
sudo cp deploy/contabo/nginx-www-redirect.conf /etc/nginx/sites-available/wlotus-www-redirect
sudo ln -sfn /etc/nginx/sites-available/wlotus-www-redirect /etc/nginx/sites-enabled/

# 3) On the main apex HTTPS server block, remove www.wlotus.org from server_name
#    so only wlotus.org serves the SPA (www is handled by the redirect file).

sudo nginx -t && sudo systemctl reload nginx
curl -sI https://www.wlotus.org/ | head -5   # expect 301 → https://wlotus.org/
```

**Fresh install:** `bootstrap-prod.sh` + `nginx-wlotus-prod.conf` already include the HTTP www redirect; after Certbot, add the HTTPS www block from `nginx-www-redirect.conf` if Certbot did not create a clean redirect.

On your laptop:

```bash
ssh-keygen -t ed25519 -C "wlotus-prod-github-deploy" -f ./wlotus-prod-deploy -N ""
scp ./wlotus-prod-deploy.pub root@PROD_IP:~/
ssh root@PROD_IP 'cat ~/wlotus-prod-deploy.pub >> /home/deploy/.ssh/authorized_keys && chown deploy:deploy /home/deploy/.ssh/authorized_keys'
ssh -i ./wlotus-prod-deploy deploy@wlotus.org
```

### TLS

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d wlotus.org -d www.wlotus.org
```

After Certbot, ensure `/api/` and `/health` exist in the **443** server block (see `nginx-api-snippet.conf`).

---

## 2. One-time: mint-api + live **WLOTUS** genesis

```bash
sudo mkdir -p /opt/wlotus /etc/wlotus
sudo chown -R deploy:deploy /opt/wlotus

# As deploy (or root then chown):
sudo -u deploy git clone https://github.com/bcProFoundation/wlotus.git /opt/wlotus
cd /opt/wlotus
sudo -u deploy git checkout master
sudo -u deploy npm ci

# systemd — WorkingDirectory=/opt/wlotus, User=deploy (same unit as test)
sudo cp deploy/contabo/wlotus-mint-api.service /etc/systemd/system/
sudo cp deploy/contabo/wlotus-dana-index.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable wlotus-mint-api
sudo systemctl enable wlotus-dana-index
# Start after genesis + mint.env / dana-index.env exist (below)
```

### Create live **WLOTUS** (on this prod VM)

Do **not** reuse test `dWLOTUS` secrets, mnemonics, or deployment JSON. Test dryrun stays on Contabo **test** (`TICKER=dWLOTUS npm run create-wlotus-token`).

**Current immutable params (new genesis only):**

| Param | Value |
|-------|------:|
| Ticker | `WLOTUS` |
| Name | **W Lotus** |
| Remint | **108** = **102** miner + **6** temple |
| Initial mint | **108** → **temple P2SH** |
| `baseZeroBits` | **0** |
| Moore | **+1 bit / 500 days** |
| Batons | **28** |

```bash
cd /opt/wlotus
# Pull as deploy (not root). If deployments/mainnet-*.json block the merge,
# backup → stash/checkout → pull → restore live tip JSON (same pattern as test README).
sudo -u deploy git pull origin master
sudo -u deploy npm ci

# 1) Genesis key (NEW — not the test Contabo key)
#    If you already have GENESIS_SK_HEX for prod in .env, skip new-wallet.
npm run new-wallet -- --force   # only if starting fresh; overwrites .env
# Fund GENESIS_ADDRESS with ≥ ~900 XEC (BATONS=28 handoffs)

# 2) Real temple P2SH (IFP-style multisig / cold) — required for LIVE
export TEMPLE_ADDRESS=ecash:p…   # your prod temple

# 3) Genesis ticker WLOTUS, name "W Lotus" → deployments/mainnet-wlotus.json
#    Same script as test dryrun — only ticker differs (default WLOTUS).
TEMPLE_ADDRESS="$TEMPLE_ADDRESS" BATONS=28 npm run create-wlotus-token
# Equivalent: npm run create-prod-token
# Test uses: TICKER=dWLOTUS … npm run create-wlotus-token

# 4) Confirm on-chain record
jq '{ticker,name,tokenId,baseZeroBits,secondsPerExtraBit,mintAtomsPerRemint,initialMintAtoms,initialMintAddress,mintSplit,templeAddress,role}' \
  deployments/mainnet-wlotus.json
# → ticker "WLOTUS", name "W Lotus", baseZeroBits 0,
#   mintAtomsPerRemint "108", mintSplit { miner: "102", temple: "6" },
#   initialMintAddress == templeAddress, role "production"

# Optional smoke remint (uses GENESIS wallet as miner+fuel):
TIER=wlotus BATON_INDEX=0 TOKEN_ID=$(jq -r .tokenId deployments/mainnet-wlotus.json) \
  npm run mine-dryrun-once
```

### Desk fees + start mint-api

```bash
# Fee wallet — NEW mnemonic (do not reuse test desk)
# One phrase derives desk treasury + per-tip mint keys (keep shared for now).
# Later split: apps/mint-api/README.md § Custody.
sudo tee /etc/wlotus/mint.env >/dev/null <<'EOF'
MINT_MNEMONIC="word1 word2 ... word12"
MINT_API_PORT=8787
MINT_SERVING_TIP_COUNT=1
# Fail closed: never load dWLOTUS / dryrun JSON on this host
MINT_REQUIRE_LIVE=1
MINT_DEPLOYMENT_JSON=deployments/mainnet-wlotus.json
EOF
sudo chmod 640 /etc/wlotus/mint.env
sudo chown root:deploy /etc/wlotus/mint.env

set -a && source /etc/wlotus/mint.env && set +a
# Fund the desk address, then split fuel into tip accounts:
npm run fund-tip-fee-wallets

sudo systemctl enable --now wlotus-mint-api
# or: sudo systemctl restart wlotus-mint-api
curl -sS http://127.0.0.1:8787/health
curl -sS https://wlotus.org/api/status | jq '{ticker,tokenId,mintAtoms,powBatonCount,memorialOnBurn}'
# → ticker "WLOTUS", mintAtoms "108"
```

mint-api prefers `deployments/mainnet-wlotus.json` over dryrun files. **On Contabo prod**, set `MINT_REQUIRE_LIVE=1` (and ideally `MINT_DEPLOYMENT_JSON=deployments/mainnet-wlotus.json`) so a missing live genesis cannot silently fall back to committed `dWLOTUS` dryrun JSON.

If `/api/status` shows `ticker: "dWLOTUS"` on **wlotus.org**, the live file is missing and dryrun was loaded — create genesis + restart:

```bash
cd /opt/wlotus
ls deployments/mainnet-wlotus.json   # must exist
# If missing:
#   export TEMPLE_ADDRESS=ecash:p…   # real prod P2SH
#   BATONS=28 TEMPLE_ADDRESS="$TEMPLE_ADDRESS" npm run create-wlotus-token
# Optionally move dryrun JSON out of the way:
#   mkdir -p deployments/archive && mv deployments/mainnet-dryrun-*.json deployments/archive/
sudo systemctl restart wlotus-mint-api
curl -sS https://wlotus.org/api/status | jq '{ticker,tokenId,mintAtoms}'
```

### dana-index (prod)

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
sudo -u deploy mkdir -p /opt/wlotus/data
sudo systemctl enable --now wlotus-dana-index
curl -sS http://127.0.0.1:8788/health | jq .
```

Set GitHub Environment variable `VITE_PRAYER_TOKEN_ID` to this **tokenId** before the first prod tag (see §3).

---

## Upgrade: new live genesis

The **1/107 → 102/6** recut is **done** (`v26.8.0`). Use
**[PROD_CUTOVER_102_6.md](./PROD_CUTOVER_102_6.md)** only as a historical
checklist if you must recut **again**.

**When:** prod is already serving an **older** `WLOTUS` token id and you need
launch economics or branding that only apply to **new genesis**, for example:

- mint split **102 miner + 6 temple** (was 1 + 107)
- ALP name **W Lotus** (was `wLotus`)
- initial **108** atoms to **temple P2SH** (was genesis wallet)
- any other covenant / Moore / baton change baked at create time

**What stays true**

- The **old** token and its memorials remain on-chain forever.
- The **live** site, desk, and public index must move to the **new** `tokenId`.
- Tagging a release that only updates SPA copy **does not** migrate the covenant.

**Recommended order (prod VM)**

1. **Announce / freeze desk** (optional): stop offers while batons move  
   `sudo systemctl stop wlotus-mint-api`
2. **Pull** the master that contains the new genesis script params  
   `sudo -u deploy -H bash -lc 'cd /opt/wlotus && git pull origin master && npm ci'`
3. **Archive** the previous live record  
   ```bash
   sudo -u deploy mkdir -p /opt/wlotus/deployments/archive
   sudo -u deploy cp -a /opt/wlotus/deployments/mainnet-wlotus.json \
     "/opt/wlotus/deployments/archive/mainnet-wlotus-$(date +%Y%m%d%H%M%S).json"
   ```
4. **Create** the new live genesis (new or existing funded `GENESIS_SK_HEX`; **same** prod temple P2SH is fine)  
   ```bash
   cd /opt/wlotus
   export TEMPLE_ADDRESS=ecash:p…   # prod temple
   BATONS=28 TEMPLE_ADDRESS="$TEMPLE_ADDRESS" npm run create-wlotus-token
   NEW_ID=$(jq -r .tokenId deployments/mainnet-wlotus.json)
   jq '{ticker,name,tokenId,mintSplit,initialMintAddress,templeAddress}' deployments/mainnet-wlotus.json
   ```
5. **mint-api** — confirm `MINT_REQUIRE_LIVE=1` and `MINT_DEPLOYMENT_JSON=deployments/mainnet-wlotus.json`, refuel tips, start  
   ```bash
   set -a && source /etc/wlotus/mint.env && set +a
   npm run fund-tip-fee-wallets
   sudo systemctl restart wlotus-mint-api
   curl -sS https://wlotus.org/api/status | jq '{ticker,tokenId,mintAtoms}'
   # tokenId must be NEW_ID
   ```
6. **dana-index** — update `TOKEN_ID` and **wipe/archive the JSON store** so old-token memorials leave recent/search/OG  
7. **Temple specials** — `npm run create-temple-specials`, put `TEMPLE_SPECIALS_JSON` in `/etc/wlotus/mint.env`, restart mint-api (see [PROD_CUTOVER_102_6.md §8](./PROD_CUTOVER_102_6.md#8-create-temple-specials-vu-lan--cô-hồn))
8. **GitHub Environment `production`** — set `VITE_PRAYER_TOKEN_ID` = `NEW_ID` (keep `VITE_PRAYER_TICKER=WLOTUS`).
9. **Release** a new `v*` tag on master so **Deploy web (prod)** bakes the new id into the SPA.
10. Smoke: Offer once on https://wlotus.org; confirm `/api/status` and `/index-api/health` share the same `tokenId`, and `templeSpecials.profiles` lists Vu Lan + Cô Hồn.

**Do not** point dana-index at the new token while leaving the old store file in place —
`BurnStore` loads every row and does not filter by current `TOKEN_ID` on read.

**Clients:** the SPA clears device Recent (and related own-history keys) when
the live `tokenId` changes. Deploy the web build that records
`wlotus.liveTokenId` **before** genesis so the next bake wipes old rows.
`installId` is kept. The public index only lists the new token after step 6.

Mirror of the test cutover: [README.md — Switch to a new genesis (test)](./README.md).

---

## 3. GitHub Environment `production`

Repo → **Settings → Environments → New environment → `production`**

Optional: require reviewers before deploy.

### Secrets (Environment)

| Secret | Value |
|--------|--------|
| `CONTABO_PROD_HOST` | `wlotus.org` or prod IP |
| `CONTABO_PROD_USER` | `deploy` |
| `CONTABO_PROD_SSH_PRIVATE_KEY` | contents of `wlotus-prod-deploy` |
| `CONTABO_PROD_SSH_PORT` | `22` (optional) |
| `CONTABO_PROD_DEPLOY_PATH` | `/var/www/wlotus` (optional) |
| `CONTABO_PROD_REPO_PATH` | `/opt/wlotus` (optional) |
| `CONTABO_PROD_SMOKE_URL` | `https://wlotus.org/` |
| `MINT_MNEMONIC_PROD` | optional sync of fee mnemonic |

Keep **test** secrets (`CONTABO_HOST`, …) unchanged on the repository — they must not point at prod.

### Variables (Environment)

| Variable | Example |
|----------|---------|
| `VITE_PRAYER_TOKEN_ID` | **current** live WLOTUS token id (update on every new genesis) |
| `VITE_PRAYER_TICKER` | `WLOTUS` |
| `VITE_CHRONIK_URLS` | Chronik URLs |
| `VITE_TIP_POLL_MS` | `2000` |
| `VITE_MIN_PRAY_SECONDS` | `108` |
| `VITE_EXPERIMENTAL_POW` | `1` (WebGPU launch path) |

---

## 4. Release (tag → prod)

Only after the change is on **master**:

```bash
git checkout master
git pull origin master

# Annotated tag (recommended)
git tag -a v1.0.0 -m "WLotus prod v1.0.0"
git push origin v1.0.0
```

That starts **Deploy web (prod)**. The job:

1. Checks the tagged commit is an ancestor of `origin/master`
2. Builds the SPA with production `VITE_*`
3. Rsyncs to `/var/www/wlotus`
4. Checks out the same tag under `/opt/wlotus` and restarts mint-api
5. If secret `DANAVERSE_WLOTUS_TOKEN` is set, snapshots covenant + `apps/web` to public [danaverse/wlotus](https://github.com/danaverse/wlotus) (`scripts/sync-danaverse-wlotus.sh`)
5. Optional smoke curl

Manual: Actions → **Deploy web (prod)** → Run workflow → set `ref` to `v1.0.0`.

### Tag naming

Use semver: `v1.0.0`, `v1.0.1`, `v1.1.0`. Workflow matches `v*`.

---

## 5. Checklist before first prod tag

- [ ] Prod VM bootstrapped; DNS + TLS green; www → apex 301
- [ ] Live genesis: `deployments/mainnet-wlotus.json` with ticker **WLOTUS**, name **W Lotus**, mintAtoms **108**, split **102/6**
- [ ] `/api/status` returns that ticker / tokenId on prod
- [ ] `/api/status` → `templeSpecials.profiles` lists Vu Lan + Cô Hồn (`TEMPLE_SPECIAL_TEST_OFFSET_DAYS=0`)
- [ ] dana-index `TOKEN_ID` matches; store not mixing an older token’s burns
- [ ] Tip fee wallets funded (`npm run fund-tip-fee-wallets`)
- [ ] GitHub Environment `production` secrets + `VITE_PRAYER_TOKEN_ID` / `VITE_PRAYER_TICKER=WLOTUS`
- [ ] Test site still deploys from master without touching prod
- [ ] Tag only after master is green on test

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Job fails “not an ancestor of master” | Tag a commit that is already merged to master |
| Permission denied / `sudo: a password is required` on mint-api restart | `/etc/sudoers.d/wlotus-deploy` missing, or lists only `/bin/systemctl` (Ubuntu usrmerge matches `/usr/bin/systemctl`) | As root: `sudo bash /opt/wlotus/deploy/contabo/install-wlotus-deploy-sudoers.sh` (or re-run bootstrap-prod). Then re-tag / Deploy web (prod). |
| Site updates but API old | Ensure `/opt/wlotus` clone exists and `CONTABO_PROD_REPO_PATH` is correct |
| `npm ci` EACCES on `/opt/wlotus/node_modules` | Repo owned by **root**; CI user `deploy` cannot delete packages. **Fix once as root:** `sudo chown -R deploy:deploy /opt/wlotus`. Re-run bootstrap from **latest master** so sudoers matches CI (`chown -R deploy:deploy /opt/wlotus`). Prod deploys run the workflow from the **tag** — cut a new `v*` tag after this fix lands on master. |
| `insufficient permission` on `.git/objects` during fetch | Clone was git-fetched as **root**. Workflow now chowns before fetch. Once as root: `sudo chown -R deploy:deploy /opt/wlotus` |
| Wrong ticker on SPA | Set Environment variable `VITE_PRAYER_TICKER=WLOTUS` (not repo test var) |
| SPA still uses **previous** token after new genesis | Update Environment `VITE_PRAYER_TOKEN_ID` + new `v*` tag / Deploy web (prod) |
| Recent / search shows **old-token** memorials | Archive dana-index store + set `TOKEN_ID` to new id + restart (see [Upgrade: new live genesis](#upgrade-new-live-genesis)) |
| Accidental test deploy to prod | Confirm secrets are `CONTABO_PROD_*` on Environment `production` only |
| `dWLOTUS` on prod `/api/status` | Live genesis missing — mint-api fell back to committed dryrun JSON. Create `mainnet-wlotus.json` with `npm run create-wlotus-token`, set `MINT_REQUIRE_LIVE=1` in `/etc/wlotus/mint.env`, restart mint-api |
| Missing temple on WLOTUS | Pass `TEMPLE_ADDRESS=ecash:p…` (required for ticker WLOTUS; no dryrun wrap) |
| `mintAtoms: "100"` or split still 1/107 on status | Old deployment — **new genesis** required; cannot mutate live covenant |
| iPhone (Safari/PWA) keeps showing an old build after a deploy, but Android/desktop is fine | `/sw.js` had no explicit `Cache-Control`, so WebKit can serve it from its HTTP cache instead of hitting the network on `registration.update()`, pinning the old JS/CSS bundle indefinitely | Merge the `location = /sw.js { add_header Cache-Control "no-cache"; }` (+ `manifest.webmanifest`) block from `nginx-wlotus-prod-tls.conf` into the live **443** server block, then `sudo nginx -t && sudo systemctl reload nginx`. On the phone, fully close the PWA/tab once (not just background it) to pick up the fix. |
