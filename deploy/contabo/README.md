# Contabo test deploy (WLotus web)

Static SPA (`apps/web`) → Contabo VM via GitHub Actions + rsync.

## Architecture

```
GitHub Actions (build Vite dist)
        │  SSH + rsync
        ▼
Contabo VM  →  nginx  →  /var/www/wlotus-test
```

Fees still paid in XEC by the browser wallet; this only hosts the frontend.

## 1. One-time VM setup

SSH into the Contabo box (Ubuntu/Debian), then from a clone of this repo:

```bash
sudo bash deploy/contabo/bootstrap.sh test.wlotus.org
```

Or copy `bootstrap.sh` + `nginx-wlotus-test.conf` to the VM and run the same command.

That installs nginx, opens HTTP/HTTPS/SSH in ufw, creates `/var/www/wlotus-test`, and a `deploy` user.

## 2. Deploy SSH key

On your laptop (or CI secret store):

```bash
ssh-keygen -t ed25519 -C "wlotus-github-deploy" -f ./wlotus-deploy -N ""
```

On the VM:

```bash
cat wlotus-deploy.pub >> /home/deploy/.ssh/authorized_keys
```

Keep `wlotus-deploy` (private) for GitHub only — never commit it.

## 3. GitHub secrets

Repo → **Settings → Secrets and variables → Actions**:

| Secret | Required | Example |
|--------|----------|---------|
| `CONTABO_HOST` | yes | `12.34.56.78` or `test.wlotus.org` |
| `CONTABO_USER` | yes | `deploy` |
| `CONTABO_SSH_PRIVATE_KEY` | yes | full contents of `wlotus-deploy` |
| `CONTABO_SSH_PORT` | no | `22` |
| `CONTABO_DEPLOY_PATH` | no | `/var/www/wlotus-test` |
| `CONTABO_SMOKE_URL` | no | `https://test.wlotus.org/` |
| `VITE_PRAYER_TOKEN_ID` | no | dryrun id (baked at build) |
| `VITE_PRAYER_TICKER` | no | `dPRAYER` |
| `VITE_CHRONIK_URLS` | no | Chronik URLs |

## 4. Deploy

Workflow: **Deploy web (test)** (`.github/workflows/deploy-web-test.yml`)

- Manual: Actions → Deploy web (test) → **Run workflow**
- Auto: push that touches `apps/web/**` on `cursor/wlotus-offer-app-58ff`, `master`, or `main`

## 5. TLS (after DNS)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d test.wlotus.org
```

## Local dry-run of the same rsync

```bash
npm run web:build
rsync -avz --delete apps/web/dist/ deploy@YOUR_HOST:/var/www/wlotus-test/
```

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Permission denied (publickey) | `authorized_keys` for `deploy`; secret is private key PEM/ed25519 |
| rsync: mkstemp failed | `deploy` owns `/var/www/wlotus-test` (bootstrap sets this) |
| 403 / blank | `nginx -t`; `ls -la /var/www/wlotus-test` after deploy |
| Smoke step fails | Set `CONTABO_SMOKE_URL` only after HTTP answers |
| Workflow “secret not set” | Add the three required secrets; re-run |
