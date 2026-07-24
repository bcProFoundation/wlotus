#!/usr/bin/env bash
# Contabo / systemd entrypoint for dana-index.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="$(pwd)/node_modules/.bin:/usr/local/bin:/usr/bin:${PATH:-}"
exec tsx apps/dana-index/src/server.ts
