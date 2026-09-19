# Future work: cross-repository CI and release discipline

Part of the [surge](../architecture.md) design.

## What

- **The transformer's CI never runs the integration suite.** Its workflow
  runs lint, format, spell, `tsc`, and its Jest unit suite. A transformer
  change that breaks every generated serializer passes the transformer's
  own CI; only a later push to `surge` would notice, and only if someone
  pushes there.
- **`surge`'s CI checks out the transformer at its default branch**, not
  at a pinned commit, so a `surge` build can break or start passing
  because of an unrelated push to the other repository, and a `surge`
  commit's CI result is not reproducible later.
- **No version backstop.** serde.md states that nothing checks, at
  compile time or at runtime, that a consumer's two `github:` refs match,
  and calls it release-process discipline. The transformer already reads
  `@rbxts/surge`'s `package.json` (`nearestPackageName` in `detect.ts`)
  to identify the package; reading its `version` too and reporting a
  diagnostic when it differs from the transformer's own version is a
  small, cheap backstop. Neither repository has a tag yet, both are
  `0.1.0`, and there is no documented tagging step. The transformer's
  `package.json` is also `"private": true`.
- **`npm install`, not `npm ci`.** Both workflows install with
  `npm install` (the transformer's through the mise `postinstall` hook),
  and `surge`'s `mise run ci` runs `npm run tests:install`, which ends in
  `npm install --prefix tests`. That
  can update the lockfile silently; CI does not fail
  on lockfile drift, and the `restore-keys` prefix match restores a stale
  `node_modules` before installing on top of it.
- **No Windows job.** The maintainer develops on Windows and the mise
  tasks assume a POSIX shell (documented as a VS Code task override);
  nothing exercises that path automatically.
- **`tests/package.json` lists `rbxts-transformer-flamework` and
  `rbxts-transformer-surge` under `dependencies`**; both are build-time
  tools and belong in `devDependencies` with the rest of the toolchain
  (harmless today, since the package is private).

## Why deferred

Each item is a workflow change rather than a code change; the version
backstop is the only one that touches the transformer, and it should land
with the first tagged release it would protect. The workflow items have
no such dependency. [README.md](README.md) lists them as work that can
land at any time: the transformer changes scheduled before the release are
what the missing integration job would catch.

## How, briefly

- Add a job to the transformer's workflow that checks out `surge` as a
  sibling and runs its `mise run ci` (the mirror image of what `surge`
  does today), so both repositories gate on the integration suite.
- Pin the sibling checkout to a ref recorded in the repository (a
  `ci/sibling-ref` file or a workflow input), updated deliberately.
- Emit a diagnostic from the transformer when the resolved `@rbxts/surge`
  version does not equal the transformer's own; document a release
  procedure that bumps both `package.json` versions and tags both
  repositories together.
- Switch CI to `npm ci` and key the cache on the exact lockfile hash
  without a prefix fallback.
- Add a `windows-latest` matrix entry running the same steps through Git
  Bash.
