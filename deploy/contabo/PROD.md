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
| A | `www` | Same IP (optional) |

### Deploy SSH key (separate from test)

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

## 2. One-time: mint-api on prod

```bash
sudo mkdir -p /opt/wlotus /etc/wlotus
sudo chown -R deploy:deploy /opt/wlotus

# As deploy (or root then chown):
sudo -u deploy git clone https://github.com/bcProFoundation/wlotus.git /opt/wlotus
cd /opt/wlotus
sudo -u deploy git checkout master
sudo -u deploy npm ci

# Fee wallet — use a NEW mnemonic (do not reuse test desk)
sudo tee /etc/wlotus/mint.env >/dev/null <<'EOF'
MINT_MNEMONIC="word1 word2 ... word12"
MINT_API_PORT=8787
MINT_SERVING_TIP_COUNT=2
EOF
sudo chmod 600 /etc/wlotus/mint.env

# systemd — WorkingDirectory=/opt/wlotus
sudo sed 's|/root/wlotus/wlotus|/opt/wlotus|g' deploy/contabo/wlotus-mint-api.service \
  | sudo tee /etc/systemd/system/wlotus-mint-api.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now wlotus-mint-api
curl -sS http://127.0.0.1:8787/health
```

Create / point the **live WLOTUS** deployment JSON on this clone (`deployments/…`), fund desk + tip wallets (`npm run fund-tip-fee-wallets`), restart mint-api. Do **not** copy test `dWLOTUS` secrets or mnemonics.

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

- [ ] Prod VM bootstrapped; DNS + TLS green
- [ ] `/api/status` returns expected ticker / tokenId on prod
- [ ] Tip fee wallets funded
- [ ] GitHub Environment `production` secrets + vars set
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
