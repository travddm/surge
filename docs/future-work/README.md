# Future work: index and implementation order

Part of the [surge](../architecture.md) design. One document per unit of
work. The order below is the recommended implementation order; each step
names the documents it delivers and why it comes where it does. The last
section lists the documents that can be deferred indefinitely.

This directory holds open work only. What the September 2026 review found,
and what has landed since, is in
[research/september-2026-review.md](../research/september-2026-review.md);
[contributing-docs.md](../contributing-docs.md) states the rule.

## Order

| Step | Document                                                                                                                      | Why here                                                                                                                                                                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | [single-repository.md](single-repository.md): both packages in this repository, and where releases come from                  | The move changes how a release is cut and installed, so it lands before the first release, and it ends the CI pins that every change spanning both packages pays for.                                                                                     |
| 2    | [documentation-site.md](documentation-site.md): one site for users and contributors, with the benchmarks and an API reference | The first release waits for it, and it waits for the move, which sets where `docs/` lives and which workflow deploys it.                                                                                                                                  |
| 3    | [ci-and-release.md](ci-and-release.md): version backstop and first release                                                    | The backstop lands with the release it protects. The cursor codec, the last addition to the consumer API that the plan held, has landed (Runtime API 3.15 in [specs/runtime-api.md](../specs/runtime-api.md)). The other CI items do not wait; see below. |

## No step of its own

These are small, have no dependency on the order above, and can land at any
time:

- The Windows job in [ci-and-release.md](ci-and-release.md): nothing runs
  the mise tasks through Git Bash on Windows, where the maintainer works.
- [transformer-unit-test-coverage.md](transformer-unit-test-coverage.md): a
  test of the package-name cache in `detect.ts`, which needs `fs` mocking.
- A stable fbs and serio column, in
  [benchmark-tooling.md](benchmark-tooling.md): two builds of unchanged
  source can list a fixture's fields in two orders in those libraries'
  generated schemas.
- A readable `Blink: Booleans` encode cell, in
  [benchmark-tooling.md](benchmark-tooling.md): surge's encode of that row
  runs at one of two speeds per Studio process.

## Deferred indefinitely

These need a concrete driver before they are worth designing, and nothing
above depends on them:

- [generated-code-performance.md](generated-code-performance.md): what is
  left of the generated code's speed. Every catalog row with a hand-written
  codec is within the band of it, and what is left needs a catalog row of a
  kind the catalog lacks, such as a sequence or a tuple with a rest, or is
  smaller than the speed tier reads.
- [networking.md](networking.md): the `surge-net` transport layer.
  Serializer-layer work is complete without it.
- [schema-versioning.md](schema-versioning.md): schema evolution. Only
  needed once a deployment runs two builds against one shape.
- [schema-fingerprint.md](schema-fingerprint.md): a compile-time fingerprint
  of a type's encoding, optional and off by default, so a game can detect
  bytes that a build with a different type wrote. It waits for a consumer,
  such as a game that persists surge bytes across releases.
- In [benchmark-tooling.md](benchmark-tooling.md): a third tier, for wire
  cost, and a Zap-shaped timing. Each needs a driver.
- [headless-ci.md](headless-ci.md): automated benchmark runs in CI. The
  harness in [benchmark-tooling.md](benchmark-tooling.md) is run by hand;
  gating on its numbers is a separate decision.
- [agent-conventions.md](agent-conventions.md): a hook that blocks an agent's
  edits to generated files, and task skills. Each waits for a reason.
