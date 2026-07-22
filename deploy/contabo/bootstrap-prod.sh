#!/usr/bin/env bash
# One-time Contabo VM bootstrap for the WLotus **production** SPA.
# Run as root on Ubuntu/Debian:
#   sudo bash bootstrap-prod.sh wlotus.org
#
# Uses a separate web root from test so both can coexist on different VMs
# (recommended: prod on its own server).

set -euo pipefail

SERVER_NAME="${1:-wlotus.org}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/wlotus}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
SITE_NAME=wlotus

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx rsync ufw curl git

mkdir -p "$DEPLOY_PATH"
chown -R www-data:www-data "$DEPLOY_PATH"
chmod 755 "$DEPLOY_PATH"

if [[ ! -f "$DEPLOY_PATH/index.html" ]]; then
  cat >"$DEPLOY_PATH/index.html" <<'HTML'
<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><title>WLotus</title></head>
  <body><p>WLotus production host ready — waiting for first tag deploy.</p></body>
</html>
HTML
  chown www-data:www-data "$DEPLOY_PATH/index.html"
fi

SITE_SRC="$(cd "$(dirname "$0")" && pwd)/nginx-wlotus-prod.conf"
SITE_DST="/etc/nginx/sites-available/${SITE_NAME}"

# Never clobber a Certbot-managed site. Re-running bootstrap after TLS used to:
#  1) overwrite listen 443 / ssl_* with the HTTP-only template, and/or
#  2) sed every server_name → "wlotus.org www.wlotus.org", merging the www→apex
#     redirect onto the apex host → https://wlotus.org 301→ itself forever.
if [[ -f "$SITE_DST" ]] && grep -qE 'listen[[:space:]]+443|ssl_certificate' "$SITE_DST"; then
  echo "Keeping existing nginx site (TLS present): $SITE_DST"
  echo "  HTTP-only template was NOT applied. To recover a 301 loop, see PROD.md"
  echo "  or install deploy/contabo/nginx-wlotus-prod-tls.conf manually."
else
  if [[ -f "$SITE_SRC" ]]; then
    cp "$SITE_SRC" "$SITE_DST"
  else
    cat >"$SITE_DST" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${SERVER_NAME};
    root ${DEPLOY_PATH};
    index index.html;
    location / { try_files \$uri \$uri/ /index.html; }
}
EOF
  fi

  # Do NOT sed all server_name lines. nginx-wlotus-prod.conf already has
  # separate blocks: www → apex redirect, and apex SPA.
  if [[ "$SERVER_NAME" != "wlotus.org" && "$SERVER_NAME" != "_" ]]; then
    echo "Warning: template is for wlotus.org; custom name $SERVER_NAME left unpatched." >&2
    echo "  Edit $SITE_DST server_name lines by hand." >&2
  fi
fi

ln -sfn "$SITE_DST" "/etc/nginx/sites-enabled/${SITE_NAME}"
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl reload nginx

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable || true

if ! id "$DEPLOY_USER" &>/dev/null; then
  adduser --disabled-password --gecos '' "$DEPLOY_USER"
fi
usermod -aG www-data "$DEPLOY_USER"
# Passwordless sudo for mint-api restart, mint.env, and fixing /opt/wlotus ownership (CI npm ci)
cat >/etc/sudoers.d/wlotus-deploy <<EOF
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/systemctl try-restart wlotus-mint-api.service, /bin/systemctl restart wlotus-mint-api.service, /bin/mkdir -p /etc/wlotus, /usr/bin/tee /etc/wlotus/mint.env, /bin/chmod 600 /etc/wlotus/mint.env, /bin/chown -R ${DEPLOY_USER}\:${DEPLOY_USER} /opt/wlotus, /bin/rm -rf /opt/wlotus/node_modules
EOF
chmod 440 /etc/sudoers.d/wlotus-deploy

mkdir -p "/home/$DEPLOY_USER/.ssh"
chmod 700 "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"

chown -R "$DEPLOY_USER:www-data" "$DEPLOY_PATH"
chmod -R g+rwX "$DEPLOY_PATH"

# Mint-api clone: always owned by deploy (CI npm ci). Safe if missing.
if [[ -d /opt/wlotus ]]; then
  chown -R "$DEPLOY_USER:$DEPLOY_USER" /opt/wlotus
  echo "Fixed ownership: /opt/wlotus → $DEPLOY_USER"
fi

cat <<EOF

Production bootstrap done.

  Web root:     $DEPLOY_PATH
  Nginx site:   ${SITE_NAME} (server_name=$SERVER_NAME)
  Deploy user:  $DEPLOY_USER

If mint-api lives at /opt/wlotus and CI hits npm EACCES:
  sudo chown -R $DEPLOY_USER:$DEPLOY_USER /opt/wlotus
  (bootstrap now does this automatically when /opt/wlotus exists)

Next:
  1. Append CI public key to /home/$DEPLOY_USER/.ssh/authorized_keys
  2. DNS A for wlotus.org and www → this VM (same IP)
  3. TLS (once): certbot --nginx -d wlotus.org -d www.wlotus.org
     Do NOT re-run this bootstrap after TLS — it will skip overwriting the site.
     If apex HTTPS 301-loops to itself, install nginx-wlotus-prod-tls.conf (PROD.md).
  4. Mint-api: clone to /opt/wlotus, /etc/wlotus/mint.env, systemd (see README)
  5. GitHub Environment "production" secrets:
       CONTABO_PROD_HOST=<this host>
       CONTABO_PROD_USER=$DEPLOY_USER
       CONTABO_PROD_SSH_PRIVATE_KEY=<matching private key>
       CONTABO_PROD_DEPLOY_PATH=$DEPLOY_PATH
       CONTABO_PROD_REPO_PATH=/opt/wlotus
       CONTABO_PROD_SMOKE_URL=https://wlotus.org/
  6. Variables (Environment production): VITE_PRAYER_TOKEN_ID, VITE_PRAYER_TICKER=WLOTUS
  7. Release: git tag -a vX.Y.Z && git push origin vX.Y.Z

EOF
