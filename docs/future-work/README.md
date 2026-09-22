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
[benchmarks/speed.md](../benchmarks/speed.md) records it: surge encodes 2.87×
slower than that baseline and decodes 1.63× slower on identical bytes, on the
one of its three rows whose trials are quiet; the other two put the encode gap
at 2.67× and 2.96× and spread by half their median. Its columns are not all compiled alike,
which that file states first — fbs and Blink carry `--!native` where
roblox-ts emits none.

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

A throwaway probe answered the one question left on that list.
`finishWrite` copies the written region into an exact-size result on every
`serialize()`, and it was the per-call cost with a reason to be different,
because it scales with the payload. A build whose `finishWrite` skipped the
copy moved surge's ten quiet encode cells by a median of 1.007×, inside the
0.99× to 1.05× the untouched libraries drifted — 1.011× on the 2004-byte
large array. `finishWrite` is a `buffer.create` and a `buffer.copy`, and the
probe removed only the copy, because the caller has to be handed a buffer;
so it rules out a static-size fast path and two-pass exact sizing, which
both still allocate one, and leaves open only the designs that hand the
caller a buffer surge reuses. The probe was reverted, not committed, and
[generated-code-performance.md](generated-code-performance.md) records what
it measured, what it does not, and why none of these 1.00× results survives
the generated code being compiled natively without being measured again.

That last point is not only about `finishWrite`. Sweeping every dismissal in
this directory against it found five more that rest on an interpreted
measurement and one that does not rest on a measurement at all: the read
loop, the blob channel, the two-pass exact-allocation design that
Transformer Design §4 rejected for one traversal over two, surge's own
package pragma, `Packed<T>`'s advantage over the unpacked path, and the
absence of f16. What native would change in
[generated-code-performance.md](generated-code-performance.md) is the list,
with what each one currently rests on.

A second pass over the same document, this time over how the dismissals were
argued rather than what they rest on, took two of them off that list
altogether. `--!optimize 2`
was filed as a dismissal that survived, because it measured at 1.00× with
`--!native` and without. It is not a performance item: level 2 adds function
inlining and loop unrolling, neither of which can reach a cross-module call or
a loop bounded by a count read at run time, so 1.00× is what the mechanism
predicts and what makes the directive free. What it buys is that the level is
pinned rather than inherited — a published place compiles at level 2 and
Studio does not — so a Studio profile is a profile of what runs live. And
type annotations and the per-function `@native` are not blocked on
reachability after all: `rbxts-transform-luau` reaches both by rewriting
the `.luau` file after roblox-ts has written it — the same pass that would
lift a directive out of the preamble — which is prior art for a route surge's
emitter does not have. They stay deferred — 1.09× on top of
`--!native` and nothing without it — but as unmeasured work behind the
emission fix, not as something that cannot be done. The same pass corrected
two statements of fact: a Luau hot comment is honoured anywhere ahead of the
first line of code rather than only on line 1, and `Packed<T>`'s decode ratio
before the shared-reservation change was 0.72×, not 0.75×.

The `//!native` emission fix that was step 1 has since landed, and with it
the rest of that decision. A directive in a file that calls
`createBinarySerializer` used to be emitted behind the injected
`local __surge_*` imports, where Luau ignores it and its linter warns that it
does; the transformer moves the file's leading comments onto the import it
injects now, so a directive comes out on line 1, above roblox-ts's own banner.
Every module this repository compiles carries `//!optimize 2` as a result —
the package, the tests place, each benchmark fixture, the adapters, and the
hand-written baseline — because a published place compiles at level 2 and
Studio does not. `index` is the one exception and cannot carry it: roblox-ts
emits a re-export-only module as `local exports = {}` and assignments, so a
directive there would land after code. Golden checks pin both halves, and the
transformer's own suite pins the order a file header keeps. What it unblocks
is the conditional list: marking a benchmark fixture native is a line of its
source now, so re-measuring it starts with one run rather than a hoist by
hand. That run establishes what `--!native` is worth on the generated code;
each item on the list is then a change measured against it. How, briefly in
that document carries the procedure.

A full run either side of the level change put it at nothing the catalog can
see. fbs and Blink, whose codecs were already level 2, are flat at 1.000× on
both halves, which is the control; surge's encode, where the generated code
does the work, is 1.004×. A few percent did move on the decode side, and it
moved by the same few percent for serio, whose codec did not change at all,
so that is the harness and the adapters rather than any codec. The column
table is in
[generated-code-performance.md](generated-code-performance.md).

That left a question the same reasoning raises. Level 2 adds function inlining
and loop unrolling, and neither reaches the generated code: only a local
function can be inlined, and every per-field call goes into the package
through `TS.import`; only a compile-time bound can be unrolled, and every
generated loop is bounded by a count read out of the buffer. What native would
change in
[generated-code-performance.md](generated-code-performance.md) now carries the
two routes that would change that — rolling the hot paths into the generated
code, which also removes the cross-module call this document has measured as
worth the most, and typing the imported values, which helps native code
generation rather than the inliner. The first is the largest open item in that
document.

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

The order below changed once more, and for a different reason than last
time. [generated-code-performance.md](generated-code-performance.md) was
first because the hand-written baseline had put a number on it. Its large
items have since landed, and so has the `//!native` emission fix that kept it
at the head last time. What keeps it there now is what the fix unblocked: six
measurements that are only valid for interpreted code, which What native would
change in that document lists, and which a fixture marked native in its own
source can now be measured against. The same section carries the largest open
item in the directory — rolling the hot paths into the generated code, which
is what would let optimization level 2 reach it, and which removes the
cross-module call per field that measured as worth up to 4.70×.

The smaller items of that document moved down, to No step of its own: on the
evidence they are the kind of per-call and Luau-side cost that measured at
1.00×, and one of them gets _less_ worth fixing under native, not more.

Tier B of [type-coverage-parity.md](type-coverage-parity.md) keeps second
place, for the reason it had: the size table showed that every byte Blink and
Zap save against surge is a length prefix. Nothing measured moved anything
else.

| Step | Document                                                                                                                                                          | Why here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | [generated-code-performance.md](generated-code-performance.md): the re-measurement the emission fix unblocked, and what level 2 needs to reach the generated code | The emission fix has landed, so What native would change starts with one run: a fixture is marked native in its own source now, and How, briefly gives the procedure. The same section carries the largest open item in the directory, which is rolling the hot paths into the generated code — the only route by which optimization level 2's inliner reaches it, and the one that removes the cross-module call per field. Six changes from this document have already landed, for 1.00×, 1.39×, 1.61×, up to 4.70×, 1.00× again, and the emission fix; a hand-written codec writing surge's exact bytes still encodes 2.87× faster on the one row of three that can be read. |
| 2    | [type-coverage-parity.md](type-coverage-parity.md) Tier B                                                                                                         | New `DataType.*` surface (length-typed containers, per-component widths, ranges). The harness has now shown what a bound is worth: every byte Blink and Zap save against surge is a length prefix, and nothing else. Split from Tier A, which has landed.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 3    | [deserialize-hardening.md](deserialize-hardening.md)                                                                                                              | Opt-in checks; needed before the networking layer, not before.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 4    | [documentation-gaps.md](documentation-gaps.md): `docs/usage.md`                                                                                                   | User documentation written against fixed behavior. The stale-statement sweep in the same document does not wait; see below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 5    | [ci-and-release.md](ci-and-release.md): version backstop and first tagged release                                                                                 | The backstop lands with the release it protects. The CI-only items do not wait; see below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

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
- The smaller items and the tuple elements in
  [generated-code-performance.md](generated-code-performance.md). Every
  per-call cost that document measured came back at 1.00×, and evaluating
  `s.size()` twice is Luau work that native code generation would make
  _cheaper_ to leave alone. A tuple's consecutive fixed-size elements are
  the same mechanism an object's fields already use, and no fixture
  serializes a tuple to measure it with.

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
