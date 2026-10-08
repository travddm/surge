# Future work: releases

Part of the [surge](../architecture.md) design.

## What

Neither package has a release. Both are `0.1.0` and `"private": true`, and
nothing cuts, reviews or publishes one:

- **No release pipeline.** Nothing tags a release, publishes to npm, or
  creates a GitHub Release, and neither branch is protected. Users install
  from the npm registry: `@rbxts/surge` under the `@rbxts` organization, and
  `rbxts-transformer-surge` unscoped and outside it. Both names are claimed:
  each holds only npm's `0.0.0-stage` placeholder, which `latest` points at
  until the first release.
- **No version backstop.** Nothing checks, at compile time or at run time,
  that the two packages a consumer installs are the same release (Runtime
  API 6.2 in [specs/runtime-api.md](../specs/runtime-api.md)); keeping them
  matched is release-process discipline. The transformer already reads
  `@rbxts/surge`'s `package.json` (`nearestPackageName` in `detect.ts`) to
  identify the package; reading its `version` too and reporting a diagnostic
  when it differs from the transformer's own version is a small, cheap
  backstop.
- **No `typescript` peer dependency.** The transformer imports `typescript`
  at run time but lists it only under `devDependencies`, and it resolves in
  a consumer's project only because roblox-ts depends on `typescript` too.
  Before its first registry publish, the transformer declares `typescript`
  under `peerDependencies`, as `rbxts-transformer-flamework` does, so that
  it uses the compiler's copy rather than one of its own.
- **No release documentation.** There is no `CHANGELOG`, no statement of
  which Roblox, roblox-ts and `@rbxts/types` versions the generated code
  targets, and no install in [getting-started.md](../getting-started.md).
- **No promise about the bytes across releases.**
  [errors-and-guarantees.md](../errors-and-guarantees.md) tells a user to
  keep both sides on the same surge version, but nothing says what a
  release may change. A game that saves surge bytes, such as in a
  `DataStore`, needs to know which releases can change what those bytes
  mean.
- **No contributor files on GitHub.** `.github/` holds only the workflow.
  There is no `CONTRIBUTING.md`, which GitHub links when someone opens an
  issue or a pull request, and no issue or pull request template.
- **Benchmark tables recorded on older code.** Each table names the commits
  it ran on, and later commits have changed the code since. A release's site
  would publish numbers for code the release does not ship.

## Why deferred

Only a release exercises the release pipeline, so the pipeline is built with
the first one. Protecting `master` changes how every change lands, through a
pull request, so it waits for the release too. The first release follows
[one-package-tags.md](one-package-tags.md), whose tag script it uses,
[documentation-site.md](documentation-site.md), which publishes it, and the
benchmark fixes in [benchmark-tooling.md](benchmark-tooling.md).

The version backstop is the only item that changes the transformer's code,
and it lands with the first release it would protect. The test in
[transformer-unit-test-coverage.md](transformer-unit-test-coverage.md) lands
with it: the backstop reads the version through `nearestPackageName`, whose
cache that test covers. The promise about the bytes and the contributor
files are part of the release's documentation.

## How, briefly

### Versions

- Both packages carry one version and are bumped together while surge is
  `0.x`. They meet at the helper ABI that generated code imports from
  `@rbxts/surge/out/abi` (Runtime API 5 and 6 in
  [specs/runtime-api.md](../specs/runtime-api.md)), and most changes so far
  touch both. A fix in one package republishes the other, unchanged, under
  the new version; that is the whole cost.
- Independent versions would need a statement of which runtime versions
  each transformer version works with, and the version backstop would check
  that range instead of equality. The tags and the publishing below work for
  either.

### Branches and the release run

- `release` is a protected branch. Each push to it runs the checks, then
  stages the npm publish; after the maintainer approves it, the same run
  tags the release, creates the GitHub Release, deploys the documentation
  site ([documentation-site.md](documentation-site.md)), and prunes dev
  tags. Pre-release tags on `master` and dev tags are in
  [one-package-tags.md](one-package-tags.md).
- Versions live in commits, and CI never commits. A release's pull request
  into `master` bumps both packages' versions and adds the changelog entry,
  and a second pull request merges `master` into `release`.
- Both branches are protected: each takes pull requests with passing checks
  only. Each push to `master` makes pre-release tags that can never be
  deleted, so nothing reaches `master` without review. `release` takes merge
  commits, never squashes or rebases, so that a pre-release's count of
  commits since the latest release stays right.
- The release run checks that the version has no tag yet, and stages the
  npm publish. Once the maintainer approves it (Publishing, below), the run
  tags, creates the GitHub Release, deploys the documentation site, and
  prunes dev tags. Each is a job of the same workflow, because a tag that CI
  pushes with `GITHUB_TOKEN` starts no workflow run of its own.
- For a release of 0.2.0, the tags are `surge-v0.2.0` and
  `transformer-v0.2.0` on one-package commits made by the tag script in
  [one-package-tags.md](one-package-tags.md), and `v0.2.0` on the commit
  itself.
- A tag ruleset restricts updates and deletions of release and pre-release
  tags, so that nobody moves or deletes one: a consumer's lockfile records a
  tag's commit, not the tag. CI only creates tags, so it needs no bypass.
  The tags CI creates are not signed; the ruleset is what keeps them in
  place. Dev tags are outside the ruleset so that a release can prune them.
- A major or minor release deletes the dev tags whose version is below the
  major or minor release before it. Releasing 0.5.0 after 0.4.0 deletes
  every dev tag below 0.4.0, so a dev tag outlives one more major or minor
  release. A patch release deletes none.
  [contributing.md](../contributing.md) states the rule, because deleting a
  tag breaks a lockfile that records its commit.

### Publishing

- `@rbxts/surge` publishes from `surge/` with `--access public`, and
  `rbxts-transformer-surge` publishes from `rbxts-transformer-surge/`. Each
  package drops `"private": true`. `prepare` builds the compiled output
  before a publish, as it does for a git install.
- Every publish is staged. The release run uses npm's staged publishing
  (`npm stage publish`), so neither version can be installed until the
  maintainer approves it, on the npm website or with the CLI, with two-factor
  authentication. `npm stage download` fetches a staged tarball for review.
  A published version number can never be used again, even after an
  unpublish, so this review is the last check.
- Staged publishing needs npm 11.15.0 or later, newer than the pinned Node's
  npm, so the release job installs it. It worked on 2026-10-08 with npm
  11.21.0, when the maintainer's npm account claimed both names by staging
  a `0.0.0-claim` version of each and rejecting it:
    - Staging a package that did not exist published a placeholder,
      `0.0.0-stage`, which `latest` points at until the first release.
      Rejecting the staged version left the placeholder.
    - A staged version stayed in validation for one to two minutes before it
      could be approved or rejected. The release run waits for that.
    - Staging asked for no second factor. Rejecting from the CLI asked for a
      sign-in in the browser; the npm website rejects too.
- The run stages with a token the maintainer provides: a granular access
  token, limited to the two packages, with Bypass 2FA off. It is a secret of
  a GitHub environment that only the staging job uses. With two-factor
  authentication required for publishing, such a token can stage a publish
  but not complete one; confirm that with the first staged publish.
- A write token lasts at most 90 days, and npm removes direct publishing
  with a granular token in January 2027. The run moves to trusted
  publishing (`id-token: write`, with no stored secret) once it can be
  limited to staging; whether it can is not confirmed.
- After staging, the run waits on a second GitHub environment that requires
  the maintainer's approval. The maintainer approves both staged versions on
  npm, then approves the run, which checks that both versions are live
  before it tags anything. Rejecting ends the release with nothing tagged.
  Check whether a rejected version number can be staged again; if not, the
  fix takes the next version.
- To try a release before approving it, install the pre-release tags of the
  `master` commit being released: their trees match the release's, except
  for the version.
- Only a release publishes to npm. A pre-release or a dev build reaches
  another project through its one-package tag.

### The rest of the first release

- Emit a diagnostic from the transformer when the resolved `@rbxts/surge`
  version does not equal the transformer's own. Document the release
  procedure above, with a `CHANGELOG.md` entry, and state the targeted
  roblox-ts and `@rbxts/types` versions and the registry install in
  [getting-started.md](../getting-started.md).
- State in a user page what each kind of release may change, and keep to
  it. A patch release changes neither the bytes any type is written as nor
  the runtime helpers that generated code calls (Runtime API 5 in
  [specs/runtime-api.md](../specs/runtime-api.md)). While surge is `0.x`, a
  minor release may change either; from `1.0`, only a major release may.
  The page also says that an enum's bytes depend on the game's
  `@rbxts/types` ([errors-and-guarantees.md](../errors-and-guarantees.md)),
  which no surge release controls. The changelog marks each release that
  changes bytes; a byte change already shows in the diff, because it
  changes `tests/src/tests/bytes.spec.ts` and the size table in the same
  commit.
- Add a root `CONTRIBUTING.md` that links the contributor part of the
  documentation site ([documentation-site.md](documentation-site.md)) and
  `AGENTS.md`; a bug-report issue template that asks for the surge version,
  the type, and the generated code; and a pull request template that lists
  the verification steps in `AGENTS.md`.
- Before the release, record all three benchmark tiers again on the
  release's code (`mise run bench:size`, `mise run bench:code` and
  `mise run bench:speed`), after the fixes in
  [benchmark-tooling.md](benchmark-tooling.md), so that the tables the site
  publishes measure what the release ships. The speed tier needs Roblox
  Studio, so the maintainer runs it.
