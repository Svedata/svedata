# Release runbook

Svedata releases are published to npm by the
[`Release` workflow](../.github/workflows/release.yml) when a `vX.Y.Z`
tag is pushed. The manual steps further down remain as a fallback.

## Automated release (default)

### One-time setup: npm token

The workflow authenticates with an npm token stored as the repository
secret `NPM_TOKEN`. The repository owner creates and stores it. Nobody
else, and no bot, handles the token.

1. Sign in to [npmjs.com](https://www.npmjs.com) as `joeyhuginhelm`.
2. Open **Access Tokens** > **Generate New Token** > **Granular Access Token**.
3. Set **Packages and scopes** to **Read and write**, limited to the
   `@svedata` scope. Pick an expiry and note it.
4. Copy the token.
5. In GitHub, open the repository's **Settings** > **Secrets and
   variables** > **Actions** > **New repository secret**.
6. Name it `NPM_TOKEN`, paste the token, and save.

Repeat steps 1–6 when the token expires. The workflow fails at its first
step with `NPM_TOKEN missing` if the secret is empty or not set.

### Each release

1. Bump all four `package.json` versions, refresh `bun.lock`, and add a
   CHANGELOG entry, as in steps 1 and 2 of the manual flow below.
   Merge that to `main`.
2. Tag the merged commit and push the tag:

   ```bash
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

3. Watch the **Release** run in the Actions tab. It:
   1. fails if `NPM_TOKEN` is empty;
   2. fails unless the tag version equals the `version` in
      `packages/{types,sdk,mcp,cli}/package.json`;
   3. runs `bun install --frozen-lockfile`, `bun run release:pack` and
      `bun run release:verify`;
   4. publishes `dist-tarballs/` in the order `types` → `data` → `mcp` →
      `cli` with `npm publish <tarball> --access public --provenance`.
4. Run step 5 of the manual flow (clean-directory smoke test).

A package whose exact version is already on npm is skipped, so a failed
run can be re-run from the Actions tab without double-publishing. To
start a run by hand, use **Run workflow** and pick the `vX.Y.Z` tag
under **Use workflow from**. A run from a branch fails on purpose.

`--provenance` links each published version to the workflow run that
built it. npm checks that each `package.json` `repository.url` points at
`github.com/Svedata/svedata`.

The first automated release is `v0.2.0`. Its versions are already on
`main`, so after `NPM_TOKEN` is set, start at step 2.

## Manual release (fallback)

Use this when the workflow is unavailable. Run from your own terminal
with your own npm login.

**Background:** `npm publish` invokes `npm pack` internally, and
`npm pack` does **not** rewrite the `workspace:` protocol. Publishing
from each package directory with `npm publish` produces broken
tarballs (`"@svedata/types": "workspace:*"` on the registry). Use
`bun pm pack` to produce the tarballs, then `npm publish <tarball>`
— bun's pack rewrites `workspace:^` → `^X.Y.Z` and `workspace:*`
→ `X.Y.Z`.

### 0. Prerequisites

```bash
npm whoami                   # must show your account
node --version               # 20+
bun --version                # 1.3+
```

### 1. Bump versions

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

### 2. Pack + validate locally

```bash
bun run release:pack         # builds + bun pm pack → dist-tarballs/
bun run release:verify       # grep + clean-room install + smoke
```

`release:verify` will fail if any tarball still contains `"workspace:`
in its `package.json`, or if a clean-room `npm install` of all four
tarballs fails, or if `svedata.smhi.current('Malmö')` does not return
real data.

**Stop if either script fails.** Investigate before publishing.

### 3. Deprecate the previous broken version (if applicable)

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

### 4. Publish from tarballs (NOT from package directories)

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

### 5. Verify publish from a clean directory

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

### 6. Push tag + commit

After publish succeeds (and not before):

```bash
git push origin main
git push origin vX.Y.Z
```

If publish fails, the prepared commit and local tag can stay
unpushed until the release is fixed and re-published.

Pushing the tag also starts the Release workflow. It skips every
version you already published by hand, so the run ends green without
publishing anything.
