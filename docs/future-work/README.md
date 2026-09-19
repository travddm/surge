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
The document no longer has a step of its own. Its two remaining items are
the last per-datatype encoding (`DateTime`; step 1 has delivered the
others), and the empty-object-as-zero-bytes case, which waits on a design
decision recorded there.

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
final, so an encoding change in step 1 that moves one of them fails there.
It does not pin anything inside `Packed<T>` except booleans, or a union
with an enum member, because an open document changes those bytes, or a
`CFrame` with a rotation, whose axis-angle form is not exact. Two cases
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

Every claim in this directory was checked against both repositories at
`surge` `7cce55e` and `rbxts-transformer-surge` `0e7c10d`. The order below
changed as a result; each row states why. The robustness work described
above landed after those commits, in `rbxts-transformer-surge` `4067844`,
and the round-trip coverage work after that, with its emitter fixes in
`rbxts-transformer-surge` `e74935d`. The `unknown` presence flag and the
two-enum diagnostic are in `rbxts-transformer-surge` `5e6c2d7`, and the
Tier A work so far ends at `rbxts-transformer-surge` `02a3513`. That work
found a sixth shape whose generated code failed the type check (a `Record`
inside a recursion helper or a block-split object), fixed in `671439f`.

## Order

| Step | Document                                                                                                                              | Why here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | [type-coverage-parity.md](type-coverage-parity.md) Tier A, with the datatype list in [blob-classification.md](blob-classification.md) | In progress. Landed: `Vector3int16`, `UDim`, `UDim2`, `BrickColor`, `NumberRange`, `Rect`, and `buffer` encodings, the `NumberSequence` Envelope, and u24/i24, each pinned in `bytes.spec.ts`. Packed `optional` presence bits have also landed (the packed region moved to the head of each object). Open: the packed 2-way tag bit and the packed `CFrame` table (the rest of item 3), and two that need a decision first: `DateTime` (no Lune fixture is possible) and f16 (needs a runtime helper). |
| 2    | [benchmark-tooling.md](benchmark-tooling.md)                                                                                          | The size and speed comparison harness against the four libraries. Follows step 1 so that rows containing a Tier A datatype do not move after they are recorded.                                                                                                                                                                                                                                                                                                                                         |
| 3    | [generated-code-performance.md](generated-code-performance.md)                                                                        | Every remaining item is measurement-driven, so it follows the harness.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 4    | [type-coverage-parity.md](type-coverage-parity.md) Tier B                                                                             | New `DataType.*` surface (length-typed containers, per-component widths, ranges). That document asks for the harness first, to show what each bound saves. Split from Tier A for that reason.                                                                                                                                                                                                                                                                                                           |
| 5    | [deserialize-hardening.md](deserialize-hardening.md)                                                                                  | Opt-in checks; needed before the networking layer, not before.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 6    | [documentation-gaps.md](documentation-gaps.md): `docs/usage.md`                                                                       | User documentation written against fixed behavior. The stale-statement sweep in the same document does not wait; see below.                                                                                                                                                                                                                                                                                                                                                                             |
| 7    | [ci-and-release.md](ci-and-release.md): version backstop and first tagged release                                                     | The backstop lands with the release it protects. The CI-only items do not wait; see below.                                                                                                                                                                                                                                                                                                                                                                                                              |

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
  [documentation-gaps.md](documentation-gaps.md). Every entry but the
  packed `CFrame` one describes behavior that is already final.
- The CI items in [ci-and-release.md](ci-and-release.md): the transformer
  workflow running the integration suite, the pinned sibling ref, `npm ci`,
  and the Windows job. Step 1 changes the transformer, and its CI
  cannot see a broken serializer today.
- The Lune size tier of [benchmark-tooling.md](benchmark-tooling.md) needs no
  Roblox process. The wire format is deterministic now, but it is not frozen:
  each step 1 encoding changes the bytes of its datatype, so record numbers
  for those rows after step 1.
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
