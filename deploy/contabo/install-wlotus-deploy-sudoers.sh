#!/usr/bin/env bash
# Write /etc/sudoers.d/wlotus-deploy for the GitHub Actions deploy user.
#
# Run as root on the test or prod VM:
#   sudo bash deploy/contabo/install-wlotus-deploy-sudoers.sh
#   DEPLOY_USER=deploy sudo bash deploy/contabo/install-wlotus-deploy-sudoers.sh
#
# Ubuntu usrmerge makes /bin/systemctl a symlink to /usr/bin/systemctl.
# sudo then matches the canonical path, so a rule that lists only
# /bin/systemctl fails with: sudo: a password is required
#
# This file lists both /usr/bin and /bin for systemctl, chown, mkdir, chmod, rm.
#
set -euo pipefail

install_wlotus_deploy_sudoers() {
  local user="${1:-${DEPLOY_USER:-deploy}}"
  local dest="${2:-/etc/sudoers.d/wlotus-deploy}"
  local cmds=()
  local sys unit bin

  if [[ "$dest" == /etc/* && "$(id -u)" -ne 0 ]]; then
    echo "Run as root (sudo)." >&2
    return 1
  fi

  for sys in /usr/bin/systemctl /bin/systemctl; do
    for unit in wlotus-mint-api.service wlotus-dana-index.service; do
      cmds+=("${sys} try-restart ${unit}")
      cmds+=("${sys} restart ${unit}")
    done
  done
  for bin in /usr/bin/mkdir /bin/mkdir; do
    cmds+=("${bin} -p /etc/wlotus")
  done
  for bin in /usr/bin/tee /bin/tee; do
    cmds+=("${bin} /etc/wlotus/mint.env")
    cmds+=("${bin} /etc/wlotus/dana-index.env")
  done
  for bin in /usr/bin/chmod /bin/chmod; do
    cmds+=("${bin} 600 /etc/wlotus/mint.env")
    cmds+=("${bin} 600 /etc/wlotus/dana-index.env")
  done
  for bin in /usr/bin/chown /bin/chown; do
    # sudoers treats ':' as a field separator — escape it (deploy\:deploy).
    cmds+=("${bin} -R ${user}\\:${user} /opt/wlotus")
  done
  for bin in /usr/bin/rm /bin/rm; do
    cmds+=("${bin} -rf /opt/wlotus/node_modules")
  done
  # nginx hardening (apply-nginx-hardening.sh). Full path — sudo matches argv0.
  for bin in /usr/bin/bash /bin/bash; do
    cmds+=("${bin} /opt/wlotus/deploy/contabo/apply-nginx-hardening.sh")
  done

  local tmp
  tmp="$(mktemp)"
  {
    printf '%s\n' "# Managed by deploy/contabo/install-wlotus-deploy-sudoers.sh"
    printf '%s\n' "# Exact-command NOPASSWD for CI (do not use ALL)."
    printf '%s\n' "${user} ALL=(root) NOPASSWD: \\"
    local i
    for i in "${!cmds[@]}"; do
      if [[ "$i" -lt $((${#cmds[@]} - 1)) ]]; then
        printf '  %s, \\\n' "${cmds[$i]}"
      else
        printf '  %s\n' "${cmds[$i]}"
      fi
    done
  } >"$tmp"
  chmod 440 "$tmp"
  if ! visudo -c -f "$tmp"; then
    echo "generated sudoers failed visudo -c" >&2
    rm -f "$tmp"
    return 1
  fi
  mv "$tmp" "$dest"
  chmod 440 "$dest"
  visudo -c -f "$dest"
  echo "Wrote $dest for user ${user}"
}

# Execute when run as a script (including `curl | sudo bash`, where BASH_SOURCE is empty).
# When sourced from bootstrap-*.sh, only the function is defined.
if [[ -z "${BASH_SOURCE[0]:-}" || "${BASH_SOURCE[0]}" == "${0}" ]]; then
  install_wlotus_deploy_sudoers "${DEPLOY_USER:-deploy}" "${DEST:-/etc/sudoers.d/wlotus-deploy}"
fi
