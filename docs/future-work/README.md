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
reasons recorded in that document.

Blink has landed too, as a fourth column on the 11 rows it can express. It
is an IDL compiler, so it needs `.blink` twins of those rows
(`bench/definitions/catalog.blink`, compiled by `mise run bench:definitions`
into checked-in modules), hand-written declarations because its own
TypeScript output exports nothing, and enough of a mocked remote environment
in the Lune shim for its generated module to load. It has no cell on the
enum-heavy row (no Roblox `EnumItem`), the guarded union (no untagged
union), or the three packed rows (no `Packed<T>`), and a missing cell is
rendered empty. Where it does have one it is at or below surge, and every
byte of the difference is its u16 length prefix against surge's u32 — an
argument for the length-typed containers in Tier B of
[type-coverage-parity.md](type-coverage-parity.md), and for nothing else.

Zap has landed as a size-only column on 12 rows. It has no callable encoder,
so its adapter fires one event at a mocked RemoteEvent and measures what
`SendEvents` flushes, minus the event-id byte; `opt tooling` decodes it back.
That mock exists only under Lune, so the speed suite skips it. Its bytes
match Blink's on every row both express except the large record, where its
map header is a byte wider, and for the same reason as Blink's: a u16 length
prefix where surge writes u32. Its bit packing is per scope, so an array of
1000 booleans costs it a byte each, exactly what the others pay.

The hand-written baseline is the sixth and last column, over the flat struct,
the nested object, and the `CFrame` array. It is Luau, not TypeScript,
because what it measures is what the Luau costs, and it writes surge's bytes
exactly — 17, 24, and 1204 — so the speed tier compares code and not formats.
The speed tier has since run, through `run-in-roblox`, and
[benchmarks/speed.md](../benchmarks/speed.md) records it: surge encodes
between 2.12× and 2.82× slower than that baseline and decodes between 1.51×
and 2.40× slower, on identical bytes. Its columns are not all compiled alike,
which that file states first — fbs and Blink carry `--!native` and
`--!optimize 2` where roblox-ts emits neither.

The fbs, serio, Blink, and Zap adapters, and the per-library size table they
produce, landed after everything above, in this repository's `tests/`,
`docs/`, `mise.toml`, and root `package.json` only: no transformer or
`@rbxts/surge` source changed with them.

The first item of step 1 has since landed, and it is the first entry of
[generated-code-performance.md](generated-code-performance.md) to be
measured on its own. Count-driven reads (`array`, `tuple` rest, `dict`,
sequences) are emitted as `for (const _i of $range(1, count))` now, so they
lower to a Luau numeric `for` instead of the `while` loop with a
`_shouldIncrement` flag that roblox-ts lowers a C-style `for` to; no
compiled file under `tests/out` has one left, and a golden check pins that.
Two scoped speed runs either side of the change put it at 1.00×, inside the
drift of the libraries that did not change — including on the row whose one
decode call runs that loop a thousand times. The change stays, because the
emitted code is what the design says it should be, but it removes nothing
from the list below except itself. That document records what it measured
and what follows for the rest of the read side.

The second item has landed with it, and it is the first change in this
directory to move a number. A tagged-union read built the variant literal
and then spread it to add the tag, which roblox-ts lowers to `table.clone`
plus `setmetatable` plus an assignment, so every variant read allocated a
table and copied it. The tag is part of the literal now. On the tagged union
row — the only one of the catalog with a tagged union, reading a hundred
variants per decode call — that is 1.39× on decode, 6929 values per second
to 9608, against a drift of 0.92× to 1.03× over the 76 cells quiet in both
runs. surge's own encode cell and every other library on the same row sit at
0.98× to 1.00×.

A third change has landed under the same step's one-helper-call-per-field
item, and it is the largest result the plan has produced. An unpacked
`CFrame` reserved its 24 bytes as two `alloc(12)` calls, one for the
position and one for the rotation vector, with `ToAxisAngle` between them;
neither statement between them can grow the scratch buffer, so it is one
`alloc(24)` now. No byte moves. On the `CFrame` array row, a thousand
elements per call and therefore one saved `alloc` call per element, that is
1.61× on encode and 1.35× on decode, against a drift of 0.99× to 1.03× over
79 cells quiet in both runs. The two packed `CFrame` rows encode through a
runtime function this does not touch and did not move, which is the control.
The row was surge's worst against the hand-written baseline on encode and is
now its best. The rest of that item — a run of consecutive fixed-size fields
sharing one reservation — is still open, and this is the evidence it is
worth the machinery.

The item that `CFrame` was one piece of has since landed whole, and it is
the largest result the plan has produced. An object's consecutive
fixed-size fields now share one reservation: a five-field struct reserves
once instead of five times, and each field after the first takes a position
local off it, which is a register move and not a call into the package.
`alloc` order is byte order, so only a field that reserves a constant
number of bytes in one piece may join a run, and a run stops at one block's
worth of locals — the 50-field wide struct is two reservations, not one.
Against the previous run: 4.70× on encode and 3.01× on decode on Blink's
`Entities` bench, 3.96× on the wide struct's decode, 1.72× and 1.51× on the
unpacked toggles, 1.43× on the flat struct's decode, and 1.17× on the
tagged union, whose variants' own fields form a run. The rows with nothing
to share — the large array, the large record, the string-heavy row, the
enum-heavy row — are 0.99× to 1.01×, and the 71 cells quiet in both runs
drift 0.98× to 1.02×. A tuple's fixed elements are the same shape of thing
and are not covered, because no fixture serializes a tuple to measure it
with.

One more change landed with it, and it is worth nothing measurable, which
is the useful part. Every `serialize()` allocated a table for the blob side
channel and called into it three times per round trip, whether the shape had
a blob field or not — and none of the catalog's 16 rows has one. The
transformer now emits those entry points only where the body actually
reaches a blob. surge's 21 quiet cells moved by a median of 0.997×, inside
the 0.96× to 1.02× the untouched libraries drifted. Set against the 4.70×
that removing one `alloc` call per element was worth, that is the shape of
the whole cost: per-element overhead is what matters, and per-call overhead
is not.

The same work found that `mise run ci` and both benchmark tiers could read
the previous transformer's output: `tests/tsconfig.json` sets `incremental`
and the transformer is a tsconfig plugin, not an input file, so an
`rbxtsc` run after a transformer-only change reused the previous emit.
`tests:install` now deletes `tests/out/tsconfig.tsbuildinfo` alongside the
two packed `file:` dependencies it already deleted, for the same reason. See
Benchmarking strategy in [testing.md](../testing.md).

Every claim in this directory was checked against both repositories at
`surge` `7cce55e` and `rbxts-transformer-surge` `0e7c10d`. The order below
changed as a result; each row states why. The robustness work described
above landed after those commits, in `rbxts-transformer-surge` `4067844`,
and the round-trip coverage work after that, with its emitter fixes in
`rbxts-transformer-surge` `e74935d`. The `unknown` presence flag and the
two-enum diagnostic are in `rbxts-transformer-surge` `5e6c2d7`, and Tier A
ends at `rbxts-transformer-surge` `aa59c4a`.

## Order

Both benchmark tiers have since run, and the order below was re-examined
against what they measured. It stands.
[generated-code-performance.md](generated-code-performance.md) is first
because the hand-written baseline put a number on it, and Tier B of
[type-coverage-parity.md](type-coverage-parity.md) is second because the size
table showed that every byte Blink and Zap save against surge is a length
prefix. Nothing measured moved anything else.

| Step | Document                                                                          | Why here                                                                                                                                                                                                                                                                                         |
| ---- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | [generated-code-performance.md](generated-code-performance.md)                    | The harness has run, and [benchmarks/speed.md](../benchmarks/speed.md) is the measurement every item here was waiting for: a hand-written codec writing surge's exact bytes encodes up to 2.82× faster. Five changes from it have landed, for 1.00×, 1.39×, 1.61×, up to 4.70×, and 1.00× again. |
| 2    | [type-coverage-parity.md](type-coverage-parity.md) Tier B                         | New `DataType.*` surface (length-typed containers, per-component widths, ranges). The harness has now shown what a bound is worth: every byte Blink and Zap save against surge is a length prefix, and nothing else. Split from Tier A, which has landed.                                        |
| 3    | [deserialize-hardening.md](deserialize-hardening.md)                              | Opt-in checks; needed before the networking layer, not before.                                                                                                                                                                                                                                   |
| 4    | [documentation-gaps.md](documentation-gaps.md): `docs/usage.md`                   | User documentation written against fixed behavior. The stale-statement sweep in the same document does not wait; see below.                                                                                                                                                                      |
| 5    | [ci-and-release.md](ci-and-release.md): version backstop and first tagged release | The backstop lands with the release it protects. The CI-only items do not wait; see below.                                                                                                                                                                                                       |

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
