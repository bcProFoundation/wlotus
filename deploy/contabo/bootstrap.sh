#!/usr/bin/env bash
# One-time Contabo VM bootstrap for the WLotus test SPA.
# Run as root on Ubuntu/Debian:
#   curl -fsSL … | bash
# or copy this file to the VM and:
#   sudo bash bootstrap.sh [server_name]
#
# Example:
#   sudo bash bootstrap.sh test.wlotus.org

set -euo pipefail

SERVER_NAME="${1:-_}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/wlotus-test}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx rsync ufw curl

mkdir -p "$DEPLOY_PATH"
chown -R www-data:www-data "$DEPLOY_PATH"
chmod 755 "$DEPLOY_PATH"

# Placeholder until first CI deploy
if [[ ! -f "$DEPLOY_PATH/index.html" ]]; then
  cat >"$DEPLOY_PATH/index.html" <<'HTML'
<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><title>WLotus test</title></head>
  <body><p>WLotus test host ready — waiting for first CI deploy.</p></body>
</html>
HTML
  chown www-data:www-data "$DEPLOY_PATH/index.html"
fi

SITE_SRC="$(cd "$(dirname "$0")" && pwd)/nginx-wlotus-test.conf"
SITE_DST=/etc/nginx/sites-available/wlotus-test

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

# Patch server_name if a real name was passed
if [[ "$SERVER_NAME" != "_" ]]; then
  sed -i "s/server_name .*/server_name ${SERVER_NAME};/" "$SITE_DST"
fi

ln -sfn "$SITE_DST" /etc/nginx/sites-enabled/wlotus-test
# Drop default site if present (avoids catching all traffic)
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl reload nginx

# Firewall: SSH + HTTP + HTTPS
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable || true

# Optional deploy user for CI (key auth only — add your GitHub deploy public key)
if ! id "$DEPLOY_USER" &>/dev/null; then
  adduser --disabled-password --gecos '' "$DEPLOY_USER"
fi
usermod -aG www-data "$DEPLOY_USER"
mkdir -p "/home/$DEPLOY_USER/.ssh"
chmod 700 "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"

# Let deploy write the web root without owning the whole tree as root
chown -R "$DEPLOY_USER:www-data" "$DEPLOY_PATH"
chmod -R g+rwX "$DEPLOY_PATH"

cat <<EOF

Bootstrap done.

  Web root:     $DEPLOY_PATH
  Nginx site:   wlotus-test (server_name=$SERVER_NAME)
  Deploy user:  $DEPLOY_USER

Next:
  1. Append your CI public key to /home/$DEPLOY_USER/.ssh/authorized_keys
  2. In GitHub → Settings → Secrets, set:
       CONTABO_HOST=<this VM IP or DNS>
       CONTABO_USER=$DEPLOY_USER
       CONTABO_SSH_PRIVATE_KEY=<matching private key>
       CONTABO_DEPLOY_PATH=$DEPLOY_PATH
       CONTABO_SMOKE_URL=http://<host>/   (optional)
  3. Point DNS A record (e.g. test.wlotus.org) here, then:
       apt-get install -y certbot python3-certbot-nginx
       certbot --nginx -d $SERVER_NAME
  4. Run workflow "Deploy web (test)" (workflow_dispatch or push to apps/web)

EOF
