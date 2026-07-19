# WLotus web deploy guide

**Live test site:** https://test.wlotus.org

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
VITE_PRAYER_TOKEN_ID=a108b17f5050e354641c7de26d16d97e6a1019dd0a273e92bc8aced2fff74914
VITE_PRAYER_TICKER=dPRAYER
VITE_CHRONIK_URLS=https://chronik.e.cash,https://chronik.pay2stay.com/xec
```

Defaults match the live dryrun **dPRAYER** token. No VM or GitHub secrets needed for local dev.

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
| `VITE_PRAYER_TOKEN_ID` | no | dual-mint dryrun id |
| `VITE_PRAYER_TICKER` | no | `dPRAYER` |
| `VITE_CHRONIK_URLS` | no | Chronik URLs |
| `MINT_MNEMONIC` | no* | 12/24-word **fee wallet** — synced to `/etc/wlotus/mint.env` |

\*Mint fee wallet **must** exist on the VM for `mint-api`. Prefer writing `/etc/wlotus/mint.env` once on Contabo. GitHub `MINT_MNEMONIC` is only an optional way to refresh that file on deploy — Actions alone cannot pay fees.

See [apps/mint-api/README.md](../../apps/mint-api/README.md).

---

## 4. Deploy / update the live site (CI)

Workflow: **Deploy web (test)** — `.github/workflows/deploy-web-test.yml`

| Trigger | When |
|---------|------|
| **Automatic** | Push to `master` that touches `apps/web/**`, `apps/mint-api/**`, `package.json`, workflow, or `deploy/contabo/**` |
| **Manual** | Actions → Deploy web (test) → **Run workflow** (use branch **master** only) |

Feature branches do **not** trigger deploy (cost control).

Steps: `npm ci` → `npm run web:build` → rsync `apps/web/dist/` → VM.

After a green run, https://test.wlotus.org serves the new build (hard-refresh if cached).

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
| Update clone (optional) | `cd ~/wlotus && git pull` — **does not update the website** |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `git pull` but site unchanged | Repo ≠ web root | Run CI workflow or manual rsync |
| `getaddrinfo: Name or service not known` | Bad `CONTABO_HOST` | Use `test.wlotus.org` or IP, no scheme |
| `Permission denied (publickey)` | Key not on VM | Copy `.pub` to `/home/deploy/.ssh/authorized_keys` |
| `wlotus-deploy.pub` not on VM | Expected | Generate on laptop; only **public** key goes on VM |
| Node 20 deprecation warning in Actions | GitHub runner notice | Warning only — not a deploy failure |
| Smoke check fails | Site/DNS/TLS not ready | Fix HTTP first; set `CONTABO_SMOKE_URL` after |
| 403 / blank page | nginx or empty dist | `ls /var/www/wlotus-test`; re-run workflow |

---

## Architecture (reference)

```
GitHub Actions (build Vite dist)
        │  SSH + rsync
        ▼
Contabo VM  →  nginx  →  /var/www/wlotus-test  →  test.wlotus.org
```

Fees are paid in XEC by the user’s browser wallet; this stack only hosts the frontend.
