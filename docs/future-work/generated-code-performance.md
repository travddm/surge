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
- [per-element-encode.md](../research/per-element-encode.md) — reading a
  `CFrame`'s position once, and a numeric write loop that measured slower.
- [nested-object-values.md](../research/nested-object-values.md) — reading a
  nested object's value once.
- [exact-sizing-with-loops.md](../research/exact-sizing-with-loops.md) —
  sizing a shape by a loop ahead of its result, which pays on an array of
  unions and not on an array of strings or a dictionary.
- [size-and-read-locals.md](../research/size-and-read-locals.md) — reading a
  sized write's value through its own locals, and holding a `deserialize`'s
  read state in locals.
- [hand-written-union-and-packed-bits.md](../research/hand-written-union-and-packed-bits.md)
  — the tagged union and the packed toggles against hand-written Luau.
- [packed-bits-read-in-place.md](../research/packed-bits-read-in-place.md) —
  reading each byte of a packed region once and testing its bits in place.
- [union-write-tested-once.md](../research/union-write-tested-once.md) —
  writing a union by testing each variant once.
- [variant-index-reservation.md](../research/variant-index-reservation.md) —
  reserving a variant's index with its fields, which measured as no change.
- [size-reads-tag-once.md](../research/size-reads-tag-once.md) — a tagged
  union's size reading its tag once.
- [native-on-the-package.md](../research/native-on-the-package.md) — what
  `--!native` is worth on the package's own modules.
- [datatype-values.md](../research/datatype-values.md) — reading a
  datatype's value once, which measured as no change and was withdrawn.
- [blob-channel-inline.md](../research/blob-channel-inline.md) — appending
  and reading blobs inline, in the serializer's own state.
- [blob-array-sizing.md](../research/blob-array-sizing.md) — sizing an array
  of objects that hold a blob by its count.
- [object-array-loop-sizing.md](../research/object-array-loop-sizing.md) —
  sizing an array of objects that hold a string by a loop over them.
- [string-and-dict-loops-again.md](../research/string-and-dict-loops-again.md)
  — the loop over an array of strings and over a dict, measured again and not
  kept.
- [recursion-write-cursor.md](../research/recursion-write-cursor.md) — a
  recursion helper's write cursor passed as an argument, and what the read
  state in the closure costs on a tree.
- [blob-list-length.md](../research/blob-list-length.md) — the blob list
  created at the most blobs a value appends.

This document holds what is still open.

## What

**The per-call gap to hand-written Luau.** On the flat struct, the nested
object and the `CFrame` array, surge's encode and decode are within the band
that two runs of unchanged code disagree by
([size-and-read-locals.md](../research/size-and-read-locals.md)). The gap had
a part paid once per call and a part paid per element
([generated-code-against-hand-written.md](../research/generated-code-against-hand-written.md)
and its correction), and the papers listed above measured each change that
closed it. The packed toggles are within the band on both halves
([packed-bits-read-in-place.md](../research/packed-bits-read-in-place.md)).
On the tagged union the hand-written codec encodes faster, and its decode is
within the band
([datatype-values.md](../research/datatype-values.md)); the item below is
that gap. On the instance references, too, the hand-written codec encodes
faster, and their decode is within the band
([blob-list-length.md](../research/blob-list-length.md)); the item after it
is that gap. On the leaderboard, both halves are within the band
([object-array-loop-sizing.md](../research/object-array-loop-sizing.md)),
and on the tree as well
([recursion-write-cursor.md](../research/recursion-write-cursor.md)). What the
other rows pay against hand-written Luau is not measured.

**The tagged union's write.** What is left of the gap is not attributed.
The last known difference that read a table, a `spawn` event's `item.at` read
once for each component, measured as no change when read once, and that
change was withdrawn for the locals it added
([datatype-values.md](../research/datatype-values.md)). The known
differences left are arithmetic on locals and cursor moves, and cursor moves
measured as no change
([variant-index-reservation.md](../research/variant-index-reservation.md)).

**The instance references' write.** Creating the blob list at its length
closed two thirds of what was left of the gap
([blob-list-length.md](../research/blob-list-length.md)). Two differences
remain. Each element moves the cursor for its bytes, where the hand-written
codec writes at an offset it computes from the index, and cursor moves
measured as no change elsewhere
([variant-index-reservation.md](../research/variant-index-reservation.md)).
Each element appends its blob with `table.insert`, where the hand-written
codec stores it at its index; `table.insert` is what appends nothing for an
absent blob (Wire format 6.7 in
[specs/wire-format.md](../specs/wire-format.md)), so a store at an index fits
only a blob that cannot be absent.

**What is left per call.** A shape that keeps the scratch buffer still has
the three candidates a shape sized exactly (Transformer 5.20 in
[specs/transformer.md](../specs/transformer.md)) does not:
`finishWrite`'s copy, the scratch state in the closure, and the capacity
check. A nested object inside a run of Transformer 5.5 still reads its path
once per property. A sized write reads an array's length twice, and what its
size reads inside a loop or a branch, such as an optional's or a union's
bytes, its write reads again.

One design the `finishWrite` probe did not reach: handing the caller a buffer
surge owns and reuses, which removes the allocation as well as the copy. It
would have to be an opt-in API, since a reused buffer is dead the moment
anything calls `serialize()` again, and what it is worth is unmeasured.

**Kinds exact sizing leaves out.** An array of unions, and an array of
objects whose size varies, are sized by a loop ahead of the result
(Transformer 5.20); the loop paid on both
([exact-sizing-with-loops.md](../research/exact-sizing-with-loops.md) and
[object-array-loop-sizing.md](../research/object-array-loop-sizing.md)). The
same loop measured slower than the scratch buffer over an array of strings,
twice, and over a dictionary, then as no change
([string-and-dict-loops-again.md](../research/string-and-dict-loops-again.md)),
so those keep it, and so does an array of arrays, which was not measured either
way. Why the loop pays on unions and objects and not on strings was not
probed; the number of reservations an element makes does not account for it. A
recursive type is not sized, and a walk that counts it ahead of the write cost
more than the scratch buffer on the tree
([recursion-write-cursor.md](../research/recursion-write-cursor.md)). A
sequence and a packed `CFrame` are not sized, and neither is anything that
holds one. A sequence could be sized from its keypoint count, which reads its
`Keypoints` property a second time, and what that read costs is not
measured. A packed `CFrame`'s size is in the header its runtime function
chooses, so sizing one needs a function of the package that computes the
header without writing it, and the write would then compute the header a
second time for each `CFrame`.

**Fewer reservations.** A run of consecutive fixed-size properties of one
object shares one reservation, and a nested object whose properties all have
a fixed size joins the run around it (Transformer 5.5). An array of fixed-size
elements reserves all of them at once (Transformer 5.18), and a `str` or a
`buffer` its count and its bytes (Transformer 5.19), and a union variant's
index the fixed-size bytes that start the variant (Transformer 5.25). Nothing
else shares a reservation. The places below reserve more often than the bytes require.
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
as the hand-written codec does. Each of these, and merging the reservations
of a nested object of mixed sizes, saves a few nanoseconds a call at most,
less than two runs of one build disagree by on the rows it would reach
([noise-in-the-speed-tier.md](../research/noise-in-the-speed-tier.md)), so
none can be measured with the speed tier as it is. The scratch buffer only grows, so one large
payload pins its memory for the module's lifetime. An object large enough to be emitted in
blocks is read as `const result = {}` plus one assignment per field, so its
table grows by rehashing instead of being sized once by a table constructor.
A tuple's table is created at the number of its fixed elements (Transformer
5.21), because the rest's count follows them in the bytes, so a tuple with a
rest still grows its table as the rest is stored.

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
per-call gap is closed on the flat struct, the nested object, the `CFrame`
array and the packed toggles. On the tagged union, what is left of the gap
is not attributed, and neither is what is left of it on the instance
references.
Everything else is small, or needs a fixture before anything can measure it.

## How, briefly

- Measure each change on its own, as a probe or a before-and-after pair,
  with the four untouched columns in the same run as the control. Read medians,
  not single cells: how far two runs of unchanged code differ, on a column and
  on a cell, is [noise-in-the-speed-tier.md](../research/noise-in-the-speed-tier.md).
- A golden check in `test/golden.test.mjs` for each change that lands. The
  read loop's, the tagged union's, the `CFrame`'s, the shared reservation's,
  the read table's, the blob channel's, the size's locals, the read state's,
  the packed region's, the size's tag, the blob array's count, the loop's
  boundary, the recursion helper's cursor and the blob list's length are
  there already, and so are the file pragmas on both sides.
- Predict nothing from the compiled output. Whether a cost is paid per element
  or per call was the heuristic this document used to lean on, and the blob
  channel broke it: a per-call allocation was measurable, and whether a
  per-call `buffer.copy` of two kilobytes costs anything is not settled. Which
  kind of work a change removes says more than when it happens.
- Keep a before-and-after pair within one compilation mode. The fixtures and
  the baseline carry `--!native`, so a comparison with a build that did not
  measures a change of compilation mode as well.
