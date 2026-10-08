# Future work: transformer unit test coverage

Part of the [surge](../architecture.md) design.

## What

- **The package-name cache.** The transformer's Jest suites
  ([testing.md](../testing.md)) leave the cache in `nearestPackageName` in
  `detect.ts`, which keeps the package name found for each directory,
  untested.
- **A stand-in for surge's declarations.** The suites compile against
  `test/fixtures/rbxts-surge/`, a hand-maintained copy of `@rbxts/surge`'s
  public declarations that changes in the same commit as a change to what
  surge exports. With both packages in one repository, the suites could
  read surge's own declarations instead, and the copy could not drift from
  them.

## Why deferred

A test of the cache needs `fs` mocking to count the `package.json` reads,
and the function is not exported. It lands with the version backstop in
[ci-and-release.md](ci-and-release.md), which changes the same function to
read the package's version too.

The stand-in waits on nothing. A drift between it and surge's declarations
fails surge's round-trip suite, which compiles through the transformer
against the real package, so the copy is extra upkeep rather than a hidden
risk.

## How, briefly

- Test the cache through an exported caller, such as `resolveFactoryName`,
  with `fs` mocked, and assert that a second lookup under the same directory
  reads no `package.json`; or export it for the test.
- Point the harness's `surge` option at `../surge/src/` under the
  `@rbxts/surge` package name, and delete the stand-in. The transformer still
  depends on nothing in surge at run time; only its tests read surge's
  source.
