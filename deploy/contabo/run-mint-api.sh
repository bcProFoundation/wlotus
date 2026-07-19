#!/usr/bin/env bash
# Contabo / systemd entrypoint for mint-api.
# Loads /etc/wlotus/mint.env via Node dotenv (handles mnemonic spaces).
# Do not put unquoted multi-word MINT_MNEMONIC in systemd EnvironmentFile.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="$(pwd)/node_modules/.bin:/usr/local/bin:/usr/bin:${PATH:-}"
exec tsx apps/mint-api/src/server.ts
