# Future work: index and implementation order

Part of the [surge](../architecture.md) design. One document per unit of
work. The order below is the recommended implementation order; each step
names the documents it delivers and why it comes where it does. The last
section lists the documents that can be deferred indefinitely.

The fixture harness in [transformer-unit-test-coverage.md](transformer-unit-test-coverage.md)
(a stub `@rbxts/surge` and dev-installed `@rbxts/types` in the
transformer's tests, plus printed-emitter snapshots) has landed, so every
fix below can land with a regression test; that document now tracks only
the remaining walker cases and diagnostic-message assertions, added
alongside the fixes below rather than as their own step.

The five correctness fixes that used to be steps 1 to 5 here (type-identity
keying for the walker's caches, recursion through unions, read-side
statement order, literal/guardedUnion/discriminant determinism plus packed
padding, and enum index width with an O(1) lookup table) have all landed,
with regression tests in the transformer repo's `test/walk.test.ts`/
`test/emit.test.ts`/`test/transform.test.ts` and round-trip fixtures in
`coverage.spec.ts`. See Transformer Design in [transformer.md](../transformer.md)
for the current, corrected behavior. One narrow, non-correctness item from
the enum-encoding review is still open: see
[enum-encoding.md](enum-encoding.md).

[blob-classification.md](blob-classification.md) has also landed its
correctness half: `Instance` (and subclasses) and every Roblox datatype now
route to the blob passthrough channel via an identity-based `_nominal_*`
brand check instead of being walked structurally, and the previously-silent
function/`symbol`/`bigint`/`null`/template-literal/index-signature
misclassifications now report a diagnostic. `Vector2` has a real encoding.
The document no longer has a step of its own. Its one remaining item is
the empty-object-as-zero-bytes case, which waits on a design decision
recorded there; Tier A has delivered the per-datatype encodings.

The walker and emitter robustness work that used to be step 1 has landed,
with the local-register ceiling from
[generated-code-performance.md](generated-code-performance.md), and its
document is removed. Property names that are not identifiers, Roblox
datatypes and recursive object types as union members, a re-aliased
`Packed<T>`, and a user declaration named after an injected import now
compile correctly. A tuple whose rest element is not last, a union the
write side cannot guard, and a factory call without a type argument are
diagnostics, and every diagnostic reaches the user as a `ts.Diagnostic`
with a file and position. Two items were decided, not fixed: a factory call
is not transformed from its contextual type, and a packed `boolean` that is
not a direct object property stays byte-aligned with no diagnostic. See
Transformer Design §8 and §9, Type Coverage, and Risks in
[transformer.md](../transformer.md). Regression tests are in the
transformer repo's `test/` and round-trip fixtures in `coverage.spec.ts`.

The round-trip test coverage work that used to be step 1 has also landed,
and its document is removed. `tests/src/tests/` has one suite per area of
Type Coverage, each with fixed cases (`@Theory` with `@InlineData` where
the cases are plain values) and a seeded fuzz `@Fact`. Every fact in
those suites, and the three facts of `coverage.spec.ts` that compared too
little, compare the whole value with `difference` from
`tests/src/support.ts`.
`bytes.spec.ts` pins the exact bytes of the shapes whose encoding is
final, so an encoding change that moves one of them fails there.
It does not pin a union with an enum member, because an open document
changes those bytes, or a `CFrame` with a rotation that is not
axis-aligned, whose axis-angle form is not exact. Two cases
have no round-trip fixture: an `Enum` with more than 256 members (see
[enum-encoding.md](enum-encoding.md)), and an integer outside its
`DataType` width, for which the design states no result. The new fixtures
found five shapes whose generated code failed the type check, so the build
failed: a tuple whose rest element type differs from a fixed element, an
optional property, an optional literal union, and a tuple property inside
a recursion helper, and a required
property of type `unknown`. All five are fixed, and `transform.test.ts`
now type-checks generated code in a second program, as roblox-ts does. See
Testing strategy in [testing.md](../testing.md).

The same work found that an `unknown` property that is absent or
`undefined` (`a?: unknown`) shifted every later blob into the wrong field
with no error. That is fixed, and its document is removed: `unknown` and
`any` now walk as `optional(blob)`, which adds a presence byte to each
such field. See Blob / passthrough channel in
[transformer.md](../transformer.md).

Tier A of [type-coverage-parity.md](type-coverage-parity.md), which used
to be step 1, has landed; that document keeps Tier B.

- `Vector3int16`, `UDim`, `UDim2`, `BrickColor`, `NumberRange`, `Rect`,
  and `DateTime` each have their own encoding, as rows of one
  table-driven `datatype` kind, and `buffer` has its own kind.
- The `NumberSequence` Envelope is kept.
- `DataType.u24` and `DataType.i24` exist. f16 is decided against;
  Deliberate non-gaps in that document records why.
- Inside `Packed<T>`, an `optional`'s presence and the tag of a
  two-variant tagged union are each one bit, and a `CFrame` has a 1, 13,
  or 25 byte form. The packed region moved from the end of each object to
  its head.
- Every encoding is pinned in `bytes.spec.ts`. `DateTime` uses a stand-in
  global in the Lune runner, because Lune has none.
- The work found a sixth shape whose generated code failed the type check
  (a `Record` inside a recursion helper or a block-split object), fixed in
  `rbxts-transformer-surge` `671439f`.

See Type Coverage and `Packed<T>` in [transformer.md](../transformer.md).

The benchmark harness has landed, and with it the first checked-in
numbers. `tests/src/bench/` is now a fixture catalog of 16 rows, one
`Adapter<T>` per library, a size module, and `speed.spec.ts`. `mise run
bench:size` runs the size tier under Lune — through the fake-Instance shim
the round-trip runner now shares with it — and writes
[benchmarks/size.md](../benchmarks/size.md); `mise run bench:speed`
replaces `mise run tests:benchmark` for the speed tier. The size table is
also a byte-regression gate: it carries no date or machine, so it changes
only when an encoding changes.

The fbs and serio adapters have landed too, so that table now has three
columns, each non-surge one with its ratio against surge, and a round-trip
column that reports how far a decode moved the value rather than only that
it did. Each row declares its shape once per library, because a width
brand belongs to the library that declares it. surge and fbs agree byte
for byte on 14 of 16 rows; the `CFrame` rows are where the three libraries
part, and surge's packed axis-aligned row is its clear win at 654 bytes
against 1179 and 904, and the only exact one of the three. Four rows differ from the plan, for
reasons recorded in that document. Zap is now a size-only target, and it
comes after Blink: it has no callable encoder, so its bytes are measurable
through a mocked RemoteEvent but its encode throughput is not measurable
honestly at all. Blink comes first because the two share the cost — a
compiler binary, IDL twins of all 16 rows, and the mocked remote — and
Blink also yields real timings. Still open there: the Blink adapter, Zap's
size column, the hand-written baseline, the first speed run, and the
generated-Luau-size column.

The fbs and serio adapters, and the per-library size table they produce,
landed after everything above, in this repository's `tests/` only: no
transformer or `@rbxts/surge` source changed with them.

Every claim in this directory was checked against both repositories at
`surge` `7cce55e` and `rbxts-transformer-surge` `0e7c10d`. The order below
changed as a result; each row states why. The robustness work described
above landed after those commits, in `rbxts-transformer-surge` `4067844`,
and the round-trip coverage work after that, with its emitter fixes in
`rbxts-transformer-surge` `e74935d`. The `unknown` presence flag and the
two-enum diagnostic are in `rbxts-transformer-surge` `5e6c2d7`, and Tier A
ends at `rbxts-transformer-surge` `aa59c4a`.

## Order

| Step | Document                                                                          | Why here                                                                                                                                                                                                                                 |
| ---- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | [benchmark-tooling.md](benchmark-tooling.md)                                      | The Blink adapter, Zap's size-only column, and the hand-written baseline. The harness and the surge, fbs, and serio columns have landed; [benchmarks/size.md](../benchmarks/size.md) records all three libraries' bytes for all 16 rows. |
| 2    | [generated-code-performance.md](generated-code-performance.md)                    | Every remaining item is measurement-driven, so it follows the harness.                                                                                                                                                                   |
| 3    | [type-coverage-parity.md](type-coverage-parity.md) Tier B                         | New `DataType.*` surface (length-typed containers, per-component widths, ranges). That document asks for the harness first, to show what each bound saves. Split from Tier A, which has landed, for that reason.                         |
| 4    | [deserialize-hardening.md](deserialize-hardening.md)                              | Opt-in checks; needed before the networking layer, not before.                                                                                                                                                                           |
| 5    | [documentation-gaps.md](documentation-gaps.md): `docs/usage.md`                   | User documentation written against fixed behavior. The stale-statement sweep in the same document does not wait; see below.                                                                                                              |
| 6    | [ci-and-release.md](ci-and-release.md): version backstop and first tagged release | The backstop lands with the release it protects. The CI-only items do not wait; see below.                                                                                                                                               |

## No step of its own

These are small, have no dependency on the order above, and can land at any
time:

- [enum-and-opaque-union-members.md](enum-and-opaque-union-members.md).
  Its stage 1 has landed: a union of items from two enums is a diagnostic,
  where two items of the same name used to produce a wrong value with no
  error. The later stages add support for `Enum.X | string`
  and `Instance | string`, which are diagnostics today; they change
  `guardedUnion` variant order. `bytes.spec.ts` pins no union with an
  enum or opaque member, so they move no pinned buffer today.
- The stale-statement checklist in
  [documentation-gaps.md](documentation-gaps.md). Every entry describes
  behavior that is already final.
- The CI items in [ci-and-release.md](ci-and-release.md): the transformer
  workflow running the integration suite, the pinned sibling ref, `npm ci`,
  and the Windows job. The transformer's CI cannot see a broken
  serializer today.
- The remaining Tier 2 work in
  [benchmark-tooling.md](benchmark-tooling.md): the speed suite compiles and
  type-checks but has never been run, which needs a Roblox Studio process
  and no other open step.
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
