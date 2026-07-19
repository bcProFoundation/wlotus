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

## 1. One-time VM setup (step by step)

Assumes a fresh Contabo VPS with **Ubuntu 22.04/24.04** (or Debian) and SSH access as `root` (or a sudo user).

Replace `YOUR_VM_IP` with the Contabo public IP from the customer panel.
Replace `test.wlotus.org` with your test hostname (or skip DNS for now and use the IP).

### 1.1 — Confirm you can SSH in

From your laptop:

```bash
ssh root@YOUR_VM_IP
```

If Contabo gave you a non-root sudo user:

```bash
ssh ubuntu@YOUR_VM_IP
sudo -i   # become root for the rest of the steps
```

You should land in a shell on the VM. Stay there for 1.2–1.4 (or use a second terminal for the laptop-side copy).

### 1.2 — Get the bootstrap files onto the VM

**Option A — clone the repo on the VM (simplest):**

```bash
apt-get update -y
apt-get install -y git
git clone https://github.com/bcProFoundation/wlotus.git
cd wlotus
git checkout cursor/wlotus-offer-app-58ff   # branch that has deploy/contabo/
```

**Option B — copy only the two files from your laptop** (no git on the VM):

On the **laptop** (from your local clone):

```bash
scp deploy/contabo/bootstrap.sh \
    deploy/contabo/nginx-wlotus-test.conf \
    root@YOUR_VM_IP:~/
```

On the **VM**:

```bash
mkdir -p ~/wlotus-bootstrap
mv ~/bootstrap.sh ~/nginx-wlotus-test.conf ~/wlotus-bootstrap/
cd ~/wlotus-bootstrap
chmod +x bootstrap.sh
```

`bootstrap.sh` looks for `nginx-wlotus-test.conf` **next to itself**, so keep them in the same directory.

### 1.3 — Run bootstrap

**If you used Option A (full clone):**

```bash
cd ~/wlotus   # or wherever you cloned
sudo bash deploy/contabo/bootstrap.sh test.wlotus.org
```

**If you used Option B (two files only):**

```bash
cd ~/wlotus-bootstrap
sudo bash bootstrap.sh test.wlotus.org
```

Notes:

- `test.wlotus.org` is written into nginx as `server_name`. Use your real test hostname, or pass `_` / omit it if you only have an IP for now:
  ```bash
  sudo bash deploy/contabo/bootstrap.sh
  ```
- The script **must** run as root (`sudo`). It will exit with `Run as root (sudo).` otherwise.
- Expect a few minutes the first time (apt installs nginx, rsync, ufw, curl).

### 1.4 — What the script does

| Step | Effect |
|------|--------|
| `apt-get install nginx rsync ufw curl` | Web server + tools CI needs |
| Creates `/var/www/wlotus-test` | Deploy target for rsync |
| Writes a placeholder `index.html` | “waiting for first CI deploy” page |
| Installs nginx site `wlotus-test` | Serves that directory as an SPA |
| Removes default nginx site | Avoids the default welcome page winning |
| Enables ufw: SSH + HTTP + HTTPS | Keeps SSH open; opens 80/443 |
| Creates user `deploy` | Passwordless account for GitHub Actions |
| Gives `deploy` write access to the web root | So rsync can update files |

When it finishes you should see a `Bootstrap done.` summary with paths and next steps.

### 1.5 — Verify before leaving the VM

```bash
# nginx config OK and running
nginx -t
systemctl status nginx --no-pager

# placeholder site is present
ls -la /var/www/wlotus-test/

# deploy user exists
id deploy
ls -la /home/deploy/.ssh/
```

From your **laptop** browser or curl (HTTP, not HTTPS yet):

```bash
curl -sS http://YOUR_VM_IP/ | head
```

You should see the placeholder text: *WLotus test host ready — waiting for first CI deploy.*

If that fails: Contabo firewall/security group may still block port 80 — open **TCP 80** (and later **443**) in the Contabo panel as well as ufw.

### 1.6 — After bootstrap (still required)

Bootstrap does **not** add your CI SSH key or GitHub secrets. Continue with sections **2** (deploy key), **3** (secrets), **4** (run workflow), then **5** (TLS once DNS points at the VM).

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
