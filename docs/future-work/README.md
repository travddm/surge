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

| Step | Document                                                                          | Why here                                                                                   |
| ---- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1    | [ci-and-release.md](ci-and-release.md): version backstop and first tagged release | The backstop lands with the release it protects. The CI-only items do not wait; see below. |

## No step of its own

These are small, have no dependency on the order above, and can land at any
time:

- [generated-code-performance.md](generated-code-performance.md): the
  per-call gap to hand-written Luau, with two table
  allocations per `serialize()` named as the next thing to measure, and exact
  sizing for a shape with no loop over elements of varying size; the
  package pragma and the read loop, both reopened by the re-measurement;
  fewer reservations, across a nested object, for a string's count and bytes,
  for an array of fixed-size elements, and for a tuple's fixed-size elements,
  which needs a fixture; three smaller items; the per-function `@native`
  attribute; and whether surge should ever add the file directives itself.
- [blob-channel-state.md](blob-channel-state.md): the blob channel's state
  moved from the package into each serializer's closure, as the scratch
  buffer's was. It removes the rule that two serializers with blob fields must
  not overlap. It changes the helper ABI, so it ships in a release of both
  packages.
- [schema-fingerprint.md](schema-fingerprint.md): a compile-time fingerprint
  of a type's encoding, so a game can detect bytes that a build with a
  different type wrote. It changes no byte. It is most useful once there is a
  release whose bytes a later release reads.
- [native-code-limits.md](native-code-limits.md): where a large serializer, or
  a large module of them, passes a native code generation limit and runs
  interpreted. Measure first.
- [enum-and-opaque-union-members.md](enum-and-opaque-union-members.md):
  support for `Enum.X | string`, a union of items from two enums, and
  `Instance | string`, each a diagnostic. Support changes `guardedUnion`
  variant order, but `bytes.spec.ts` pins no union with an enum or opaque
  member, so it moves no pinned buffer.
- [blob-classification.md](blob-classification.md): whether an empty object
  type should encode as zero bytes, which waits on the design decision that
  document records.
- What is left of [benchmark-tooling.md](benchmark-tooling.md): widening the
  hand-written baseline to the tagged union and the packed toggles, which
  waits on the per-call gap to hand-written Luau being understood; measuring
  the generated Luau's size, which needs each factory call in a module of its
  own; a third tier, for wire cost, that needs a driver; and a Zap-shaped
  timing, which needs one too.
- The CI items in [ci-and-release.md](ci-and-release.md): the transformer
  workflow running the integration suite, the pinned sibling ref, `npm ci`,
  and the Windows job. The transformer's CI cannot see a broken
  serializer today.
- [transformer-unit-test-coverage.md](transformer-unit-test-coverage.md): a
  test of the package-name cache in `detect.ts`, which needs `fs` mocking.
- [enum-encoding.md](enum-encoding.md): a one-byte saving that needs an IR
  change. Do it with a broader `literalConst` cleanup, not alone.

## Deferred indefinitely

These need a concrete driver before they are worth designing, and nothing
above depends on them:

- [networking.md](networking.md): the `surge-net` transport layer.
  Serializer-layer work is complete without it.
- [caller-buffers.md](caller-buffers.md): writing into and reading from a
  caller's buffer at an offset. `surge-net`'s per-frame batching is its
  driver. Its blob handling builds on
  [blob-channel-state.md](blob-channel-state.md), and its constant size on
  the first item under fewer reservations in
  [generated-code-performance.md](generated-code-performance.md).
- [schema-versioning.md](schema-versioning.md): schema evolution. Only
  needed once a deployment runs two builds against one shape.
- [headless-ci.md](headless-ci.md): automated benchmark runs in CI. The
  harness in [benchmark-tooling.md](benchmark-tooling.md) is run by hand;
  gating on its numbers is a separate decision.
- [agent-conventions.md](agent-conventions.md): a hook that blocks an agent's
  edits to generated files, and task skills. Each waits for a reason.
