#!/usr/bin/env python3
"""Insert the W Lotus hardening include into nginx server files.

Idempotent: skips files that already include the snippet or already define
`location = /api/challenge` (inlined). Inserts the include immediately before
each `location /api/` so exact-match challenge/notify locations apply.

Usage:
  python3 inject-nginx-hardening-include.py FILE [FILE...]
  Prints patched paths to stdout. Exit 0 even if nothing changed.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

INCLUDE = "include /etc/nginx/snippets/wlotus-hardening.conf;"
API_LOC = re.compile(r"^(\s*)location\s+/api/")
CHALLENGE_LOC = re.compile(r"location\s+=\s+/api/challenge")


def patch_text(text: str) -> str | None:
    if INCLUDE in text:
        return None
    if CHALLENGE_LOC.search(text):
        return None
    if not re.search(r"location\s+/api/", text):
        return None
    lines = text.splitlines(True)
    out: list[str] = []
    changed = False
    for line in lines:
        m = API_LOC.match(line)
        if m:
            out.append(f"{m.group(1)}{INCLUDE}\n")
            changed = True
        out.append(line)
    return "".join(out) if changed else None


def patch_file(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    patched = patch_text(original)
    if patched is None:
        return False
    path.write_text(patched, encoding="utf-8")
    return True


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: inject-nginx-hardening-include.py FILE ...", file=sys.stderr)
        return 2
    for raw in argv[1:]:
        path = Path(raw)
        if not path.is_file():
            print(f"skip missing {path}", file=sys.stderr)
            continue
        if patch_file(path):
            print(f"patched {path}")
        else:
            print(f"unchanged {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
