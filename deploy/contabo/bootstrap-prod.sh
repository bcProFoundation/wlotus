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

if [[ "$SERVER_NAME" != "_" ]]; then
  if [[ "$SERVER_NAME" == "wlotus.org" ]]; then
    sed -i "s/server_name .*/server_name wlotus.org www.wlotus.org;/" "$SITE_DST"
  else
    sed -i "s/server_name .*/server_name ${SERVER_NAME};/" "$SITE_DST"
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
# Passwordless sudo for mint-api restart + mint.env (CI)
if [[ ! -f /etc/sudoers.d/wlotus-deploy ]]; then
  cat >/etc/sudoers.d/wlotus-deploy <<EOF
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/systemctl try-restart wlotus-mint-api.service, /bin/systemctl restart wlotus-mint-api.service, /bin/mkdir -p /etc/wlotus, /usr/bin/tee /etc/wlotus/mint.env, /bin/chmod 600 /etc/wlotus/mint.env
EOF
  chmod 440 /etc/sudoers.d/wlotus-deploy
fi

mkdir -p "/home/$DEPLOY_USER/.ssh"
chmod 700 "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"

chown -R "$DEPLOY_USER:www-data" "$DEPLOY_PATH"
chmod -R g+rwX "$DEPLOY_PATH"

cat <<EOF

Production bootstrap done.

  Web root:     $DEPLOY_PATH
  Nginx site:   ${SITE_NAME} (server_name=$SERVER_NAME)
  Deploy user:  $DEPLOY_USER

Next:
  1. Append CI public key to /home/$DEPLOY_USER/.ssh/authorized_keys
  2. DNS A/AAAA for wlotus.org (and www) → this VM
  3. TLS: certbot --nginx -d wlotus.org -d www.wlotus.org
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
