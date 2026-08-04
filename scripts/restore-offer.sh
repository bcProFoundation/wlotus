#!/usr/bin/env bash
# Temporary restore helper — apply the patched offer from the known-good commit.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
curl -fsSL "https://raw.githubusercontent.com/bcProFoundation/wlotus/dcdb7ed2bcc82bd5c8e0a2e7565e8170b37b74ac/apps/mint-api/src/offer.ts" \
  -o "$ROOT/apps/mint-api/src/offer.ts"
echo "Restored offer.ts from dcdb7ed ($(wc -c < "$ROOT/apps/mint-api/src/offer.ts") bytes)"
