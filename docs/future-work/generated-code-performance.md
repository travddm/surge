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

This document holds what is still open, and one recommendation that has no
other home until the user pages are written.

## What

**The per-call gap to hand-written Luau.** On the three rows the hand-written
baseline covers, surge's encode is behind a Luau codec writing the same bytes:
2.20× on the flat struct, 2.02× on the nested object, 1.22× on the fifty-element
`CFrame` array. The gap has a part paid once per call, about 0.2 µs, which is
most of it on the two small rows, and a part paid per element, which is most
of it on the `CFrame` array (the correction in
[generated-code-against-hand-written.md](../research/generated-code-against-hand-written.md)).
Two per-call costs have been measured
([per-call-overhead.md](../research/per-call-overhead.md)), and neither
explains the gap: the blob side channel is emitted only where a shape uses it,
and none of these three rows does; `finishWrite`'s copy does not grow with the
payload, and what it costs per call is not settled.

The next candidate is what the generated `serialize()` returns. The
hand-written codec creates one buffer and returns it. The generated code
writes into a scratch buffer, calls into the package for `finishWrite`, and
returns a new table `{ buffer = …, blobs = {} }` — one allocation for the
wrapper and one for the empty `blobs` array, which the transformer emits
because `Serializer<T>` declares the property. The blob probe put one table
allocation and three cross-module calls at about 26 ns, so two tables and one
call are a plausible share of 0.2 µs and not plausibly all of it. None of this
is measured.

One design the `finishWrite` probe did not reach: handing the caller a buffer
surge owns and reuses, which removes the allocation as well as the copy. It
would have to be an opt-in API, since a reused buffer is dead the moment
anything calls `serialize()` again, and what it is worth is unmeasured.

**Reopened: the package pragma.** The package's hot modules carry
`--!native`, and this was recorded as worth nothing, because marking only the
package moves almost no work into the native region — its functions were a
cursor bump. A helper standing in for `alloc()`, called in a loop by a module
standing in for generated code:

| helper     | caller | time     |
| ---------- | ------ | -------- |
| plain      | plain  | 0.04233s |
| plain      | native | 0.04278s |
| **native** | plain  | 0.04253s |
| native     | native | 0.02909s |

That predicts 1.47× once the caller is native as well. The prediction was set
aside because surge's generated work did not sit inside the native region.
Since the inline reservation it largely does, and the catalog now measures
native on the generated code at 1.335× on encode, most of the way to the
prediction. The entry needs re-arguing against the current figure. The loop
timings above are from before the speed suite yielded, and this loop
allocates nothing, so the slow mode had nothing to act on.

**Reopened: the read loop.** Count-driven reads (`array`, `tuple` rest,
`dict`, sequences) are emitted as `for (const _i of $range(1, count))`, which
roblox-ts lowers to a numeric `for`, instead of a C-style loop it lowers to a
`while` with a `_shouldIncrement` flag; `test/golden.test.mjs` pins that no
compiled file has the flag. It measured at 0.98× to 1.02× on the six decode
rows quiet enough to read, on a scoped pair taken before the suite yielded and
with the fixtures compiled interpreted. Neither condition holds now, and it
was not measured again. The change stays for what the emitted code says,
whatever it is worth.

**Tuple elements.** Coalesce a tuple's consecutive fixed-size elements into
one reservation, the way an object's fields already are. The mechanism is
`fixedBytes`, `allocRuns` and `withAllocRun`, unchanged; what is missing is a
benchmark fixture that serializes a tuple, without which nothing measures it.

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
  synthetic writer and helper was worth about 1.09× on top of `--!native`, and
  nothing without it. Against the 1.180× native is worth on decode, a ninth of
  that is about 1.02× — not a number that pays for a pass which rewrites files
  roblox-ts has written.
- **`const`** measured at 1.00× against `local`, with the directive and
  without, and Lune 0.10.5 cannot parse it, so emitting it would break the
  round-trip suite. Nothing is lost by its absence.

## The file-directive recommendation

Nothing outside this directory tells a consumer how to mark a module that
holds generated serializers, and a research paper never advises, so the
recommendation lives here until `performance.md` is written
([documentation-restructure.md](documentation-restructure.md)).

Recommend both directives as defaults, and recommend the file shape that makes
them safe: a module holding the serializers and the types they are built
from, and nothing else. A TypeScript type emits no Luau, and roblox-ts elides
an import used only as a type, so such a module compiles to the injected
`@rbxts/surge` import, one closure per serializer, and the export table —
every line of it the code the directives are meant for. Checked against
`tests/src/bench/fixtures/cframes.ts`, whose `import type * as Serio`,
`import type { Fixture }` and `DataType` produce nothing at all in the
compiled `cframes.luau`. The objection to `//!native` — a whole file compiled
natively whether the rest of it should be or not — is an objection about file
layout, and the layout is the recommendation. `//!optimize 2` needs no such
care and goes on every module a consumer writes. Roblox documents level 1 as
the default in Studio testing and level 2 as the default in live games
([Luau comments](https://create.roblox.com/docs/luau/comments)), so pinning 2
makes a profile taken in Studio a profile of what a published place runs.

What the directives are worth on the generated code, which is the number to
quote with the recommendation, is in
[file-directives-on-generated-code.md](../research/file-directives-on-generated-code.md).

surge does not put either directive in the consumer's file. The generated code
is inlined into the call site's own file (Transformer 5.1 in
[specs/transformer.md](../specs/transformer.md)), so a file-level `--!native` would also compile
whatever unrelated code that file holds — a blast radius surge cannot reason
about. If surge is ever to inject it, the check is not "one serializer call
and its export": a module may declare several serializers, three of the
benchmark fixtures do, and may import types from anywhere, since none of that
reaches the Luau. What a check would have to establish is that the module
emits no other runtime code, which is a statement about what its statements
compile to and not about how many serializers it declares. `--!optimize 2` is
the weaker case — it changes how well a file is compiled and not what it
means — but it is still not surge's to decide for a file surge does not own.

## Why deferred

Every item here is measurement-driven, and the method is settled: a change is
its own full catalog run against a reference taken in the same session, read
as medians over many cells against the untouched libraries as controls. The
per-call gap is the largest open item, and its next measurement is named. The
two reopened entries need an argument against a current figure, not a change.
The rest is small, or needs a fixture before anything can measure it.

## How, briefly

- Measure each change on its own, as a probe or a before-and-after pair,
  with the four untouched columns in the same run as the control. Two runs of
  unchanged code agree to about 3% on a column median and differ by up to a
  quarter on a single cell, so read medians; a single cell below about 1.3× is
  not readable from one pair.
- A golden check in `test/golden.test.mjs` for each change that lands. The
  read loop's, the tagged union's, the `CFrame`'s, the shared reservation's
  and the blob channel's are there already, and so are the file pragmas on
  both sides.
- Predict nothing from the compiled output. Whether a cost is paid per element
  or per call was the heuristic this document used to lean on, and the blob
  channel broke it: a per-call cost is measurable when the work is an
  allocation, and a per-call `buffer.copy` of two kilobytes is not. Which
  kind of work a change removes says more than when it happens.
- Keep a before-and-after pair within one compilation mode. The fixtures and
  the baseline carry `--!native` from surge `afde7bc` on, so a comparison
  reaching back past it measures a change of compilation mode as well.
