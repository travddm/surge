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

| Step | Document                                                                                                                                  | Why here                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | [documentation-restructure.md](documentation-restructure.md), delivering the user pages of [documentation-gaps.md](documentation-gaps.md) | User pages, specs under `docs/specs/`, and research papers under `docs/research/`, written against fixed behavior and corrected numbers.                                                                                                                                                                                                                                                                          |
| 2    | [type-coverage-parity.md](type-coverage-parity.md) Tier B, designed in [data-type-surface.md](data-type-surface.md)                       | New `DataType.*` surface. The length-typed containers and the per-component widths have landed, and with them the measured reason this came first; what is left is numeric ranges, a bit-packed set of a fixed member list, and a quantized `CFrame` rotation. `Range<Min, Max>` needs the write-side half of the `checks` option, which is the same tier's item 3, and none of the three rests on a measurement. |
| 3    | [ci-and-release.md](ci-and-release.md): version backstop and first tagged release                                                         | The backstop lands with the release it protects. The CI-only items do not wait; see below.                                                                                                                                                                                                                                                                                                                        |

## No step of its own

These are small, have no dependency on the order above, and can land at any
time:

- [generated-code-performance.md](generated-code-performance.md): the
  per-call gap of about 0.2 µs to hand-written Luau, with two table
  allocations per `serialize()` named as the next thing to measure; the
  package pragma and the read loop, both reopened by the re-measurement;
  coalescing a tuple's fixed-size elements, which needs a fixture; three
  smaller items; and the per-function `@native` attribute. It also holds the
  file-directive recommendation until `performance.md` is written.
- [enum-and-opaque-union-members.md](enum-and-opaque-union-members.md).
  Its stage 1 has landed: a union of items from two enums is a diagnostic,
  where two items of the same name used to produce a wrong value with no
  error. The later stages add support for `Enum.X | string`
  and `Instance | string`, which are diagnostics today; they change
  `guardedUnion` variant order. `bytes.spec.ts` pins no union with an
  enum or opaque member, so they move no pinned buffer today.
- [blob-classification.md](blob-classification.md): whether an empty object
  type should encode as zero bytes, which waits on the design decision that
  document records.
- What is left of [benchmark-tooling.md](benchmark-tooling.md): widening the
  hand-written baseline to the tagged union and the packed toggles, which
  waits on the per-call gap to hand-written Luau being understood and on
  Tier B settling the large record's length prefix; measuring the generated
  Luau's size, which needs each factory call in a module of its own; and a
  third tier, for wire cost, that needs a driver.
- The stale-statement checklist in
  [documentation-gaps.md](documentation-gaps.md). Every entry describes
  behavior that is already final.
- The Luau file directives, also from
  [documentation-gaps.md](documentation-gaps.md): a consumer-facing statement
  that a module holding generated serializers should carry `//!native` and
  `//!optimize 2`, and what else that module may hold. It is the one piece of
  the user pages, in `performance.md`, that depends on neither step 1 nor
  step 2, and since
  `benchmarks/speed.md` stopped advising, it is the only recommendation with
  no home outside this directory.
- [dict-key-typing.md](dict-key-typing.md): a `Map` or `Set` keyed by a
  Roblox datatype, or by a literal union, generates Luau that is correct
  and TypeScript that does not check, so the build fails with no
  diagnostic and nothing the user can open. The coverage table promises
  those keys today. Found while writing the `checks` fixtures.
- [single-sided-recursive-factories.md](single-sided-recursive-factories.md):
  `createSerializer` or `createDeserializer` on a recursive type generates
  code that does not type-check, so the build fails with no diagnostic. The
  smallest fix here with the widest reach.
- [types-the-walk-mishandles.md](types-the-walk-mishandles.md): a type
  parameter, `void`, `undefined`, `never`, a user type named `Map` or `Set`, a
  cycle through arrays alone, and a union of tuples. The constrained type
  parameter drops properties silently and goes first; the rest fail the build.
- The two gaps in the read half of `checks`, recorded in
  [data-type-surface.md](data-type-surface.md): a packed `CFrame` read has no
  bound, and an `enum` index and a packed rotation code have no range check.
  Neither waits on the rest of Tier B.
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
