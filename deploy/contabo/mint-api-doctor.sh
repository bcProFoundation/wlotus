#!/usr/bin/env bash
# Why is https://wlotus.org/api/status a 502 / curl :8787 connection refused?
# Run on the prod VM:  sudo bash deploy/contabo/mint-api-doctor.sh
set -u
echo "=== unit ==="
systemctl is-enabled wlotus-mint-api 2>/dev/null || true
systemctl is-active wlotus-mint-api 2>/dev/null || true
systemctl status wlotus-mint-api --no-pager -l || true
echo
echo "=== :8787 ==="
ss -lntp 2>/dev/null | grep 8787 || netstat -lntp 2>/dev/null | grep 8787 || echo "nothing listening on 8787"
echo
echo "=== tsx / checkout ==="
ls -l /opt/wlotus/node_modules/.bin/tsx 2>/dev/null || echo "MISSING /opt/wlotus/node_modules/.bin/tsx — npm ci as deploy"
echo "cwd checkout: $(sudo -u deploy -H git -C /opt/wlotus log -1 --oneline 2>/dev/null || git -C /opt/wlotus log -1 --oneline 2>/dev/null || echo unknown)"
echo
echo "=== mint.env (User=deploy must read this) ==="
ls -l /etc/wlotus/mint.env 2>/dev/null || echo "MISSING /etc/wlotus/mint.env"
sudo -u deploy test -r /etc/wlotus/mint.env \
  && echo "deploy can read mint.env" \
  || echo "deploy CANNOT read mint.env — sudo chown root:deploy /etc/wlotus/mint.env && sudo chmod 640 /etc/wlotus/mint.env"
echo
echo "=== journal (last 40) ==="
journalctl -u wlotus-mint-api -n 40 --no-pager || true
echo
echo "=== start (if inactive) ==="
echo "sudo systemctl start wlotus-mint-api"
echo "sleep 2"
echo "curl -sS --fail-with-body http://127.0.0.1:8787/health"
