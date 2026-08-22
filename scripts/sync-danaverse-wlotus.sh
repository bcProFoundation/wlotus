#!/usr/bin/env bash
# Copy a public snapshot of W Lotus into github.com/danaverse/wlotus.
#
# Bare minimum:
#   - live covenant (102 miner + 6 temple MooreTipTemple)
#   - apps/web source (reference; not a standalone build)
#   - README + LICENSE
#
# Usage:
#   ./scripts/sync-danaverse-wlotus.sh /path/to/danaverse/wlotus
#   DRY_RUN=1 ./scripts/sync-danaverse-wlotus.sh /tmp/wlotus-public
#
# On each prod tag, Deploy web (prod) runs this when secret
# DANAVERSE_WLOTUS_TOKEN can push to danaverse/wlotus.
#
set -euo pipefail

SRC="${SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SRC="$(cd "$SRC" && pwd)"
DEST="${1:-}"
DRY_RUN="${DRY_RUN:-0}"
STATUS_URL="${STATUS_URL:-https://wlotus.org/api/status}"

if [[ -z "$DEST" ]]; then
  echo "usage: $0 DEST_CHECKOUT" >&2
  exit 2
fi

DEST="$(cd "$DEST" && pwd)"
if [[ ! -d "$DEST/.git" ]]; then
  echo "DEST must be a git checkout (missing $DEST/.git)" >&2
  exit 1
fi

FILES=(
  LICENSE
  contracts/WlotusPowRemintMooreTipTemple.spedn
  src/covenant/mooreTip.ts
  src/covenant/powRemintMooreTipTempleOutputs.ts
  src/covenant/powRemintMooreTipTempleScript.ts
  src/explorer.ts
  src/offering/altarFields.ts
  src/offering/memorialFromScript.ts
  src/offering/wlbrMemorial.ts
  src/params/consensus.ts
  src/params/specialCountries.ts
  src/params/wlotusMint.ts
)

for f in "${FILES[@]}"; do
  if [[ ! -f "$SRC/$f" ]]; then
    echo "missing $SRC/$f" >&2
    exit 1
  fi
done
if [[ ! -d "$SRC/apps/web" ]]; then
  echo "missing $SRC/apps/web" >&2
  exit 1
fi

SHA="$(git -C "$SRC" rev-parse HEAD)"
SHORT="$(git -C "$SRC" rev-parse --short HEAD)"
TAG="$(git -C "$SRC" describe --tags --exact-match HEAD 2>/dev/null || true)"
REF="${TAG:-$SHORT}"

TOKEN_ID=""
TICKER="WLOTUS"
if command -v python3 >/dev/null && command -v curl >/dev/null; then
  raw="$(curl -fsS --max-time 12 "$STATUS_URL" 2>/dev/null || true)"
  if [[ -n "$raw" ]]; then
    TOKEN_ID="$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tokenId") or "")' <<<"$raw" 2>/dev/null || true)"
    TICKER="$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("ticker") or "WLOTUS")' <<<"$raw" 2>/dev/null || true)"
  fi
fi
if [[ -z "$TOKEN_ID" ]]; then
  TOKEN_ID="${WLOTUS_TOKEN_ID:-154d229bab3cf228a2d40b507e1fc5f21a09542ec66776d3e797b455ab77a091}"
fi

if [[ "$DRY_RUN" = 1 ]]; then
  echo "DRY_RUN src=$SRC dest=$DEST sha=$SHORT files=${#FILES[@]} web=apps/web token=${TOKEN_ID:0:16}…"
  exit 0
fi

# Replace snapshot contents; keep .git.
find "$DEST" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +

mkdir -p "$DEST/contracts" "$DEST/src/covenant" "$DEST/src/offering" "$DEST/src/params" "$DEST/apps"
for f in "${FILES[@]}"; do
  mkdir -p "$DEST/$(dirname "$f")"
  cp -a "$SRC/$f" "$DEST/$f"
done

cp -a "$SRC/apps/web" "$DEST/apps/web"
rm -rf "$DEST/apps/web/node_modules" "$DEST/apps/web/dist"
rm -f "$DEST/apps/web/.env" "$DEST/apps/web/.env.local"
# Keep the public tree to one README.
rm -f "$DEST/apps/web/README.md"

cat >"$DEST/.gitignore" <<'EOF'
node_modules/
apps/web/dist/
.env
.env.*
!.env.example
!apps/web/.env.example
*.log
.DS_Store
EOF

cat >"$DEST/README.md" <<EOF
# W Lotus

Burnable white lotus on [eCash](https://e.cash) — offered in memory of the dead, and as dana to the living.

| | |
|---|---|
| App | https://wlotus.org |
| Explorer | https://danaverse.org |
| Ticker | **${TICKER}** |
| Token id | \`${TOKEN_ID}\` |
| Covenant | mint **108** = **102** miner + **6** temple |
| Clock | base **0** bits; +1 bit / **500** days; cap **128** |

This repository is a **public snapshot** of the live covenant and the offerings web UI. It is not the full desk (mint-api, deploy, historical experiments stay private).

Snapshot from \`${REF}\` (\`${SHA}\`).

## Layout

\`\`\`
contracts/WlotusPowRemintMooreTipTemple.spedn   # on-chain covenant
src/covenant/                                   # TypeScript loaders for that covenant
src/params/wlotusMint.ts                        # 102 / 6 / 108
apps/web/                                       # offerings PWA source (reference)
\`\`\`

The web tree expects those \`src/\` paths (same as the private monorepo). It talks to the live desk at wlotus.org; it is not a complete local stack.

## License

MIT — see [LICENSE](./LICENSE).
EOF

echo "synced $SHORT → $DEST (token ${TOKEN_ID:0:12}…)"
