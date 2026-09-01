#!/usr/bin/env bash
# Contabo / systemd entrypoint for mint-api (User=deploy).
# Loads /etc/wlotus/mint.env via Node dotenv (handles mnemonic spaces).
# loadMintEnv.boot.ts must run before offer.ts so MINT_SERVING_TIP_INDEX is set.
# Do not put unquoted multi-word MINT_MNEMONIC in systemd EnvironmentFile.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
export PATH="$ROOT/node_modules/.bin:/usr/local/bin:/usr/bin:${PATH:-}"

TSX="$ROOT/node_modules/.bin/tsx"
if [[ ! -x "$TSX" ]]; then
  echo "mint-api: missing $TSX" >&2
  echo "Fix: sudo -u deploy -H bash -lc 'cd /opt/wlotus && npm ci'" >&2
  exit 1
fi
if [[ ! -f "$ROOT/apps/mint-api/src/server.ts" ]]; then
  echo "mint-api: missing $ROOT/apps/mint-api/src/server.ts (wrong checkout?)" >&2
  exit 1
fi
ENV_FILE=/etc/wlotus/mint.env
if [[ -e "$ENV_FILE" && ! -r "$ENV_FILE" ]]; then
  echo "mint-api: cannot read $ENV_FILE as $(id -un)" >&2
  ls -l "$ENV_FILE" >&2 || true
  echo "Fix: sudo chown root:deploy $ENV_FILE && sudo chmod 640 $ENV_FILE" >&2
fi

echo "mint-api: start root=$ROOT user=$(id -un) tsx=$TSX" >&2
exec "$TSX" apps/mint-api/src/server.ts
