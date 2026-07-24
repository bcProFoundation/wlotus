#!/usr/bin/env bash
# Start over: put the Contabo mint tree at /opt/wlotus (same layout as prod).
#
# Run as root on the **test** VM (or prod if intentionally resetting the clone):
#   sudo bash deploy/contabo/bootstrap-opt-wlotus.sh
#
# Optional:
#   OLD_REPO=/root/wlotus/wlotus   # copy deployments/*.json from here (default: auto-detect)
#   BRANCH=master                  # git branch/tag to check out
#   SKIP_DANA_INDEX=1              # mint-api only
#   KEEP_OLD_REPO=1                # do not rename away ~/wlotus/wlotus after success
#
# Preserves:
#   /etc/wlotus/mint.env
#   deployments/*.json from OLD_REPO (dryrun / live genesis — do not recreate)
#
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

DEPLOY_USER="${DEPLOY_USER:-deploy}"
REPO="/opt/wlotus"
BRANCH="${BRANCH:-master}"
GIT_URL="${GIT_URL:-https://github.com/bcProFoundation/wlotus.git}"
OLD_REPO="${OLD_REPO:-}"
SKIP_DANA_INDEX="${SKIP_DANA_INDEX:-0}"
KEEP_OLD_REPO="${KEEP_OLD_REPO:-0}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="/root/wlotus-migrate-${STAMP}"

if [[ -z "$OLD_REPO" ]]; then
  for cand in /root/wlotus/wlotus /home/deploy/wlotus/wlotus /root/wlotus; do
    if [[ -d "$cand/deployments" || -f "$cand/package.json" ]]; then
      OLD_REPO="$cand"
      break
    fi
  done
fi

echo "==> Stop services"
systemctl stop wlotus-mint-api 2>/dev/null || true
systemctl stop wlotus-dana-index 2>/dev/null || true

if ! id "$DEPLOY_USER" &>/dev/null; then
  echo "==> Create user $DEPLOY_USER"
  adduser --disabled-password --gecos '' "$DEPLOY_USER"
fi

mkdir -p /etc/wlotus /var/lib/wlotus "$BACKUP_ROOT"
chown "$DEPLOY_USER:$DEPLOY_USER" /var/lib/wlotus

if [[ -n "$OLD_REPO" && -d "$OLD_REPO" ]]; then
  echo "==> Backup deployments / .env from $OLD_REPO → $BACKUP_ROOT"
  mkdir -p "$BACKUP_ROOT/deployments"
  if [[ -d "$OLD_REPO/deployments" ]]; then
    cp -a "$OLD_REPO/deployments/." "$BACKUP_ROOT/deployments/" || true
  fi
  [[ -f "$OLD_REPO/.env" ]] && cp -a "$OLD_REPO/.env" "$BACKUP_ROOT/.env" || true
else
  echo "==> No OLD_REPO found — will use whatever is already in git (committed dryrun JSON)"
fi

if [[ -d "$REPO" ]]; then
  echo "==> Move existing $REPO → ${REPO}.bak-${STAMP}"
  mv "$REPO" "${REPO}.bak-${STAMP}"
fi

echo "==> Clone $GIT_URL → $REPO (branch $BRANCH)"
mkdir -p "$(dirname "$REPO")"
sudo -u "$DEPLOY_USER" git clone "$GIT_URL" "$REPO"
sudo -u "$DEPLOY_USER" bash -lc "cd '$REPO' && git checkout '$BRANCH' && git pull --ff-only origin '$BRANCH' || true"

if [[ -d "$BACKUP_ROOT/deployments" ]]; then
  echo "==> Restore deployments from backup (preserve dryrun/live genesis)"
  # Prefer server copies over committed dryrun if present
  shopt -s nullglob
  for f in "$BACKUP_ROOT"/deployments/mainnet-*.json; do
    base="$(basename "$f")"
    cp -a "$f" "$REPO/deployments/$base"
    chown "$DEPLOY_USER:$DEPLOY_USER" "$REPO/deployments/$base"
    echo "    restored deployments/$base"
  done
  shopt -u nullglob
fi
if [[ -f "$BACKUP_ROOT/.env" ]]; then
  cp -a "$BACKUP_ROOT/.env" "$REPO/.env"
  chown "$DEPLOY_USER:$DEPLOY_USER" "$REPO/.env"
  chmod 600 "$REPO/.env"
  echo "==> Restored .env (genesis keys) — keep private"
fi

if [[ ! -f /etc/wlotus/mint.env ]]; then
  echo "WARN: /etc/wlotus/mint.env missing — create it before mint-api will serve." >&2
else
  # deploy must read mint.env
  chown root:"$DEPLOY_USER" /etc/wlotus/mint.env
  chmod 640 /etc/wlotus/mint.env
fi

echo "==> npm ci"
sudo -u "$DEPLOY_USER" bash -lc "cd '$REPO' && npm ci"
chmod +x "$REPO/deploy/contabo/run-mint-api.sh"
[[ -f "$REPO/deploy/contabo/run-dana-index.sh" ]] && \
  chmod +x "$REPO/deploy/contabo/run-dana-index.sh"

echo "==> Install systemd units (/opt/wlotus, User=$DEPLOY_USER)"
cp "$REPO/deploy/contabo/wlotus-mint-api.service" /etc/systemd/system/
HAVE_DANA=0
if [[ "$SKIP_DANA_INDEX" != "1" && -f "$REPO/deploy/contabo/wlotus-dana-index.service" ]]; then
  HAVE_DANA=1
  cp "$REPO/deploy/contabo/wlotus-dana-index.service" /etc/systemd/system/
elif [[ "$SKIP_DANA_INDEX" != "1" ]]; then
  echo "WARN: dana-index not in this checkout — merge PR #64 or set BRANCH to that branch" >&2
fi

# Passwordless restarts for CI/deploy (same idea as bootstrap-prod)
if [[ "$HAVE_DANA" == "1" ]]; then
  cat >/etc/sudoers.d/wlotus-deploy <<EOF
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/systemctl try-restart wlotus-mint-api.service, /bin/systemctl restart wlotus-mint-api.service, /bin/systemctl try-restart wlotus-dana-index.service, /bin/systemctl restart wlotus-dana-index.service, /bin/mkdir -p /etc/wlotus, /usr/bin/tee /etc/wlotus/mint.env, /usr/bin/tee /etc/wlotus/dana-index.env, /bin/chmod 600 /etc/wlotus/mint.env, /bin/chmod 600 /etc/wlotus/dana-index.env, /bin/chown -R ${DEPLOY_USER}\:${DEPLOY_USER} /opt/wlotus, /bin/rm -rf /opt/wlotus/node_modules
EOF
else
  cat >/etc/sudoers.d/wlotus-deploy <<EOF
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/systemctl try-restart wlotus-mint-api.service, /bin/systemctl restart wlotus-mint-api.service, /bin/mkdir -p /etc/wlotus, /usr/bin/tee /etc/wlotus/mint.env, /bin/chmod 600 /etc/wlotus/mint.env, /bin/chown -R ${DEPLOY_USER}\:${DEPLOY_USER} /opt/wlotus, /bin/rm -rf /opt/wlotus/node_modules
EOF
fi
chmod 440 /etc/sudoers.d/wlotus-deploy

TOKEN_ID=""
for dep in \
  "$REPO/deployments/mainnet-dryrun-wlotus.json" \
  "$REPO/deployments/mainnet-dryrun-active.json" \
  "$REPO/deployments/mainnet-wlotus.json"; do
  if [[ -f "$dep" ]]; then
    TOKEN_ID="$(jq -r '.tokenId // empty' "$dep" 2>/dev/null || true)"
    [[ -n "$TOKEN_ID" && "$TOKEN_ID" != "null" ]] && break
  fi
done

if [[ "$HAVE_DANA" == "1" ]]; then
  if [[ -z "$TOKEN_ID" ]]; then
    echo "WARN: no tokenId in deployments — write TOKEN_ID into /etc/wlotus/dana-index.env manually" >&2
  else
    echo "==> /etc/wlotus/dana-index.env (TOKEN_ID from deployments)"
    cat >/etc/wlotus/dana-index.env <<EOF
TOKEN_ID=${TOKEN_ID}
DANA_INDEX_PORT=8788
DANA_INDEX_STORE=/var/lib/wlotus/dana-index-burns.json
DANA_INDEX_POLL_MS=30000
DANA_INDEX_BACKFILL_PAGES=30
EOF
    chown "$DEPLOY_USER:$DEPLOY_USER" /etc/wlotus/dana-index.env
    chmod 600 /etc/wlotus/dana-index.env
  fi
  if [[ -f /etc/wlotus/mint.env ]] && ! grep -q '^DANA_INDEX_URL=' /etc/wlotus/mint.env; then
    echo 'DANA_INDEX_URL=http://127.0.0.1:8788' >>/etc/wlotus/mint.env
  fi
fi

systemctl daemon-reload
systemctl enable wlotus-mint-api
systemctl restart wlotus-mint-api
if [[ "$HAVE_DANA" == "1" ]]; then
  systemctl enable wlotus-dana-index
  systemctl restart wlotus-dana-index
fi

sleep 2
echo "==> Status"
systemctl --no-pager --full status wlotus-mint-api || true
[[ "$HAVE_DANA" == "1" ]] && systemctl --no-pager --full status wlotus-dana-index || true

echo "==> Health"
curl -sS --max-time 5 http://127.0.0.1:8787/health || echo "mint-api health failed"
[[ "$HAVE_DANA" == "1" ]] && \
  curl -sS --max-time 5 http://127.0.0.1:8788/health || echo "dana-index health failed"

if [[ "$KEEP_OLD_REPO" != "1" && -n "$OLD_REPO" && -d "$OLD_REPO" && "$OLD_REPO" != "$REPO" ]]; then
  echo "==> Rename old tree ${OLD_REPO} → ${OLD_REPO}.bak-${STAMP}"
  mv "$OLD_REPO" "${OLD_REPO}.bak-${STAMP}"
fi

cat <<EOF

Done. Layout matches prod:

  Repo:     $REPO  (user $DEPLOY_USER)
  mint.env: /etc/wlotus/mint.env
  index:    /etc/wlotus/dana-index.env
  backup:   $BACKUP_ROOT

Nginx: ensure /index-api/ proxies to 127.0.0.1:8788 (nginx-api-snippet.conf).
Do not use /root/wlotus/wlotus for systemd anymore.
EOF
