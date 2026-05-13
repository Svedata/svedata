#!/usr/bin/env bash
# Build all publishable packages and pack them with `bun pm pack` into
# dist-tarballs/ at the repo root. `bun pm pack` rewrites workspace:*
# dependencies to concrete versions; `npm pack` does not. Always pack
# with this script and publish from the resulting tarballs.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$REPO_ROOT/dist-tarballs"

cd "$REPO_ROOT"
rm -rf "$OUT"
mkdir -p "$OUT"

bun install --frozen-lockfile
bun run build

for pkg in types sdk mcp cli; do
  (cd "packages/$pkg" && bun pm pack --destination "$OUT")
done

echo
echo "Packed tarballs:"
ls -la "$OUT"
