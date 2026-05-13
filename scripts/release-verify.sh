#!/usr/bin/env bash
# Verify every tarball in dist-tarballs/ is publish-safe:
# 1. No workspace: protocol left in package.json dependencies
# 2. Clean-room npm install of all tarballs succeeds
# 3. Smoke test imports @svedata/data and runs a real call
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARBALL_DIR="$REPO_ROOT/dist-tarballs"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [ ! -d "$TARBALL_DIR" ] || [ -z "$(ls -A "$TARBALL_DIR"/*.tgz 2>/dev/null)" ]; then
  echo "ERROR: no tarballs in $TARBALL_DIR. Run scripts/release-pack.sh first." >&2
  exit 1
fi

echo "=== Step 1: grep workspace: in every tarball's package.json ==="
fail=0
for tgz in "$TARBALL_DIR"/*.tgz; do
  name="$(basename "$tgz")"
  rm -rf "$WORK/extract" && mkdir -p "$WORK/extract"
  tar -xzf "$tgz" -C "$WORK/extract"
  if grep -q '"workspace:' "$WORK/extract/package/package.json"; then
    echo "  FAIL $name still contains workspace: protocol"
    grep '"workspace:' "$WORK/extract/package/package.json"
    fail=1
  else
    echo "  ok   $name"
  fi
done
[ "$fail" -eq 0 ] || { echo "Aborting: workspace: protocol must be rewritten before publish."; exit 1; }

echo
echo "=== Step 2: clean-room npm install of all tarballs ==="
INSTALL_DIR="$WORK/install"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"
npm init -y > /dev/null
npm install \
  "$TARBALL_DIR"/svedata-types-*.tgz \
  "$TARBALL_DIR"/svedata-data-*.tgz \
  "$TARBALL_DIR"/svedata-mcp-*.tgz \
  "$TARBALL_DIR"/svedata-cli-*.tgz 2>&1 | tail -3

echo
echo "=== Step 3: import smoke (svedata.smhi.current) ==="
cat > smoke.mjs <<'EOF'
import { svedata } from '@svedata/data';
const r = await svedata.smhi.current('Malmö');
if (!r.data) { console.error('FAIL: smhi returned null'); process.exit(1); }
console.log(`OK ${r.data.air_temperature}°C in ${r.data.location}`);
EOF
node smoke.mjs

echo
echo "All checks passed. Tarballs in $TARBALL_DIR are publish-safe."
