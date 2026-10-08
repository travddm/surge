# Future work: index and implementation order

Part of the [surge](../architecture.md) design. One document per unit of
work. The order below is the recommended implementation order; each step
names the documents it delivers and why it comes where it does. The sections
after it list work with no step of its own, the first work to revisit after
the first release, and the documents that can be deferred indefinitely.

This directory holds open work only. What the September 2026 review found,
and what has landed since, is in
[research/september-2026-review.md](../research/september-2026-review.md);
[contributing-docs.md](../contributing-docs.md) states the rule.

## Order

| Step | Document                                                                                                                                                            | Why here                                                                                                                                                                                                                                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | [single-repository.md](single-repository.md): both packages in this repository, where releases come from, and a Windows job                                         | The move changes how a release is cut and installed, so it lands before the first release, and it ends the CI pins that every change spanning both packages pays for. The workflow it writes also runs on Windows, where the maintainer works.                                                                                                |
| 2    | [documentation-site.md](documentation-site.md): one site for users and contributors, with the benchmarks and an API reference                                       | The first release waits for it, and it waits for the move, which sets where `docs/` lives and which workflow deploys it.                                                                                                                                                                                                                      |
| 3    | [benchmark-tooling.md](benchmark-tooling.md): a stable fbs and serio column, and a readable `Blink: Booleans` encode cell                                           | The site publishes the benchmark tables as a comparison with other libraries, so before the first release each column's code must stay the same from build to build, and each cell must be readable.                                                                                                                                          |
| 4    | [ci-and-release.md](ci-and-release.md): version backstop and first release, with the test in [transformer-unit-test-coverage.md](transformer-unit-test-coverage.md) | The backstop lands with the release it protects, and it changes the function whose cache that test covers. The release records all three benchmark tiers again on its own code. The cursor codec, the last addition to the consumer API that the plan held, has landed (Runtime API 3.15 in [specs/runtime-api.md](../specs/runtime-api.md)). |

## No step of its own

This is small, has no dependency on the order above, and can land at any
time:

- Claiming both npm names with a staged publish, in
  [single-repository.md](single-repository.md): `rbxts-transformer-surge` is
  unscoped, so anyone can register it before the first release.

## After the first release

- [schema-fingerprint.md](schema-fingerprint.md): a compile-time fingerprint
  of a type's encoding, optional and off by default, so a game can detect
  bytes that a build with a different type wrote. It is the first work to
  revisit after the first release, which makes possible the consumer it
  waits for: a game that persists surge bytes across releases. Because it is
  off by default, adding it after the release changes no game's bytes.

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
- In [benchmark-tooling.md](benchmark-tooling.md): a third tier, for wire
  cost, and a Zap-shaped timing. Each needs a driver.
- [headless-ci.md](headless-ci.md): automated benchmark runs in CI. The
  harness in [benchmark-tooling.md](benchmark-tooling.md) is run by hand;
  gating on its numbers is a separate decision.
- [agent-conventions.md](agent-conventions.md): a hook that blocks an agent's
  edits to generated files, and task skills. Each waits for a reason.
