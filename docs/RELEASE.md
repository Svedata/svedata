# Release runbook

Manual steps to publish a Svedata release to npm. Run from your own
terminal — only you have npm credentials.

**Background:** `npm publish` invokes `npm pack` internally, and
`npm pack` does **not** rewrite the `workspace:` protocol. Publishing
from each package directory with `npm publish` produces broken
tarballs (`"@svedata/types": "workspace:*"` on the registry). Use
`bun pm pack` to produce the tarballs, then `npm publish <tarball>`
— bun's pack rewrites `workspace:^` → `^X.Y.Z` and `workspace:*`
→ `X.Y.Z`.

## 0. Prerequisites

```bash
npm whoami                   # must show your account
node --version               # 20+
bun --version                # 1.3+
```

## 1. Bump versions

Edit `version` in:

- `packages/types/package.json`
- `packages/sdk/package.json`
- `packages/mcp/package.json`
- `packages/cli/package.json`

Bump them to the same version (`X.Y.Z`). Then refresh the lockfile
so `bun pm pack` sees the new versions (otherwise it rewrites
`workspace:^` to the previous concrete version):

```bash
rm bun.lock && bun install
```

Add a CHANGELOG entry at the top of `CHANGELOG.md`.

## 2. Pack + validate locally

```bash
bun run release:pack         # builds + bun pm pack → dist-tarballs/
bun run release:verify       # grep + clean-room install + smoke
```

`release:verify` will fail if any tarball still contains `"workspace:`
in its `package.json`, or if a clean-room `npm install` of all four
tarballs fails, or if `svedata.smhi.current('Malmö')` does not return
real data.

**Stop if either script fails.** Investigate before publishing.

## 3. Deprecate the previous broken version (if applicable)

If you are publishing a fix release that supersedes a broken one,
deprecate the broken version on the registry first:

```bash
npm deprecate '@svedata/types@<broken-version>' '<reason and what to use instead>'
npm deprecate '@svedata/data@<broken-version>'  '<reason and what to use instead>'
npm deprecate '@svedata/mcp@<broken-version>'   '<reason and what to use instead>'
npm deprecate '@svedata/cli@<broken-version>'   '<reason and what to use instead>'
```

Example for the v0.1.0 → v0.1.1 fix:

```bash
npm deprecate '@svedata/types@0.1.0' 'v0.1.0 has a broken workspace dependency; use v0.1.1 or later'
npm deprecate '@svedata/data@0.1.0'  'v0.1.0 has a broken workspace dependency; use v0.1.1 or later'
npm deprecate '@svedata/mcp@0.1.0'   'v0.1.0 has a broken workspace dependency; use v0.1.1 or later'
npm deprecate '@svedata/cli@0.1.0'   'v0.1.0 has a broken workspace dependency; use v0.1.1 or later'
```

## 4. Publish from tarballs (NOT from package directories)

Order matters: `types` → `data` → `mcp` → `cli` (downstream packages
depend on the previous one being live):

```bash
npm publish dist-tarballs/svedata-types-X.Y.Z.tgz --access public
npm publish dist-tarballs/svedata-data-X.Y.Z.tgz  --access public
npm publish dist-tarballs/svedata-mcp-X.Y.Z.tgz   --access public
npm publish dist-tarballs/svedata-cli-X.Y.Z.tgz   --access public
```

Do **not** `cd packages/<pkg> && npm publish` — that path uses
`npm pack` internally and re-introduces the workspace bug.

## 5. Verify publish from a clean directory

```bash
cd $(mktemp -d)
npm init -y > /dev/null
npm install @svedata/data@X.Y.Z

cat > smoke.mjs <<'EOF'
import { svedata } from '@svedata/data';
const r = await svedata.smhi.current('Malmö');
console.log(r.data ? `OK ${r.data.air_temperature}°C ${r.data.location}` : 'FAIL');
EOF

node smoke.mjs
```

The output must be `OK <number>°C Malmö`. If it errors with
`Unsupported URL Type 'workspace:'` something went wrong — stop
and investigate before announcing the release.

## 6. Push tag + commit

After publish succeeds (and not before):

```bash
git push origin main
git push origin vX.Y.Z
```

If publish fails, the prepared commit and local tag can stay
unpushed until the release is fixed and re-published.
