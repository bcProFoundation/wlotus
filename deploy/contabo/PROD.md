# Production deploy (wlotus.org)

**Prod site:** https://wlotus.org (separate Contabo VM from test)  
**Release rule:** GitHub Actions **Deploy web (prod)** runs when a **`v*` tag** is pushed, and only if that commit is on **`master`**.

Test (`test.wlotus.org`) stays on push-to-master via **Deploy web (test)**.

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
cd /opt/wlotus && git pull origin master   # or copy files from laptop

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

# systemd — WorkingDirectory=/opt/wlotus
sudo sed 's|/root/wlotus/wlotus|/opt/wlotus|g' deploy/contabo/wlotus-mint-api.service \
  | sudo tee /etc/systemd/system/wlotus-mint-api.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable wlotus-mint-api
# Start after genesis + mint.env exist (below)
```

### Create live **WLOTUS** (on this prod VM)

Do **not** reuse test `dWLOTUS` secrets, mnemonics, or deployment JSON. Test dryrun stays on Contabo **test** (`TICKER=dWLOTUS npm run create-wlotus-token`).

```bash
cd /opt/wlotus   # or ~/wlotus/wlotus
git pull origin master
npm ci

# 1) Genesis key (NEW — not the test Contabo key)
#    If you already have GENESIS_SK_HEX for prod in .env, skip new-wallet.
npm run new-wallet -- --force   # only if starting fresh; overwrites .env
# Fund GENESIS_ADDRESS with ≥ ~900 XEC (BATONS=28 handoffs)

# 2) Real temple P2SH (IFP-style multisig / cold) — required for LIVE
export TEMPLE_ADDRESS=ecash:p…   # your prod temple

# 3) Genesis ticker WLOTUS, name wLotus → deployments/mainnet-wlotus.json
#    Same script as test dryrun — only ticker differs (default WLOTUS).
TEMPLE_ADDRESS="$TEMPLE_ADDRESS" BATONS=28 npm run create-wlotus-token
# Equivalent: npm run create-prod-token
# Test uses: TICKER=dWLOTUS … npm run create-wlotus-token

# 4) Confirm on-chain record
jq '{ticker,name,tokenId,baseZeroBits,secondsPerExtraBit,mintAtomsPerRemint,initialMintAtoms,mintSplit,templeAddress,role}' \
  deployments/mainnet-wlotus.json
# → ticker "WLOTUS", baseZeroBits 0, mintAtomsPerRemint "108", initialMintAtoms "108", role "production"

# Optional smoke remint (uses GENESIS wallet as miner+fuel):
TIER=wlotus BATON_INDEX=0 TOKEN_ID=$(jq -r .tokenId deployments/mainnet-wlotus.json) \
  npm run mine-dryrun-once
```

### Desk fees + start mint-api

```bash
# Fee wallet — NEW mnemonic (do not reuse test desk)
sudo tee /etc/wlotus/mint.env >/dev/null <<'EOF'
MINT_MNEMONIC="word1 word2 ... word12"
MINT_API_PORT=8787
MINT_SERVING_TIP_COUNT=1
EOF
sudo chmod 600 /etc/wlotus/mint.env

set -a && source /etc/wlotus/mint.env && set +a
# Fund the desk address, then split fuel into tip accounts:
npm run fund-tip-fee-wallets

sudo systemctl enable --now wlotus-mint-api
# or: sudo systemctl restart wlotus-mint-api
curl -sS http://127.0.0.1:8787/health
curl -sS https://wlotus.org/api/status | jq '{ticker,tokenId,mintAtoms,powBatonCount,memorialOnBurn}'
# → ticker "WLOTUS", mintAtoms "108"
```

mint-api prefers `deployments/mainnet-wlotus.json` over dryrun files. On prod, keep **no** `mainnet-dryrun-*.json` (or ensure the live file exists first).

Set GitHub Environment variable `VITE_PRAYER_TOKEN_ID` to this **tokenId** before the first prod tag (see §3).

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
| `VITE_PRAYER_TOKEN_ID` | live WLOTUS token id |
| `VITE_PRAYER_TICKER` | `WLOTUS` |
| `VITE_CHRONIK_URLS` | Chronik URLs |
| `VITE_TIP_POLL_MS` | `2000` |
| `VITE_MIN_PRAY_SECONDS` | `60` |
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
5. Optional smoke curl

Manual: Actions → **Deploy web (prod)** → Run workflow → set `ref` to `v1.0.0`.

### Tag naming

Use semver: `v1.0.0`, `v1.0.1`, `v1.1.0`. Workflow matches `v*`.

---

## 5. Checklist before first prod tag

- [ ] Prod VM bootstrapped; DNS + TLS green; www → apex 301
- [ ] Live genesis: `deployments/mainnet-wlotus.json` with ticker **WLOTUS**, mintAtoms **108**
- [ ] `/api/status` returns that ticker / tokenId on prod
- [ ] Tip fee wallets funded (`npm run fund-tip-fee-wallets`)
- [ ] GitHub Environment `production` secrets + `VITE_PRAYER_TOKEN_ID` / `VITE_PRAYER_TICKER=WLOTUS`
- [ ] Test site still deploys from master without touching prod
- [ ] Tag only after master is green on test

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Job fails “not an ancestor of master” | Tag a commit that is already merged to master |
| Permission denied on mint-api restart | Re-run bootstrap or fix `/etc/sudoers.d/wlotus-deploy` |
| Site updates but API old | Ensure `/opt/wlotus` clone exists and `CONTABO_PROD_REPO_PATH` is correct |
| Wrong ticker on SPA | Set Environment variable `VITE_PRAYER_TICKER=WLOTUS` (not repo test var) |
| Accidental test deploy to prod | Confirm secrets are `CONTABO_PROD_*` on Environment `production` only |
| `dWLOTUS` on prod `/api/status` | You loaded a dryrun JSON — create live with `npm run create-wlotus-token` (default ticker WLOTUS) and ensure `mainnet-wlotus.json` exists |
| Missing temple on WLOTUS | Pass `TEMPLE_ADDRESS=ecash:p…` (required for ticker WLOTUS; no dryrun wrap) |
