# Future work: cross-repository CI and release discipline

Part of the [surge](../architecture.md) design.

## What

- **No version backstop.** Nothing checks, at compile time or at run time,
  that the two packages a consumer installs are the same release (Runtime API 6.2 in
  [specs/runtime-api.md](../specs/runtime-api.md)); keeping them matched is
  release-process discipline. The transformer already reads
  `@rbxts/surge`'s `package.json` (`nearestPackageName` in `detect.ts`)
  to identify the package; reading its `version` too and reporting a
  diagnostic when it differs from the transformer's own version is a
  small, cheap backstop. Neither repository has a tag yet, both are
  `0.1.0`, and there is no documented tagging step. The transformer's
  `package.json` is also `"private": true`.
- **No `typescript` peer dependency.** The transformer imports `typescript`
  at run time but lists it only under `devDependencies`, and it resolves in
  a consumer's project only because roblox-ts depends on `typescript` too.
  Before its first registry publish, the transformer declares `typescript`
  under `peerDependencies`, as `rbxts-transformer-flamework` does, so that
  it uses the compiler's copy rather than one of its own.
- **No release documentation.** There is no `CHANGELOG`, no tagging
  procedure, and no statement of which Roblox, roblox-ts and `@rbxts/types`
  versions the generated code targets. [getting-started.md](../getting-started.md)
  asks a consumer to pin both repositories to the same release, and neither
  has one yet.
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

The version backstop is the only item that changes the transformer's code,
and it lands with the first tagged release it would protect. The test in
[transformer-unit-test-coverage.md](transformer-unit-test-coverage.md) lands
with it: the backstop reads the version through `nearestPackageName`, whose
cache that test covers. The first release follows
[single-repository.md](single-repository.md), which sets where a release is
cut from and how users and developers install it, and
[documentation-site.md](documentation-site.md), which publishes it. The
promise about the bytes and the contributor files are part of that
release's documentation.

## How, briefly

- Emit a diagnostic from the transformer when the resolved `@rbxts/surge`
  version does not equal the transformer's own; document a release
  procedure that bumps both `package.json` versions together and cuts the
  tags and the npm publish that [single-repository.md](single-repository.md)
  describes, with a `CHANGELOG.md` entry, and state the
  targeted roblox-ts and `@rbxts/types` versions in
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
