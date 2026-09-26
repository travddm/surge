# Future work: generated code performance

Part of the [surge](../architecture.md) design. Open work on how fast the
code the transformer generates runs. What has been measured is under
[docs/research/](../research/README.md):

- [generated-code-against-hand-written.md](../research/generated-code-against-hand-written.md)
  — the inline reservation, and the gap to hand-written Luau it left.
- [per-call-overhead.md](../research/per-call-overhead.md) — the blob side
  channel and `finishWrite`'s copy.
- [file-directives-on-generated-code.md](../research/file-directives-on-generated-code.md)
  — what `--!native` and `--!optimize 2` are worth.
- [noise-in-the-speed-tier.md](../research/noise-in-the-speed-tier.md) — how
  far apart two runs of unchanged code land, which is the band every
  measurement here is read against.
- [tables-around-serialize.md](../research/tables-around-serialize.md) — the
  tables around a `serialize()` call, and the call to `finishWrite`.
- [one-reservation-per-array.md](../research/one-reservation-per-array.md) —
  reserving an array's fixed-size elements once, ahead of its loop.
- [one-reservation-per-string.md](../research/one-reservation-per-string.md) —
  reserving a string's count and bytes at once.
- [exact-sizing.md](../research/exact-sizing.md) — creating the result at its
  exact size, and the per-call gap it closed.
- [sized-read-tables.md](../research/sized-read-tables.md) — creating a read's
  table at its size and storing each element at its index.

This document holds what is still open.

## What

**The per-call gap to hand-written Luau.** On the three rows the hand-written
baseline covers, surge's encode is behind a Luau codec writing the same bytes.
The gap has a part paid once per call, which is most of it on the flat struct
and the nested object, and a part paid per element, which is most of it on
the fifty-element `CFrame` array
([generated-code-against-hand-written.md](../research/generated-code-against-hand-written.md)
and its correction).
Most of the per-call part was three tables
([tables-around-serialize.md](../research/tables-around-serialize.md)). A
shape with no blob field now returns the buffer alone (Runtime API 3.6 in
[specs/runtime-api.md](../specs/runtime-api.md)), and the benchmark's
adapters no longer copy the result into a table of their own (Benchmark
harness 4.8 in [specs/benchmark-harness.md](../specs/benchmark-harness.md)).
Calling `finishWrite` instead of inlining it costs nothing measurable.

**What is left per element.** On the `CFrame` array's encode it is not the
reservation each element made: reserving the elements once moved that row's
gap no further than rows whose code did not change
([one-reservation-per-array.md](../research/one-reservation-per-array.md)).
What it is was not probed. The candidates in the code are: surge reads a
`CFrame`'s `Position` once for each of its three components, where the
hand-written codec (`tests/src/bench/baseline/codecs.luau`) reads it once
into a local, and surge's loop is a generic `for` over the array where the
hand-written one is a numeric `for`. A numeric `for` would also write an
absent element where the array has a hole, which the generic `for` skips
while its count includes it. On decode, the row's gap was the table the read
appended to, and almost none of it is left
([sized-read-tables.md](../research/sized-read-tables.md)).

**What is left per call.** A shape sized exactly (Transformer 5.20 in
[specs/transformer.md](../specs/transformer.md)) no longer has the three
candidates the code offered: `finishWrite`'s copy, the scratch state in the
closure, and the capacity check. That closed most of the flat struct's gap,
and half of the nested object's
([exact-sizing.md](../research/exact-sizing.md)). The nested object still
makes six reservations and reads its two strings' lengths once more for the
size. A shape that keeps the scratch buffer still has all three candidates.

One design the `finishWrite` probe did not reach: handing the caller a buffer
surge owns and reuses, which removes the allocation as well as the copy. It
would have to be an opt-in API, since a reused buffer is dead the moment
anything calls `serialize()` again, and what it is worth is unmeasured.

**Sizing a shape with a loop.** Exact sizing (Transformer 5.20) covers a
shape that a constant and the lengths and counts it reads can size. A shape
with a loop over elements of varying size, such as an array of strings, a
`dict`, or an array of union variants, keeps the scratch buffer, its
capacity checks and `finishWrite`'s copy. Sizing it takes a second traversal
of the value, as a `size(value)` function generated per shape and called
first. The copy was chosen over that because it needs one traversal, and
whether a second traversal could cost less than the copy is open: the copy
does not grow with the payload, and what it costs per call is not settled
([per-call-overhead.md](../research/per-call-overhead.md) and its
correction). Two-pass sizing could be an option of the factory, so that a
shape opts in where it measures better.

**Kinds exact sizing leaves out.** A union, a sequence and a packed `CFrame`
are not sized, and neither is anything that holds one. A union could be
sized from the branch it takes, which evaluates the branch's test twice. A
sequence could be sized from its keypoint count, which reads its `Keypoints`
property a second time, and what that read costs is not measured. A packed
`CFrame`'s size is in the header its runtime
function chooses, so sizing one needs a function of the package that computes
the header without writing it.

**Reopened: the package pragma.** The package's hot modules carry
`--!native`, and this was recorded as worth nothing, because marking only the
package moved almost no work into the native region. A loop benchmark of a
helper standing in for the old `alloc()` predicted a gain once the caller is
native as well, and set the entry aside because surge's generated work did
not sit inside the native region. It now largely does, and what native is
worth on the generated code
([file-directives-on-generated-code.md](../research/file-directives-on-generated-code.md))
is most of the way to that prediction, so the entry needs re-arguing against
the current figure. The loop's timings are not a result: they were taken
before the speed suite yielded, and no data file was kept.

**Reopened: the read loop.** Count-driven reads (`array`, `tuple` rest,
`dict`, sequences) are emitted as `for (const i of $range(1, count))`, which
roblox-ts lowers to a numeric `for`, instead of a C-style loop it lowers to a
`while` with a `_shouldIncrement` flag; `test/golden.test.mjs` pins that no
compiled file has the flag. It measured as no change on the decode rows quiet
enough to read, on a scoped pair taken before the suite yielded and with the
fixtures compiled interpreted. Neither condition holds now, and it was not
measured again. The change stays for what the emitted code says,
whatever it is worth.

**Fewer reservations.** A run of consecutive fixed-size properties of one
object shares one reservation, and a nested object whose properties all have
a fixed size joins the run around it (Transformer 5.5). An array of fixed-size
elements reserves all of them at once (Transformer 5.18), and a `str` or a
`buffer` its count and its bytes (Transformer 5.19). Nothing else shares a
reservation. The places below reserve more often than the bytes require.
Merging reservations changes no byte, because reservation order is byte order
either way. On a shape sized exactly, a reservation checks no capacity, so
what merging still saves there is a move of the cursor.

- **Through a nested object of mixed sizes.** A nested object with a
  variable-size property, such as a `str`, ends the run, and so does the end
  of that object. The deeply nested object reserves six times per call, and
  the hand-written codec for the same bytes allocates once. Its `count` and
  `flag` are consecutive in the bytes but belong to two objects, so they
  reserve apart. A run that crossed the boundary would stay open across the
  emission of more than one object, and would still have to end where a block
  of Transformer 5.8 does.
- **Tuple elements.** Coalesce a tuple's consecutive fixed-size elements into
  one reservation, the way an object's fields already are, and reserve its
  rest elements at once, the way an array's are. The mechanism is
  `fixedBytes`, `allocRuns`, `withAllocRun` and `reserveElements`, unchanged;
  what is missing is a benchmark fixture that serializes a tuple, without
  which nothing measures it.

**Smaller items.** A `serialize` sized exactly still moves its cursor past
its last reservation, where nothing reads it again, and a shape whose
reservations all merge could write at constant offsets with no cursor at all,
as the hand-written codec does. The scratch buffer only grows, so one large
payload pins its memory for the module's lifetime. An object large enough to be emitted in
blocks is read as `const result = {}` plus one assignment per field, so its
table grows by rehashing instead of being sized once by a table constructor.

**The per-function `@native` attribute, and typed Luau.** Neither is reachable
through the AST roblox-ts hands a transformer. `@native` has no `ts.factory`
representation, and the only text-injection path, a synthetic leading
comment, always renders as a real `--` comment, so it would come out as an
inert `--@native`. `@roblox-ts/luau-ast`'s `SyntaxKind` has forty node kinds
and none is a type, so the emitter cannot write an annotation either.

Both are reachable by rewriting the `.luau` file after roblox-ts has written
it, which `rbxts-transform-luau` (npm, 1.0.1) does: it reads what it needs out
of the checker, finds the output path from `outDir` and `rootDir`, and
rewrites the emitted text — hoisting a `--!` line, annotating
`local function` signatures, promoting never-reassigned locals to `const`.

- **`@native` per function** would make the file-shape recommendation below
  unnecessary, by marking the generated functions instead of the module. It
  is valid before a function expression (`Parser::parseAttributedFunction`,
  no FFlag gate), so it can sit on `serialize = function(value)` and nothing
  else. But `rbxts-transform-luau` matches `local function NAME(`, which does
  not reach an anonymous function expression inside a table constructor, so
  it is a contribution there or a pass of surge's own, not something that
  works for a consumer today. This stays open.
- **Type annotations** pay only where inference fails, and on surge's shape
  that is a value arriving through `TS.import`. Annotating both sides of a
  synthetic writer and helper was worth a small fraction of what `--!native`
  is worth on the generated code, and nothing without it
  ([file-directives-on-generated-code.md](../research/file-directives-on-generated-code.md)
  and its second correction): not enough to pay for a pass which rewrites
  files roblox-ts has written.
- **`const`** measured as no change against `local`, with the directive and
  without, and Lune 0.10.5 cannot parse it, so emitting it would break the
  round-trip suite. Nothing is lost by its absence.

**Injecting the directives.** [performance.md](../performance.md) recommends
both file directives on a module that holds only serializers, and surge does
not add them itself: the generated code is inlined into the call site's own
file (Transformer 5.1 in [specs/transformer.md](../specs/transformer.md)), so
a file-level `--!native` would also compile whatever unrelated code that file
holds. If surge is ever to inject it, the check is not "one serializer call
and its export": a module may declare several serializers, three of the
benchmark fixtures do, and may import types from anywhere, since none of that
reaches the Luau. What a check would have to establish is that the module
emits no other runtime code, which is a statement about what its statements
compile to and not about how many serializers it declares. `--!optimize 2` is
the weaker case, since it changes how well a file is compiled and not what it
means, but it is still not surge's to decide for a file surge does not own.

## Why deferred

Every item here is measurement-driven, and the method is settled: a change is
its own full catalog run against a reference taken in the same session, read
as medians over many cells against the untouched libraries as controls. The
per-call gap is the largest open item. Most of it is measured, and the three
tables behind it are gone for a shape with no blob field. The two reopened entries
need an argument against a current figure, not a change. The rest is small,
or needs a fixture before anything can measure it.

## How, briefly

- Measure each change on its own, as a probe or a before-and-after pair,
  with the four untouched columns in the same run as the control. Read medians,
  not single cells: how far two runs of unchanged code differ, on a column and
  on a cell, is [noise-in-the-speed-tier.md](../research/noise-in-the-speed-tier.md).
- A golden check in `test/golden.test.mjs` for each change that lands. The
  read loop's, the tagged union's, the `CFrame`'s, the shared reservation's,
  the read table's and the blob channel's are there already, and so are the
  file pragmas on both sides.
- Predict nothing from the compiled output. Whether a cost is paid per element
  or per call was the heuristic this document used to lean on, and the blob
  channel broke it: a per-call allocation was measurable, and whether a
  per-call `buffer.copy` of two kilobytes costs anything is not settled. Which
  kind of work a change removes says more than when it happens.
- Keep a before-and-after pair within one compilation mode. The fixtures and
  the baseline carry `--!native`, so a comparison with a build that did not
  measures a change of compilation mode as well.
