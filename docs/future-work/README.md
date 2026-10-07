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

| Step | Document                                                                                                                         | Why here                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | [generated-code-performance.md](generated-code-performance.md): what is left of the generated code's speed                       | The method its items are measured by is settled. Every catalog row with a hand-written codec is within the band of it; what is left needs a new catalog row, or is smaller than the speed tier reads. It changes neither the consumer API nor the bytes. Step 2's entry points reuse the body it changes, so it comes before them.                                                                                                                                    |
| 2    | [caller-buffers.md](caller-buffers.md): writing into and reading from a caller's buffer at an offset, and a type's constant size | Its blob handling builds on the blob channel's state being the serializer's ([research/blob-channel-inline.md](../research/blob-channel-inline.md)). Exact sizing moved a sized shape's buffer and cursor into the body its entry points reuse, and [benchmarks/code-size.md](../benchmarks/code-size.md) gives its code-size choice a number. It adds to the consumer API, so it comes before step 3. It starts with the shape of that addition, which is undecided. |
| 3    | [ci-and-release.md](ci-and-release.md): version backstop, documentation site, and first tagged release                           | The backstop lands with the release it protects, and the documentation site with the release it publishes, after every step above that can change the consumer API, the helper ABI or the bytes. The other CI items do not wait; see below.                                                                                                                                                                                                                           |

## No step of its own

These are small, have no dependency on the order above, and can land at any
time:

- The CI items in [ci-and-release.md](ci-and-release.md): the transformer
  workflow running the integration suite, the pinned sibling ref, `npm ci`,
  and the Windows job. The transformer's CI cannot see a broken
  serializer today.
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
