#!/usr/bin/env bash
# Install nginx rate-limit zone + hardening snippet and include them in the
# live site(s). GitHub Actions runs this via NOPASSWD sudo after updating
# /opt/wlotus.
#
#   sudo bash /opt/wlotus/deploy/contabo/apply-nginx-hardening.sh
#
# Does not replace Certbot SSL server files. It only:
#   1. Writes /etc/nginx/conf.d/wlotus-rate-limit.conf
#   2. Writes /etc/nginx/snippets/wlotus-hardening.conf
#   3. Inserts `include …/wlotus-hardening.conf;` before `location /api/`
#      when that location exists and challenge is not already inlined
#   4. nginx -t && systemctl reload nginx (restores site backups on -t fail)
#
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZONE_SRC="$SRC/nginx-rate-limit-zone.conf"
SNIP_SRC="$SRC/nginx-hardening-snippet.conf"
INJECT="$SRC/inject-nginx-hardening-include.py"
ZONE_DST=/etc/nginx/conf.d/wlotus-rate-limit.conf
SNIP_DST=/etc/nginx/snippets/wlotus-hardening.conf

if [[ ! -f "$ZONE_SRC" || ! -f "$SNIP_SRC" || ! -f "$INJECT" ]]; then
  echo "missing hardening files next to $SRC" >&2
  exit 1
fi

mkdir -p "$(dirname "$ZONE_DST")" /etc/nginx/snippets
cp "$ZONE_SRC" "$ZONE_DST"
cp "$SNIP_SRC" "$SNIP_DST"
echo "wrote $ZONE_DST"
echo "wrote $SNIP_DST"

SITE_FILES=()
for f in /etc/nginx/sites-enabled/*; do
  [[ -e "$f" ]] || continue
  if grep -q 'location /api/' "$f" 2>/dev/null; then
    SITE_FILES+=("$(readlink -f "$f" 2>/dev/null || realpath "$f")")
  fi
done

BAK_DIR=""
if [[ ${#SITE_FILES[@]} -gt 0 ]]; then
  BAK_DIR="$(mktemp -d /tmp/wlotus-nginx-bak.XXXXXX)"
  for f in "${SITE_FILES[@]}"; do
    cp -a "$f" "$BAK_DIR/$(echo "$f" | tr / _)"
  done
  python3 "$INJECT" "${SITE_FILES[@]}"
else
  echo "no sites-enabled file contains location /api/ — zone+snippet installed only"
fi

if ! nginx -t; then
  echo "nginx -t failed — restoring site backups" >&2
  if [[ -n "$BAK_DIR" ]]; then
    for f in "${SITE_FILES[@]}"; do
      bak="$BAK_DIR/$(echo "$f" | tr / _)"
      [[ -f "$bak" ]] && cp -a "$bak" "$f"
    done
  fi
  exit 1
fi

systemctl reload nginx
echo "nginx hardening applied"
rm -rf "$BAK_DIR"
