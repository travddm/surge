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
  allocations per `serialize()` named as the next thing to measure; the
  package pragma and the read loop, both reopened by the re-measurement;
  coalescing a tuple's fixed-size elements, which needs a fixture; three
  smaller items; the per-function `@native` attribute; and whether surge
  should ever add the file directives itself.
- [enum-and-opaque-union-members.md](enum-and-opaque-union-members.md):
  support for `Enum.X | string`, a union of items from two enums, and
  `Instance | string`, each a diagnostic, and one rejection that reports
  twice. Support changes `guardedUnion` variant order, but `bytes.spec.ts`
  pins no union with an enum or opaque member, so it moves no pinned buffer.
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
- [transformer-unit-test-coverage.md](transformer-unit-test-coverage.md):
  each remaining case lands with the fix or fixture it pins.
- [enum-encoding.md](enum-encoding.md): a one-byte saving that needs an IR
  change. Do it with a broader `literalConst` cleanup, not alone.

## Deferred indefinitely

These need a concrete driver before they are worth designing, and nothing
above depends on them:

- [networking.md](networking.md): the `surge-net` transport layer.
  Serializer-layer work is complete without it.
- [schema-versioning.md](schema-versioning.md): schema evolution. Only
  needed once a deployment runs two builds against one shape.
- [headless-ci.md](headless-ci.md): automated benchmark runs in CI. The
  harness in [benchmark-tooling.md](benchmark-tooling.md) is run by hand;
  gating on its numbers is a separate decision.
- [agent-conventions.md](agent-conventions.md): a hook that blocks an agent's
  edits to generated files, and task skills. Each waits for a reason.
