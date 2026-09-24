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

This document holds what is still open.

## What

**The per-call gap to hand-written Luau.** On the three rows the hand-written
baseline covers, surge's encode is behind a Luau codec writing the same bytes.
The gap has a part paid once per call, which is most of it on the flat struct
and the nested object, and a part paid per element, which is most of it on
the fifty-element `CFrame` array
([generated-code-against-hand-written.md](../research/generated-code-against-hand-written.md)
and its correction).
Most of the per-call part is three tables
([tables-around-serialize.md](../research/tables-around-serialize.md)): the
wrapper and the empty `blobs` array the generated `serialize()` returns, and
the payload table the benchmark's surge adapter builds and the baseline's does
not. Calling `finishWrite` instead of inlining it costs nothing measurable.
With all three tables gone, a small part of the per-call gap is left.

**What `serialize()` returns.** A decision before it is a change: its two
tables are the largest per-call cost left in the generated code, and each way
to remove them changes what a caller gets. Both are free before the first
release.

- Keep `{ buffer, blobs }` and stop creating `blobs` per call: one empty array
  per serializer or per package, frozen, since every later call would return
  the same array. Worth the cheaper of the two tables (probe A, which shared
  an array it did not freeze). `Serializer<T>` keeps the shape fbs declares.
- Return no table: the buffer alone where the shape has no blob field, or the
  buffer and the blob array as two return values. Worth both tables (probe D),
  and changes the shape `Serializer<T>` shares with fbs, which a user replacing
  fbs relies on.

**What is left per call.** What remains once the three tables are gone
(probe E) was not probed. The candidates in the code are `finishWrite`'s
copy, the reads and writes of the scratch state in the closure, and the
capacity check. Exact sizing, below, removes the copy and the check together.

One design the `finishWrite` probe did not reach: handing the caller a buffer
surge owns and reuses, which removes the allocation as well as the copy. It
would have to be an opt-in API, since a reused buffer is dead the moment
anything calls `serialize()` again, and what it is worth is unmeasured.

The copy itself was chosen over two-pass exact sizing: a `size(value)`
function generated per shape, called first, and a write into a buffer of
exactly that size with no copy. The copy needs one traversal of the value and
two-pass sizing needs two. Whether a second traversal could cost less than the
copy is open: the copy does not grow with the payload, and what it costs per
call is not settled
([per-call-overhead.md](../research/per-call-overhead.md) and its
correction).

Not every shape needs a second traversal to be sized. The hand-written
baseline (`tests/src/bench/baseline/codecs.luau`) computes its buffer's size
from the value before it writes, and has no scratch buffer, no capacity check
and no copy. The size is a constant for the flat struct, the fixed bytes plus
each string's length for the nested object, and the count times the element
size for the `CFrame` array. The `Field` tree gives the transformer the same
terms at compile time. Only a loop over elements of varying size, such as an
array of strings or a `dict`, needs a traversal to be sized. An `optional` or
a union adds its branch to the sizing, which evaluates the branch's test
twice. Any other shape could be sized from a constant and the lengths and
counts it reads anyway, then written into one `buffer.create` of that size.
That removes every capacity check and the call to `finishWrite` with its copy.
The allocation stays, because the caller gets a buffer of its own. A shape
with such a loop keeps the scratch buffer. None of this is measured.

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
`dict`, sequences) are emitted as `for (const _i of $range(1, count))`, which
roblox-ts lowers to a numeric `for`, instead of a C-style loop it lowers to a
`while` with a `_shouldIncrement` flag; `test/golden.test.mjs` pins that no
compiled file has the flag. It measured as no change on the decode rows quiet
enough to read, on a scoped pair taken before the suite yielded and with the
fixtures compiled interpreted. Neither condition holds now, and it was not
measured again. The change stays for what the emitted code says,
whatever it is worth.

**Fewer reservations.** A run of consecutive fixed-size properties of one
object shares one reservation (Transformer 5.5), and nothing else does. The
places below reserve more often than the bytes require. Merging reservations
changes no byte, because reservation order is byte order either way. A shape
whose reservations all merge makes one reservation per call, which is where
the exact sizing above starts.

- **Across a nested object.** `fixedBytes` has no case for an `object`, so a
  run ends at a nested object even when every field inside it has a fixed
  size. The deeply nested object reserves eight times per call, and the
  hand-written codec for the same bytes allocates once. The run's cap of 31
  properties keeps it inside one block of Transformer 5.8, so the cap would
  count the nested fields too.
- **A string's count and bytes.** A `str` or a `buffer` reserves its count
  and then its bytes: two reservations where one of the count's width plus
  the length would do.
- **An array of fixed-size elements.** Each element reserves inside the loop,
  so `Blink: Entities` checks capacity once per element. One reservation of
  the count times the element's size, before the loop, covers every element.
  With `checks`, the count bound (Runtime API 4.3 in
  [specs/runtime-api.md](../specs/runtime-api.md)) is exact for such an
  element, so the per-element read bounds repeat it.
- **Tuple elements.** Coalesce a tuple's consecutive fixed-size elements into
  one reservation, the way an object's fields already are. The mechanism is
  `fixedBytes`, `allocRuns` and `withAllocRun`, unchanged; what is missing is
  a benchmark fixture that serializes a tuple, without which nothing measures
  it.

**Smaller items.** Strings evaluate `s.size()` twice. The scratch buffer only
grows, so one large payload pins its memory for the module's lifetime. An
object large enough to be emitted in blocks is read as `const result = {}`
plus one assignment per field, so its table grows by rehashing instead of
being sized once by a table constructor.

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
per-call gap is the largest open item. Most of it is measured, and what
`serialize()` returns waits on the decision above. The two reopened entries
need an argument against a current figure, not a change. The rest is small,
or needs a fixture before anything can measure it.

## How, briefly

- Measure each change on its own, as a probe or a before-and-after pair,
  with the four untouched columns in the same run as the control. Read medians,
  not single cells: how far two runs of unchanged code differ, on a column and
  on a cell, is [noise-in-the-speed-tier.md](../research/noise-in-the-speed-tier.md).
- A golden check in `test/golden.test.mjs` for each change that lands. The
  read loop's, the tagged union's, the `CFrame`'s, the shared reservation's
  and the blob channel's are there already, and so are the file pragmas on
  both sides.
- Predict nothing from the compiled output. Whether a cost is paid per element
  or per call was the heuristic this document used to lean on, and the blob
  channel broke it: a per-call allocation was measurable, and whether a
  per-call `buffer.copy` of two kilobytes costs anything is not settled. Which
  kind of work a change removes says more than when it happens.
- Keep a before-and-after pair within one compilation mode. The fixtures and
  the baseline carry `--!native`, so a comparison with a build that did not
  measures a change of compilation mode as well.
