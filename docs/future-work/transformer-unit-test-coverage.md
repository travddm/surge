# Future work: transformer unit test coverage

Part of the [surge](../architecture.md) design.

## What

The transformer's Jest suites ([testing.md](../testing.md)) leave one case
open: the cache in `nearestPackageName` in `detect.ts`, which keeps the
package name found for each directory, is untested.

## Why deferred

A test needs `fs` mocking to count the `package.json` reads, and the function
is not exported.

## How, briefly

- Test it through an exported caller, such as `resolveFactoryName`, with `fs`
  mocked, and assert that a second lookup under the same directory reads no
  `package.json`; or export it for the test.
