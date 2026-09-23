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

| Step | Document                                                                                                                                  | Why here                                                                                                                                                                                                                                                                                                                                                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | [documentation-restructure.md](documentation-restructure.md), delivering the user pages of [documentation-gaps.md](documentation-gaps.md) | User pages, specs under `docs/specs/`, and research papers under `docs/research/`, written against fixed behavior and corrected numbers.                                                                                                                                                                                                                         |
| 2    | [type-coverage-parity.md](type-coverage-parity.md) Tier B, designed in [data-type-surface.md](data-type-surface.md)                       | New `DataType.*` surface. The length-typed containers and the per-component widths have landed, and with them the measured reason this came first; what is left is numeric ranges, a bit-packed set of a fixed member list, and a quantized `CFrame` rotation. `Range<Min, Max>` needs step 1's validation switch, and none of the three rests on a measurement. |
| 3    | [ci-and-release.md](ci-and-release.md): version backstop and first tagged release                                                         | The backstop lands with the release it protects. The CI-only items do not wait; see below.                                                                                                                                                                                                                                                                       |

## No step of its own

These are small, have no dependency on the order above, and can land at any
time:

- What is left of
  [generated-code-performance.md](generated-code-performance.md): coalescing a
  tuple's consecutive fixed-size elements, and three smaller items — `s.size()`
  evaluated twice, the scratch buffer never shrinking, and a block-object's
  table sizing. Every large item in that document has landed, and every
  per-call cost it measured came back at 1.00×; evaluating `s.size()` twice is
  Luau work that native code generation makes _cheaper_ to leave alone, and a
  tuple's consecutive fixed-size elements are the same mechanism an object's
  fields already use, with no fixture serializing a tuple to measure it with.
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
  Tier B settling the large record's length prefix, and a third tier that
  needs a driver.
- The stale-statement checklist in
  [documentation-gaps.md](documentation-gaps.md). Every entry describes
  behavior that is already final.
- The Luau file directives, also from
  [documentation-gaps.md](documentation-gaps.md): a consumer-facing statement
  that a module holding generated serializers should carry `//!native` and
  `//!optimize 2`, and what else that module may hold. It is the one piece of
  `docs/usage.md` that depends on neither step 1 nor step 2, and since
  `benchmarks/speed.md` stopped advising, it is the only recommendation with
  no home outside this directory.
- [dict-key-typing.md](dict-key-typing.md): a `Map` or `Set` keyed by a
  Roblox datatype, or by a literal union, generates Luau that is correct
  and TypeScript that does not check, so the build fails with no
  diagnostic and nothing the user can open. The coverage table promises
  those keys today. Found while writing the `checks` fixtures.
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
