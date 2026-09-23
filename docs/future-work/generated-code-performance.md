# Future work: generated code performance

Part of the [surge](../architecture.md) design. The performance goal is the
project's reason to exist, and the harness in
[benchmark-tooling.md](benchmark-tooling.md) measured it. When this document
was written, [benchmarks/speed.md](../benchmarks/speed.md) put surge 2.87×
behind a hand-written codec that writes its exact bytes on encode, and 1.63×
behind it on decode, on the `CFrame` array — the one of the baseline's three
rows whose trials are quiet enough to read. That gap is what the document was
about. It is 1.08× and 1.05× now with both sides interpreted, and 1.08× and
1.06× with both compiled the way surge recommends, which is what the catalog
measures since. The baseline is still ahead on both

Eleven things were measured on their own to get there. Seven are changes that
landed: the read loop, worth nothing; the tagged-union read's table copy,
worth 1.39× on the one row that has one; a `CFrame`'s two reservations
becoming one, worth 1.61× on encode; every run of consecutive fixed-size
fields sharing one reservation, worth up to 4.70×; the blob side channel no
longer being emitted where it is unused, worth nothing; compiling every
module at optimization level 2, worth nothing and kept for parity with what a
published place runs; and reserving bytes inline in the generated code rather
than through a call into the package, worth 4.15× on encode and 2.48× on
decode across the catalog, which is the largest result here and the last of
the large ones. Four are probes that were reverted: `finishWrite` without its
copy, worth nothing; the generated code compiled natively, twice — worth 1.02×
on the catalog while every field still called into the package, and 1.10× on
decode and 1.03× on encode once the inline reservation had removed that call;
and the hand-edited probe of the inline reservation itself, which the change
that followed it replicated.

Together they say that per-element cost is what matters and per-call cost is
not, and that a cross-module call is a per-element cost wherever a shape has a
field per element — which is the one thing in this document that no optimizer
reached and the one that was worth the most. Every other entry here is still
what the compiled output shows, not what was measured. The local-register
ceiling that this document used to record has landed; see Risks in
[transformer.md](../transformer.md).

## What

**Read loops lowered to a flag loop; they lower to a numeric `for` now.**
Every count-driven read (`array`, `tuple` rest, `dict`, sequences) was
emitted as `for (let i = 0; i < count; i++)`, which roblox-ts lowers to:

```lua
local i55 = 0
local _shouldIncrement = false
while true do
	if _shouldIncrement then i55 += 1 else _shouldIncrement = true end
	if not (i55 < count53) then break end
	...
end
```

instead of a numeric `for`, so every element read paid that branching.
roblox-ts does emit a numeric `for`, but only where it can prove the bound
is an integer (`transformForStatement.js`'s `isProbablyInteger`), and a
`buffer.readu32` result is just `number`. The emitter writes
`for (const _i of $range(1, count))` instead — roblox-ts's numeric-for
macro — which lowers to `for _i55 = 1, count53 do`. No compiled file under
`tests/out` has a `_shouldIncrement` left, and `test/golden.test.mjs` pins
that.

**It was worth nothing measurable.** Two scoped speed runs, back to back on
one machine over the six rows whose decode is quiet enough to read: the run
before the change and the run after it. Only the read side changed, so
surge's encode cells and every fbs, serio, Blink, and baseline cell are the
control.

| Cell                                                 | spread | change |
| ---------------------------------------------------- | ------ | ------ |
| surge, large array, decode                           | 0.5–1% | 0.98×  |
| surge, large record, decode                          | 0.4–1% | 1.02×  |
| surge, string-heavy, decode                          | 0.6–1% | 1.00×  |
| surge, `CFrame` array, decode                        | 2–3%   | 1.02×  |
| surge, `CFrame` array (packed, axis-aligned), decode | 1–3%   | 0.99×  |
| surge, `CFrame` array (packed, arbitrary), decode    | 2%     | 1.00×  |

The controls moved 0.97× to 1.02× between the same two runs, so every cell
above is inside the drift. The large array is the strongest case the catalog
has — one decode call runs that loop a thousand times — and it did not move
either. So the flag loop is not what the read side spends its time on. The
change stays for what the emitted code says, not for what it bought.

**Tagged-union reads copied the object; they build the literal now.**
`readTaggedUnion` built the variant literal, then spread it to add the tag,
which roblox-ts lowers to `table.clone` plus `setmetatable(_object, nil)`
plus one assignment. Every variant read allocated a table and then copied
it. The tag is a property of the literal itself now, so the copy is gone.
No compiled file under `tests/out` has a `table.clone` left, and
`test/golden.test.mjs` pins that.

**It is worth 1.39× on the row it touches.** The tagged union is the only
row of the catalog with one, and it reads a hundred variants per decode
call. Measured against the run checked in at `1b1ec9f`, which is the same
catalog on the same machine with the spread still in place:

| Cell                        | spread    | change |
| --------------------------- | --------- | ------ |
| surge, tagged union, decode | 1% → 0.7% | 1.39×  |
| surge, tagged union, encode | 0.5% → 2% | 0.99×  |
| fbs, tagged union, decode   | 1% → 2%   | 0.99×  |
| serio, tagged union, decode | 2% → 0.5% | 0.99×  |
| Blink, tagged union, decode | 2% → 0.8% | 0.98×  |

6929 values per second to 9608. Only the read side changed, so surge's own
encode cell is a control, and so is every other library on the same row. The
drift between the two runs is 0.92× to 1.03× over the 76 cells that are
quiet in both, with a median of 0.99×, and every cell above but the first is
inside it. It moves the row's whole decode column: fbs read it at 0.91× of
surge's rate and read it at 0.65× after the change, 0.56× in the current
table.

Both runs are full runs, because the scoped protocol cannot read this row —
its decode trials spread by 302% measured alone and by 1% in a full run. See
the scoped-against-full entry in
[benchmark-tooling.md](benchmark-tooling.md).

**One helper call per field, until it was one per run.** Each field,
however small, called `alloc` or `readAlloc` and destructured a
multi-return. A vector3 already showed the alternative (`alloc(12)` once,
`pos + 4`, `pos + 8`), which is what Zap's emitted code does. An object's
consecutive fixed-size fields now share one reservation the same way: one
`alloc(17)` for a five-field struct rather than five, and each field after
the first taking a position local off it, which is a register move and not
a call.

Three things govern which fields may share one, because `alloc` order is
byte order — a field that reserves for itself in the middle of a run would
write its bytes after the run's, where the read side does not look:

- `fixedBytes` admits only a field that reserves a constant number of bytes
  in one piece at the start of its emission: `num`, `bool`, `vector2`,
  `vector3`, `color3`, an unpacked `cframe`, a `datatype`, `enum`,
  `literal`, and `literalConst` at zero bytes. It rejects a size known only
  at run time (`str`, `buffer`), a reservation around a branch or a loop
  (`optional`, `array`, `dict`, the sequences, both unions), one made inside
  a runtime function (a packed `cframe`) or a generated helper (`object`,
  `recursiveRef`), and a side-table entry (`blob`). A field the packed
  region answers reserves nothing and is excluded too.
- A run is at most `ALLOC_RUN_FIELDS` fields, which is one less than
  `LOCALS_PER_BLOCK`. Every field after the first reads the reservation's
  locals, so `pushScoped` cannot split a run across blocks, and a run of K
  fields declares K + 1 locals. The 50-field wide struct is therefore two
  reservations, not one.
- The run checks itself. A field that reserves more than the run has left,
  reserves a non-constant size, or leaves bytes unused throws instead of
  emitting a buffer the two sides disagree about.

Tuple elements are the same shape of thing and are not covered: no
benchmark fixture serializes a tuple, so nothing here would measure it.

**The `CFrame` was the first piece of it.**
An unpacked `CFrame` wrote its position and its rotation vector through two
`alloc(12)` calls, with `ToAxisAngle` and a `Vector3` multiply between them.
Neither of those can grow the scratch buffer, so the two reservations are
one `alloc(24)`, written at 0 and at 12, and the read side mirrors it. No
byte moves, which `bytes.spec.ts` checks, and `test/golden.test.mjs` pins
the single reservation. On the `CFrame` array row — 1000 elements per call,
so exactly one `alloc` call saved per element per half:

| Cell                                                 | spread      | change |
| ---------------------------------------------------- | ----------- | ------ |
| surge, `CFrame` array, encode                        | 0.6% → 2%   | 1.61×  |
| surge, `CFrame` array, decode                        | 2% → 3%     | 1.35×  |
| surge, `CFrame` array (packed, axis-aligned), encode | 0.8% → 0.5% | 1.01×  |
| surge, `CFrame` array (packed, arbitrary), encode    | 0.5% → 1.5% | 1.01×  |
| baseline, `CFrame` array, encode                     | 2% → 2%     | 1.00×  |
| fbs, `CFrame` array, encode                          | 4% → 3%     | 1.02×  |

Measured against the run checked in at `a4d6217`, full against full. The 79
cells quiet in both runs drift 0.99× to 1.03×, median 1.01×, and every cell
of that row but surge's own two is inside it. The two packed `CFrame` rows
are the sharpest control there is: the same fixture and the same shape, but
their encoding goes through `writePackedCFrame`, a runtime function this
does not touch, and they did not move.

It closes more of the distance to the hand-written baseline than anything
else here. That row was surge's worst against the baseline on encode, 4.62×,
and the change took it to 2.87×; on decode it went from 2.17× to 1.60×, the
closest surge had been to straight-line Luau on any row. In the current table
the flat struct is the closest, at 2.67× and 1.49×. It also takes this row's
decode past fbs, which read it at 1.08× of surge's rate and reads it at 0.81×
now.

So one `alloc` call per element is worth 1.61× on encode where the element
is 24 bytes of otherwise straight-line writes. That was the case for the
rest of the item.

**Then every run of them, which is the largest result in this document.**
Measured against the run checked in at `58c4d0f`, full against full. The 71
cells quiet in both runs drift 0.98× to 1.02×, median 1.000×, and on every
row below the fbs, serio, Blink and baseline cells sit between 0.97× and
1.05×:

| Cell                              | spread      | change |
| --------------------------------- | ----------- | ------ |
| surge, Blink: Entities, encode    | 0.8% → 1%   | 4.70×  |
| surge, wide struct, decode        | 1% → 8%     | 3.96×  |
| surge, Blink: Entities, decode    | 1% → 0.4%   | 3.01×  |
| surge, wide struct, encode        | 11% → 16%   | 2.34×  |
| surge, toggles (unpacked), encode | 4% → 5%     | 1.72×  |
| surge, toggles (unpacked), decode | 10% → 17%   | 1.51×  |
| surge, small flat struct, decode  | 17% → 16%   | 1.43×  |
| surge, small flat struct, encode  | 50% → 73%   | 1.26×  |
| surge, tagged union, encode       | 0.6% → 0.8% | 1.17×  |
| surge, tagged union, decode       | 3% → 2%     | 1.13×  |

The two `Blink: Entities` cells and the two tagged-union cells are the ones
whose trials are quiet on both sides; the rest are far enough outside the
drift band to read even at their spreads, and the two wide-struct cells are
the same change measured on a wider object. The tagged union moves because a
variant's own fields form a run.

The rows that did not move say the same thing from the other side. The large
array, the large record, the string-heavy row and the enum-heavy row are
0.99× to 1.01×: each is one field per element, a `dict`, or a string, so
none of them has two fixed-size fields in a row to share anything. The
`CFrame` array is 1.00× because the change before this one already gave it
its single reservation. The deeply nested object is 0.96× and 1.02× on
trials spanning 23% and 16%, which says nothing either way; it is one or two
fields per level.

What it costs elsewhere is worth recording. `Packed<T>` encoded 1.22× faster
than the same shape unpacked in that run, against 2.11× before, and decoded
at 0.48× against 0.72×: the packed path was not touched, and the unpacked one
got much faster. The checked-in table reads 1.22× and 0.46× two runs later.
Against fbs, surge went from behind on 14 of the 16 encode rows to behind on 10.

**The blob side channel was on every call, used or not.** Every
`serialize()` called `beginWriteBlobs()`, which is a fresh table, and
`finishWriteBlobs()`; every `deserialize()` called `beginReadBlobs()`. Not
one of the benchmark catalog's 16 rows pushes a blob, and neither does most
real code. The walker knows: the transformer emits the three entry points
only when the emitted body actually reached `pushBlob` or `nextBlob`,
including from inside a recursion helper, and returns `[] as Array<defined>`
otherwise, since `Serializer<T>` still declares the property. The
`inputBlobs` parameter stays, under a leading underscore so that nothing
reads it and a consumer's `noUnusedParameters` stays quiet.

It is worth nothing measurable, and that is the useful part. surge's 21
quiet cells moved by a median of 0.997×, between 0.968× and 1.015×, while
the untouched libraries drifted 0.96× to 1.02× with a median of 0.989×.
Three cross-module calls and a table allocation per call are not a cost this
catalog can see.

Set against the 4.70× that removing one `alloc` call _per element_ was
worth, that is the shape of the whole read/write cost: **per-call overhead
does not matter and per-element overhead does.** It is the strongest
evidence this document has for where to look next, and it settles the rest
of the per-call list, `finishWrite`'s copy included.

**`finishWrite`'s copy costs nothing, measured.** It was the one per-call
item with a reason to be different, because it scales with the payload. It
does not. A throwaway build whose `finishWrite` allocated the exact-size
result and returned it without copying — wrong, but it runs, and the copy is
write-side so only the encode half means anything — moved surge's ten quiet
encode cells by a median of 1.007×, between 0.986× and 1.025×, while the
untouched libraries' encode cells drifted 0.99× to 1.05× with a median of
1.011×. The 2004-byte large array is 1.011× of that, and the `CFrame` array
1.025×. The probe was reverted, not committed.

**What that probe does and does not rule out.** `finishWrite` is two C
calls: a `buffer.create`, which allocates, and a `buffer.copy`. The probe
kept the allocation and removed only the copy, because the caller has to be
given a buffer. So it rules out the designs that also keep the allocation —
a static-size fast path and two-pass exact sizing both end in
`buffer.create(exact)` — and it says nothing about the designs that remove
the allocation as well, which means handing the caller a buffer surge owns
and reuses. What that would be worth is unmeasured. It would have to be an
opt-in API, because a reused buffer is dead the moment anything calls
`serialize()` again.

This does not contradict the native-code-generation measurement below, which
found that adding a `buffer.create` **and** a `buffer.copy` to a natively
compiled writer collapsed its gain from 12.65× to 1.75×. Both are true, for
two reasons that compound: native code generation makes the Luau around
those two calls fast enough that they dominate what is left, and that probe
counted the allocation where this one did not.

**Smaller items.** Strings evaluate `s.size()` twice; the scratch
buffer only grows, so one large payload pins its memory for the module's
lifetime. An object large enough to be emitted in blocks (the
local-register fix) is read as `const result = {}` plus one assignment per
field, so its table grows by rehashing instead of being sized once by a
table constructor.

**Native code generation (`--!native`/`//!native`).** The generated
write/read code looks like what native code generation helps most —
straight-line `buffer.writeXX`/`readXX` calls, count-driven loops for
`array`/`dict`, and recursive helper calls. It measures otherwise, which is
the subject of the next section. Four mechanical facts come first.

**A file directive used to be inert on a transformed file. It is not now.**
A Luau hot comment is honoured anywhere ahead of the first line of code, and
not only on line 1: the parser keeps its hot-comment header flag set until the
first non-comment token (`Ast/src/Parser.cpp`). By that rule Blink's generated
module has `--!strict` on line 1 and `--!native` on line 2 with both in
effect. Comments above a directive are harmless. Code above it is not, and the
injected `local __surge_*` imports were code: a `//!native` or `//!optimize 2`
in a file that called `createBinarySerializer` landed around line 12, behind a
`local TS = require(...)`, where Luau ignores it and its linter says so —
"Comment directive is ignored because it is placed after the first non-comment
token" (`Analysis/src/Linter.cpp`). Measured on the benchmark fixtures, where
the directive had to be hoisted by hand before those modules compiled natively
at all.

The transformer moves the file's leading comments onto the import it injects
now (Transformer Design §9 in [transformer.md](../transformer.md)), so a
directive comes out on line 1, above roblox-ts's own banner.
`test/golden.test.mjs` pins that on three compiled modules of the tests place,
and the transformer's own suite pins the order a header keeps. What it
unblocks is the section below: marking a benchmark fixture native is a line of
its source now, rather than a hoist by hand in the compiled output, so the
conditional list is a measurement pass and not a manual one.

**Everything this repository compiles carries `//!optimize 2`.** That is
surge's package, the tests place, the benchmark fixtures and adapters, and the
hand-written baseline: 52 compiled modules with a directive ahead of their
first line of code and none behind it. `alloc`, `blobs`, `cframe`, and `pack`
are the four modules with hot runtime code and open with `//!native` as well.
`index` is the one module that carries neither, and cannot: roblox-ts emits a
re-export-only module as `local exports = {}` and assignments, above whatever
led the first statement, so a directive there would land after code — dead,
and a lint warning where the others are silent. Nothing runs there anyway.
`test/golden.test.mjs` pins all of it.

This is surge's own code, so neither directive has a blast radius.
`//!native` is worth nothing on the package on its own, which the next section
measures. `//!optimize 2` is not there for speed at all, which the section
after it explains.

**Neither `@native` nor typed Luau is reachable through the AST.** Luau's
narrower per-function `@native` attribute has no `ts.factory` representation,
and the transformer's only text-injection path (a synthetic leading comment)
always renders as a real `--` comment (confirmed against
`@roblox-ts/luau-ast`'s `renderComment.js` and `renderFunctionDeclaration.js`),
so `@native` would come out as an inert `--@native`. Type annotations are in
the same position: `@roblox-ts/luau-ast`'s `SyntaxKind` has forty node kinds
and not one of them is a type, so the emitter has no way to write
`local function f(buf: buffer, offset: number): number`. So is `const`, which
the AST has no form for either. What those absences cost is measured below.

**They are reachable by another route, and there is prior art for it.** A
transformer can rewrite the `.luau` file after roblox-ts has written it.
`rbxts-transform-luau` (npm, 1.0.1) does exactly that: during the transform
it reads what it needs out of the TypeScript checker and works out the output
path from `outDir` and `rootDir`, then watches the output directory and
rewrites the emitted text — prepending `--!strict` and `--!optimize N`,
hoisting a `--!` line out of the preamble to the top of it, annotating
`local function` signatures from the checker's types, promoting locals that
are never reassigned to `const`, and wrapping `TS.import` in a dead `require`
branch so that luau-lsp can infer the imported module's type. So "not
reachable" is a fact about the AST roblox-ts hands a transformer, and not
about the output. What that route would cost surge, and what it would still
have to solve, is in What native changed.

Two things about `const` in particular, since it comes up: Roblox's Luau does
parse it and Lune 0.10.5 does not, so emitting it would break the round-trip
suite this repository runs under Lune. And it measured at 1.00× against
`local`, with `--!native` and without, so nothing is lost by its absence
either way.

surge still does not put either pragma in the consumer's file. The generated
code is inlined into the call site's own file (Transformer Design §2, "call
site is transformed independently"), not emitted as a separate module, so a
file-level `--!native` would also force native compilation of whatever
unrelated code that file happens to contain — a blast radius surge cannot
reason about or promise is safe. `--!optimize 2` is the weaker case of the
two, and worth separating if this is ever reopened: it does not change what
the file means, only how well it is compiled and how readable a traceback
through it is, and it is the level that file will be compiled at in a
published place regardless. What it is not is surge's to decide for a file
surge does not own.

**What the pragmas are worth, measured.** The speed tier's first run made
this concrete, and not in surge's favour. fbs carries `--!native` and
`--!optimize 2` on the two modules its codec runs in, and Blink's generated
module carries both, where roblox-ts emits neither: two of the five columns
of [benchmarks/speed.md](../benchmarks/speed.md) were natively compiled and
three were not, so nothing in that table separated codec design from
compilation mode. How much that is worth was measured in the same
Studio build, on four modules built at run time from one source and differing
only in their first lines, over four alternating passes:

| Loop                                                               | `--!optimize 2` | `--!native` | Both   |
| ------------------------------------------------------------------ | --------------- | ----------- | ------ |
| Tight numeric `buffer` loop                                        | 1.01×           | 11.68×      | 11.65× |
| Codec-shaped: one allocation per call, table reads, a string write | 0.92×           | 2.25×       | 2.22×  |

Two things follow. `--!native` is the whole effect on a loop of that shape.
And `--!optimize 2` measured as nothing, which is what its mechanism
predicts rather than a surprise. Level 1 is the Luau compiler's own default,
the "baseline optimization level that doesn't prevent debuggability"; level 2
adds the optimizations that do harm debuggability, which are function
inlining and loop unrolling (`Compiler/include/Luau/Compiler.h`, and How we
make Luau fast). Only a local function can be inlined, and only a loop whose
bounds are known at compile time can be unrolled. surge's emitted code offers
neither: every per-field call goes into another module through `TS.import`,
and every generated loop is bounded by a count read out of the buffer at run
time.

**That null result is a reason to emit `--!optimize 2`, not a reason to leave
it out**, and the reason is not speed. A published place compiles at level 2
and Studio does not, so the directive is what makes a Studio profile a profile
of what runs live. It is why fbs's two codec modules and Blink's generated
module carry it, and it is now on everything this repository compiles, at a
measured cost of nothing.

Every number in this document and in
[benchmarks/speed.md](../benchmarks/speed.md) taken before that was a level-1
measurement of surge, serio and the baseline against a level-2 fbs, Blink and
Zap: the columns differed in optimization level as well as in native code
generation. What that was worth has now been measured on the catalog rather
than on two loops.

**Pinning level 2 cost nothing, and the split by column says why.** A full
run with every module this repository compiles at level 2, against the table
checked in through `8cdcbc5`, which is the run `9876097` recorded with none
of them. The 84 cells quiet in both runs
drift 0.97× to 1.10×, median 1.008×, and the medians of each column's quiet
cells divide like this:

| Column   | encode | decode | what changed level       |
| -------- | ------ | ------ | ------------------------ |
| fbs      | 1.000× | 1.000× | everything but its codec |
| Blink    | 1.000× | 1.000× | everything but its codec |
| serio    | 1.040× | 1.035× | everything but its codec |
| surge    | 1.004× | 1.030× | its generated code too   |
| baseline | 1.028× | 1.032× | its codec too            |

fbs and Blink do not move at all, and they are the control: their codecs were
already level 2 and only the harness and adapter around them changed. surge's
encode is the cell that matters, because that is where the generated code
does the work, and it is 1.004×. The generated code gained nothing, which is
what the mechanism says it would. What did move is a few percent on the
decode side — and serio moved by the same few percent with no codec change at
all, so that is the harness and the adapters, not a codec. The baseline has
one quiet cell per half, which makes its 1.03× the weakest row in the table.

So the directive is what it was argued to be: free, and carried for parity
with what a published place compiles rather than for speed.

**What has to be native is where the work is.** surge's generated code lives
in the consumer's file and calls into surge's package per field, so the two
sides can be marked separately. Marking only the package is worth nothing,
because its functions are a cursor bump — almost no work sits inside the
native region. A helper standing in for `alloc()`, called in a loop by a
module standing in for generated code:

| helper     | caller | time     |
| ---------- | ------ | -------- |
| plain      | plain  | 0.04233s |
| plain      | native | 0.04278s |
| **native** | plain  | 0.04253s |
| native     | native | 0.02909s |

That is not a rule about marking both sides, though. Where the native region
does hold the work, an interpreted caller costs little: a writer doing one
`alloc` and five buffer writes, called in a loop from a module that is not
native, still ran 2.27× faster than the same pair with neither marked,
against 2.60× with both. So the package pragma is a precondition for
nothing in particular. It is the generated code that would have to carry the
directive, and the package's own modules keep it only because they are
surge's code and it costs nothing to have there.

**Type annotations pay only where inference fails.** On a function whose
types Luau already infers they are worth nothing, with `--!native` (0.00382s
against 0.00385s) and without (0.05350s against 0.05384s). On surge's actual
shape they do pay, modestly: a value arriving from an untyped module, which
is what `__surge_alloc` returns through `TS.import`. All four of these carry
`--!native`, and the multiple is against the same code with no directive at
all:

|              | plain writer | typed writer |
| ------------ | ------------ | ------------ |
| plain helper | 2.50×        | 2.62×        |
| typed helper | 2.70×        | 2.72×        |

So annotating both sides is worth about 1.09× on top of `--!native`, and
nothing without it. Neither is reachable, for the AST reason above.

**What `--!native` is worth on the generated code, measured with controls.**
The emission fix made this a line of source in each fixture rather than a
hoist by hand, so this run has the controls the earlier one did not. The
twelve modules under `tests/src/bench/fixtures/` carry `//!native` and
nothing else does — not the adapters, not the harness, not
`bench/baseline/codecs.luau`. Every other library does its per-call work in
its own module or in its adapter, and a fixture module only builds its
serializers, so that marking makes surge's generated functions native and
nothing else. A full run against the table at HEAD, `25ca07c`, which is the
run `85286e1` recorded, on a throwaway build that was reverted rather than
committed: a user's file is not native, because surge does not put the
directive there, so a checked-in table of a native build would describe a
configuration nobody ships.

| Column   | encode | decode |
| -------- | ------ | ------ |
| surge    | 1.016× | 1.021× |
| fbs      | 1.006× | 1.000× |
| Blink    | 1.000× | 1.006× |
| serio    | 1.000× | 1.000× |
| baseline | 1.002× | 0.987× |

Medians of each column's quiet cells. Four columns did not move, so surge's
own 1.02× is the whole of the effect across the catalog. Where it
concentrates is one shape:

| Cell                           | spread      | change |
| ------------------------------ | ----------- | ------ |
| surge, large array, encode     | 0.6% → 2%   | 1.18×  |
| surge, `CFrame` array, decode  | 3% → 2%     | 1.10×  |
| surge, Blink: Entities, decode | 5% → 3%     | 1.08×  |
| surge, Blink: Entities, encode | 1% → 2%     | 1.05×  |
| surge, `CFrame` array, encode  | 2% → 0.9%   | 1.03×  |
| surge, large array, decode     | 0.5% → 0.5% | 1.00×  |
| surge, string-heavy, encode    | 0.7% → 0.4% | 1.00×  |

Read the small numbers in that table against what a control cell did, not
against 1.00×: individual quiet cells of the four unchanged columns moved by
as much as 1.04× on fbs and 1.09× on one serio encode row, so a surge cell
below about 1.05× is not separable from that. It is the medians that separate
the columns, and the top two rows that separate themselves.

The 1000-element array's encode is the cell that moves, at 1.18×, which is
the row the hand-hoisted run put at 1.14× — so this replicates it with the
baseline as a control rather than as a second treatment. Its decode does not
move at all. Why the two halves differ is not established here; the read side
of that row builds a thousand-entry table, which is not work native code
generation changes.

**What `--!native` is worth once the crossing is gone.** The 1.02× above was
measured on generated code that called into the package per field, and the
section below named the per-field crossing out of the native region as one of
the two readings of why it was so small. The inline reservation removed that
crossing, so the directive was measured again, the same way: `//!native` on
the twelve modules under `tests/src/bench/fixtures/` and nothing else, a full
run against the table `4afeaca` recorded, the build reverted rather than
committed. Both sides of this pair have full-precision trials, which the
earlier one did not.

| Column   | encode           | decode            |
| -------- | ---------------- | ----------------- |
| surge    | 1.028× (7 cells) | 1.099× (11 cells) |
| fbs      | 0.991×           | 0.999×            |
| serio    | 1.000×           | 1.004×            |
| Blink    | 0.993×           | 1.007×            |
| baseline | —                | 1.019× (1 cell)   |

Medians of the cells quiet in both runs. The 60 readable cells of the four
columns that did not change span 0.975× to 1.022×, median 0.999×, and that
band is what a surge cell has to clear to mean anything.

**Decode clears it everywhere.** All eleven readable decode cells are above
the band, from 1.026× to 1.225×, with no exceptions: `Blink: Entities`
1.225×, `Blink: Booleans` 1.161×, the `CFrame` array 1.147×, enum-heavy
1.137×, the tagged union 1.126×, the large array 1.095×. Against the 1.021×
the same measurement gave before the inline reservation, that is five times
the effect, and it is the first result in this document that says what the
directive is worth on code shaped the way surge emits it now.

**Encode does not.** Its median is 1.028× over seven readable cells and two of
them — both `CFrame` array halves — sit inside the control band at 0.988× and
1.008×. The guarded union at 1.100×, `Blink: Booleans` at 1.078× and
string-heavy at 1.046× are outside it, so the effect is real and small rather
than absent.

Why the two halves differ is a reading and not a finding. The read path is
what native code generation handles best and what this change left cleanest:
straight-line buffer reads and a two-instruction cursor bump, with no call in
it at all. The write path still has a capacity compare per reservation, a
`grow` on the boundary, and `finishWrite` per `serialize()` — a cross-module
call wrapping two C calls, which is exactly the shape the copy-collapse table
above shows native cannot help.

The run that took the catalog to that configuration measured the same
directive on the hand-written baseline at the same time, since both were
marked together: its one readable cell moved 1.170× on decode, against surge's
1.103×. Native is worth a little more to straight-line hand-written Luau than
to the generated code, and marking only one of the two would have put that
difference into the gap between them.

**What it does not settle.** Fourteen surge cells are too noisy to read, and
three of them carry the largest apparent gains in the run: the large array's
encode at 1.66× on trials that widened from 3.7% to 9%, the large record's at
1.61× where one side spans 60%, and the wide struct's at 1.52× where both
spans are above 75%. If any of those is real, encode's median understates the
directive. Nothing here separates them from noise.
**What that settles, and what it does not.** The section below rested on a
ratio. Every 1.00× in this document was measured against an interpreted
total, and `--!native` shrinks a Luau total by 2.25× to 11.68×, so a per-call
cost's share of it would grow. On surge's generated code the directive is
worth 1.02×, so the ratio is not there and neither is the conditional. That
much is measured.

Why it is 1.02× is not. The reading this document has argued for is that the
time goes to the call into the package per field and the two C calls per
`serialize()`, none of which native code generation compiles away — the same
reading that made removing one `alloc` call per element worth 4.70×. A second
reading fits the number equally well: native makes the straight-line writes
faster and the per-field crossing out of the native region eats the gain
back, which the helper and caller table above shows is a real effect in the
other direction. Both point at the same change, which is why the plan does
not turn on it: rolling the hot paths into the generated code is what would
tell them apart, by removing the crossing.

It also put a number on the ceiling as it stood then. On the one row of the
baseline whose trials are quiet, native generated code was still 2.80× behind
a hand-written codec that is not native on encode and 1.46× behind it on
decode, against 2.87× and 1.63× without the directive. That was about a tenth
of the decode gap, and part of the tenth was the baseline's own 0.99× drift in
the same run. What was left was structural, and it was the cross-module call:
removing that took the same two figures to 1.08× and 1.05×, with no directive
involved.
**An earlier run said the same with fewer controls.** Two runs of the speed
tier, back to back on one machine. The first marked only surge's
package native; the second marked the fixture modules and
`bench/baseline/codecs.luau` as well, so that both sides of the generated
code were native — so the baseline was a second treatment there rather than
a control, which is the difference between that pair and the run above. It
also needed the directive hoisted by hand in the compiled fixtures, which is
what the emission fix removed. fbs, serio, and Blink changed in neither run
and are its control: their medians moved 1.00×.

Medians are not the result here, because most of the fast rows are too noisy
to read. Taking only the cells whose five trials span a few percent:

| Cell                             | spread | change |
| -------------------------------- | ------ | ------ |
| surge, large array, encode       | 1–2%   | 1.14×  |
| surge, `CFrame` array, encode    | 0–4%   | 1.00×  |
| surge, string-heavy, decode      | 1%     | 1.01×  |
| baseline, `CFrame` array, encode | 4%     | 0.99×  |
| baseline, `CFrame` array, decode | 3–5%   | 1.12×  |

So the directive reaches one shape in the emitted code — the large array's
numeric loop over 1000 elements, the closest thing in the catalog to the loop
the probe measured — and leaves the rest where it found them. Over all 16
rows surge's median is 1.00× on encode and 1.01× on decode.

The baseline's other two rows moved 1.21× and 1.51× on encode, which would
be the interesting number if it could be read. Their trials span 58% to 117%,
and the same cells moved 1.27× between two earlier runs in which the baseline
did not change at all, so this run cannot separate that from noise.

The package pragma on its own, measured against the run before it, moved
surge by a median of 1.05× on encode and 1.04× on decode — inside the
1.01× to 1.04× the untouched libraries drifted between that same pair of
runs. So it is zero, as the helper and caller table predicts.

On the one row where both columns are quiet enough to compare, the
`CFrame` array, the gap to the baseline does not move: 4.58× before, 4.54×
after. Both write identical bytes, so nothing about the format is in that
difference, and the directive does not close it. Why it reaches the large
array's loop and nothing else does have an answer, below.

**Why it reaches only that row.** Every `serialize()` ends in
`finishWrite()`, which is a `buffer.create` and a `buffer.copy` — two C
calls, one of them an allocation, that native code generation cannot touch.
Adding exactly that to a writer collapses the gain, and the collapse is
worst where the call does least:

| Luau work per call | without the copy | with it |
| ------------------ | ---------------- | ------- |
| 5 buffer writes    | 12.65×           | 1.75×   |
| 50 buffer writes   | 28.20×           | 3.12×   |
| 500 buffer writes  | 40.53×           | 3.41×   |

That is the catalog's shape: the row where one call writes a thousand
elements moves, and the rows where it writes five do not. It does not account
for the whole distance down to the 1.00× the catalog showed — the per-field
call into the package, and the adapter and harness layers above it, are not
measured here. It once read as evidence that `finishWrite`'s copy was the
largest single cost in a small value's encode. It is not: removing the copy
outright measured at 1.00×, recorded above. What the collapse shows is how
little Luau work is left once native code generation has done its part, not
how much the copy costs an interpreted writer.

**The probe that decided the inline reservation.** The last large change in
this document was the call per field into the package. A probe put a number
on it before the emitter was touched, because `npm run build` runs only Rojo:
a hand edit of `tests/out` reaches the place without a recompile, so the
generated code could be rewritten into the shape the emitter would produce
and timed as it stood.

Three compiled fixtures were rewritten -- `large-array.luau`, `cframes.luau`,
and `small-flat-struct.luau`. In each, the serializer's own IIFE took the
scratch buffer, its capacity, the write cursor, the input buffer and the read
cursor as locals; every `alloc(n)` became four instructions inline -- take the
cursor, advance it, compare against the capacity, grow on the branch that is
not taken -- and every `readAlloc(n)` became two. `beginWrite()` became
`cursor = 0`, `finishWrite()` a local function, and every `buffer.writeXX`
took the closure's buffer instead of the one the call returned. Nothing else
in the place changed.

The controls are the other four columns, and, inside `cframes.luau`, the two
packed serializers. Those were left calling into the package, because
`writePackedCFrame` reserves its bytes there -- so they sit in the same module
as a rewritten serializer and did not change, which is as close a control as
this catalog has.

The rewrite was checked before it was timed. The size tier re-ran the same
three fixtures under Lune, and every byte count and every round-trip figure
matched the checked-in [benchmarks/size.md](../benchmarks/size.md), including
surge's `2e-07` on the `CFrame` rows, which is the f32 axis-angle limit the
untouched columns hit as well. The speed tier measures throughput and never
checks what a codec produced, so that check is what makes its numbers mean
anything.

Two scoped runs of the same three patterns, read against each other:

| Cell                                   | spread    | change |
| -------------------------------------- | --------- | ------ |
| surge, large array, decode             | 1% → 2%   | 2.64×  |
| surge, large array, encode             | 2% → 3%   | 2.51×  |
| surge, `CFrame` array, decode          | 3% → 2%   | 1.52×  |
| surge, `CFrame` array (packed), encode | 2% → 0.9% | 1.00×  |
| surge, `CFrame` array (packed), decode | 2% → 2%   | 0.99×  |

Every untouched cell that is quiet in both runs moved between 0.98× and
1.00×, and the two packed serializers in the rewritten file are in that band.
Two cells cannot be read at all: `small flat struct`, whose trials span 15% to
206% in both runs, and the `CFrame` array's encode, where fbs -- which was not
touched -- moved 5.59× between the two runs while Blink and the baseline held
at 0.99×. One reservation per call is what `small flat struct` has, so the
per-call control this probe would most want is the cell it does not get.

**The decode figure is the cross-module call and nothing else.** `readAlloc`
has no growth check and no `buffer.len`: it takes the read cursor, advances
it, and returns the input buffer beside it. The inline form does the first two
and drops the third. So 2.64× is what one call per element costs, with nothing
else removed alongside it. The encode figure is not that clean -- `alloc` also
calls `growTo`, which calls `buffer.len` on every reservation -- so read 2.51×
as the call plus those two, and 2.64× as the call.

Against the columns measured beside it in the same two runs:

| Row                    | against               | before | after |
| ---------------------- | --------------------- | ------ | ----- |
| large array, decode    | Blink                 | 0.34×  | 0.91× |
| large array, decode    | fbs                   | 0.98×  | 2.60× |
| large array, encode    | fbs                   | 0.37×  | 0.98× |
| large array, encode    | Blink                 | 0.19×  | 0.50× |
| `CFrame` array, decode | hand-written baseline | 0.62×  | 0.96× |
| `CFrame` array, decode | Blink                 | 0.78×  | 1.20× |

That is the gap at the head of this document. On the `CFrame` array's decode
the generated code goes from 1.62× behind a hand-written codec writing its
exact bytes to 1.04× behind it, and past Blink, whose generated module does
its cursor arithmetic inline in exactly this way.

It is not the largest single cell in this document — the shared reservation
reached 4.70× on one. It is the complement of it. That change moved the rows
with two fixed-size fields in a row to share, and left the large array, the
large record, the string-heavy row and the `CFrame` array between 0.99× and
1.01×, because each is one field per element and has nothing to share. This
one moves exactly those: what is left when a reservation cannot be shared is
the call itself.

**What the probe does not measure.** A shape with a recursion helper, a blob,
a `backpatchU32`, or a packed `CFrame` reserves inside the package, and none
of those is in the three fixtures. The probe also gave each serializer its own
scratch buffer, which is a design decision the implementation has to make
rather than inherit: at the time one module-scoped buffer served every
serializer in a place, and a buffer per serializer is a different trade in
memory and in what happens if two serializes ever overlap. Neither is measured
here. The change that followed took the per-serializer buffer, for a reason
the catalog could not have supplied: a buffer the package still owned would
go stale in a serializer's cached local as soon as another serializer grew
it. Transformer Design §4 in [transformer.md](../transformer.md) carries
that trade.

**Reserving bytes inline, measured.** The change landed in
`rbxts-transformer-surge` `7f46c81` and `surge` `91310ea`. A reservation is
four instructions in the serializer's own closure and two on the read side,
and the package owns no cursor at all: `alloc`, `readAlloc`, `beginWrite`,
`beginRead` and `backpatchU32` are gone, `grow` runs once per doubling,
`finishWrite` once per call, and the packed `CFrame` codec takes a buffer and
an offset and reports the bytes it used. Transformer Design §4 in
[transformer.md](../transformer.md) carries the design.

A full run against the table `85286e1` recorded, with that change as the only
difference. Medians of the cells whose trials are quiet in both runs:

| Column | encode          | decode           |
| ------ | --------------- | ---------------- |
| surge  | 4.15× (9 cells) | 2.48× (10 cells) |
| fbs    | 1.006×          | 0.992×           |
| serio  | 0.998×          | 0.992×           |
| Blink  | 0.996×          | 0.989×           |

Three untouched columns sat between 0.97× and 1.02× on every readable cell,
so the surge column is the whole of the effect. The baseline has one readable
cell, at 0.97×. Where it is largest is where a shape has many small fields,
which is where there were the most calls to remove:

| Cell                                   | spread      | change |
| -------------------------------------- | ----------- | ------ |
| surge, tagged union, encode            | 0.9% → 4.5% | 7.35×  |
| surge, guarded union, encode           | 0.4% → 4.4% | 6.56×  |
| surge, Blink: Booleans, encode         | 0.5% → 1.2% | 5.56×  |
| surge, string-heavy, encode            | 0.7% → 2.5% | 4.91×  |
| surge, enum-heavy, encode              | 0.7% → 2.8% | 4.15×  |
| surge, guarded union, decode           | 1.0% → 3.3% | 3.12×  |
| surge, large record, decode            | 0.8% → 0.7% | 3.03×  |
| surge, `CFrame` array, encode          | 2.0% → 0.5% | 2.67×  |
| surge, large array, decode             | 0.5% → 1.1% | 2.56×  |
| surge, large array, encode             | 0.6% → 3.7% | 2.52×  |
| surge, `CFrame` array (packed), encode | 0.5% → 1.8% | 2.60×  |
| surge, `CFrame` array (packed), decode | 1.0% → 3.3% | 2.10×  |
| surge, `CFrame` array, decode          | 3.0% → 1.7% | 1.50×  |

The two packed `CFrame` rows moved because the stateless codec dropped the two
reservations each packed `CFrame` used to make inside the package -- they were
a control in the probe and a treatment here, which is why the probe left them
alone and this run does not.

**The probe replicated.** Three cells were measured twice, once by hand on a
throwaway build and once by the emitter:

| Cell                   | probe | landed |
| ---------------------- | ----- | ------ |
| large array, encode    | 2.51× | 2.52×  |
| large array, decode    | 2.64× | 2.56×  |
| `CFrame` array, decode | 1.52× | 1.50×  |

**What it closes.** On the `CFrame` array, the one baseline row quiet in both
halves, a hand-written codec writing surge's exact bytes encoded 2.87× faster
and decoded 1.63× faster. It encodes 1.08× faster now and decodes 1.05×
faster, with both sides interpreted, which is the pair that isolates the
change. Both are real rather than noise: the trials do not overlap on either
half — 53.9k to 54.1k against 56.5k to 60.5k on encode, and 40.9k to 41.6k
against 42.2k to 43.8k on decode. The catalog has since moved to the
configuration surge recommends, `--!native` on the fixtures and on the
baseline together, where the same row reads 1.08× and 1.06× — the same gap,
moved up on both sides. The baseline is still the fastest column
on the rows it has, by a margin the harness can still see, and what changed
is its size. Against the other libraries, surge
leads fbs on 15 of 16 encode rows and all 16 decode rows, where it was behind
on 10 encode rows; and it leads Blink on 7 of the 11 decode rows they share,
where Blink led every one. Blink still leads the 1000-element array on both
halves, and `Blink: Booleans` and the small flat struct on encode.

**What it does not say.** Thirteen surge cells are too noisy to read in one
run or the other, and they are the fast ones: the small flat struct, the
deeply nested object, the wide struct, both `toggles` rows, and the large
record, whose encode came out at 33× on trials spanning 27% and 60%. A value
that encodes in a microsecond is what this harness measures worst. Nothing
here separates how much of Blink's remaining lead is `--!native`, which its
generated module carries and surge's does not.

## Why deferred

All of these are measurement-driven, and the baseline in Benchmarking
strategy ([testing.md](../testing.md)) has now given the total rather than
the parts: the figures at the head of this document. Which item accounts for
what still needs one change and one re-run each, which is the work this
document orders. Six measurements have been through it, and together they
answer the question the document was written to ask. What costs is a table
or a call **per element**: the tagged union's copy at 1.39×, one `CFrame`'s
second reservation at 1.61×, and a whole object's worth of reservations
becoming one at up to 4.70×. What costs nothing is anything per call: the
blob channel's three calls and its table at 1.00×, and `finishWrite`'s copy
at 1.00× even on a 2004-byte payload. The read loop is the third kind — a
branch per element — and it cost nothing either.

So the per-call list is closed, and the qualification it used to carry is
gone. Every one of those 1.00× results is of the form "this is invisible
against the total", which made them conditional on the total: `--!native`
shrinks the Luau part of it by 2.25× on a codec-shaped loop and 11.68× on a
tight numeric one, while leaving a C call exactly where it was. Measured on
the generated code rather than on a loop, the directive is worth 1.02×. So
the total does not shrink, the shares do not change, and the read loop, the
blob channel and `finishWrite`'s copy are what they measured as. The circular
reading that made this look unanswerable — the pragma is worth nothing partly
because of the per-call copy, and the copy measures at nothing partly because
the code is not native — resolves the other way: both are small because
neither is what the time goes to.

The per-element results do not have that problem. A call out of a native
region into a module that is not native costs more, not less, so removing
one per field is worth at least what it was measured at.

What remains, then, is the smaller items and tuple elements. Rolling the hot
paths into the generated code was the last of the large ones, and it landed:
4.15× on encode and 2.48× on decode across the catalog, which closed the gap
at the head of this document. Nothing of that size is left here. Removing a
cross-module call per field was also the one thing a compiler could not do for
us; the two directives had already been measured at 1.00× and 1.02× against
exactly that cost.
Native code generation looked like it might be the exception and is not —
measured, it is worth 1.02× on the catalog — so it removes no item from that
list and adds none. It keeps an
open question of its own if it is ever made automatic, which needs a way to
verify a file is safe to mark file-wide native (only surge's generated
exports, nothing else) before surge could inject the pragma itself, and no
such check exists.

## What native changed

Every measurement in this document was taken on interpreted code, and the
question this section used to ask was which of them survive the generated
code compiling natively. That has been measured: 1.02× across the catalog and
1.18× on one row, with every other column a control. So the answer is that
they survive, and it is the same answer in each case. Each rested on a ratio
— "X is invisible against an interpreted total, and native shrinks that total
2.25× to 11.68× while leaving X where it is" — and the ratio is not there. On
surge's generated code native code generation was worth two percent when this
section was written, and is worth 1.10× on decode and 1.03× on encode since
the inline reservation. Neither is the 2.25× to 11.68× the conditional needed,
so nothing below changes; what the code spends its time on was a call into the
package per field and two C calls per `serialize()`, and neither was an
instruction native code generation compiles.
generation compiles.

**Answered — the conditional is gone and the dismissal stands.**

- The read loop, the blob side channel, and `finishWrite`'s copy. Each
  measured 1.00× against an interpreted total. Native moves that total by two
  percent, and by ten on the decode side since the inline reservation, so each
  is 1.00× against a total that is at most a tenth smaller. There is
- The two-pass exact-sizing design that Transformer Design §4 in
  [transformer.md](../transformer.md) rejected, for one traversal of the
  value instead of two. The inversion it needed was the extra traversal
  getting 2× to 11× cheaper while the `buffer.copy` it removes stayed put.
  The traversal gets two percent cheaper.
- The package pragma, which this document records as worth nothing. The
  helper and caller table above predicts 1.47× once the caller is native as
  well — 0.04278s to 0.02909s — and the caller was native in this run. The
  catalog says 1.02×. That prediction belongs to a loop whose work sits
  inside the native region, and surge's does not.
- `Packed<T>`'s advantage over the same shape unpacked: 1.22× on encode
  before and 1.23× after. Bit packing is Luau arithmetic, and it is still not
  enough of the total to move.
- No f16, in [type-coverage-parity.md](type-coverage-parity.md). Half of that
  argument was what a branch per value costs, and a branch per value costs
  what it cost.

**Settled before this, and still settled.**

- `--!optimize 2`, which is not a performance item: it pins the level a
  published place compiles at, it measured at nothing the catalog can see,
  and everything this repository compiles carries it.
- `const` against `local`, at 1.00× with the directive and without. The
  post-emit route above could emit it, but Lune 0.10.5 cannot parse it and
  the round-trip suite runs under Lune.

**Reachable, and no longer dismissed on arithmetic.**

- Type annotations on the generated write and read functions, worth about
  1.09× on top of `--!native` — on a synthetic writer whose work sits inside
  the native region. This entry used to divide that by the 1.02× `--!native`
  was worth on the generated code and conclude the route did not pay. That
  denominator was measured before the inline reservation removed the per-field
  crossing out of the native region. Measured again after it, `--!native` is
  worth 1.10× on decode, so a ninth of that is about 1.01× — still not a
  number that pays for a pass which rewrites files roblox-ts has written, and
  now said against a current denominator rather than a stale one. The
  per-function `@native` attribute is a different case and stays open: what it
  buys is not the 1.09× of annotations but the ability to mark the generated
  functions instead of the module, which is what would make the file-shape
  recommendation unnecessary. The route is real and `rbxts-transform-luau` is
  proof of it.
  cost that was left: a cross-module call per field, and `buffer.create` plus
  `buffer.copy` per call. The first is gone — rolling the hot paths into the
  generated code removed it, at 4.15× on encode and 2.48× on decode, and native
  was never an alternative to that, because native cannot make a cross-module
  call cheaper. The second is measured at 1.00× and stays there. One inversion
  is worth keeping in view while the smaller items sit unfixed: evaluating
  `s.size()` twice is Luau work, so native makes it _less_ worth fixing — by two
  percent when this was written, and by three on the encode side it sits on now.

## How, briefly

- Reserving bytes inline has landed, and it is the pattern the rest of this
  list is measured against. What made it the largest item was that a
  cross-module call is a per-element cost wherever a shape has a field per
  element, and no directive reaches one: native code generation does not
  compile a call away, and optimization level 2 inlines only a local function,
  which a value arriving through `TS.import` is not. What made it the largest
  change was that the scratch buffer was module state the package owned. It
  moved into the closure each serializer is generated into, so the package now
  owns no cursor and the two sides cannot each have one. The three package
  functions that reserved or read through that state moved with it:
  `writePackedCFrame` and `readPackedCFrame` take a buffer and an offset and
  report the bytes they used, and `backpatchU32` is an inline
  `buffer.writeu32` into whichever buffer is current.
- Coalesce a tuple's consecutive fixed-size elements, the way an object's
  fields already are. The mechanism is `fixedBytes`, `allocRuns` and
  `withAllocRun`, unchanged; what is missing is a benchmark fixture that
  serializes a tuple, without which nothing measures it.
- A golden check in `test/golden.test.mjs` for each. The read loop's, the
  tagged union's, the `CFrame`'s, the shared reservation's and the blob
  channel's are there already, and so are the file pragmas on both sides.
- Measure each one, and predict nothing from the compiled output. Ten
  measurements have been through this document, and four of them moved a
  number: 1.39×, 1.61×, up to 4.70×, 4.15×/2.48× across the catalog, and 1.10×
  on decode for --!native once the per-field call was gone. The
  rest came back between 1.00× and 1.02×, and neither the shape of the code
  removed nor the size of the saving said in advance which would be which.
  What did, in hindsight, is whether the cost was per element or per call:
  every number above 1.02× came off a per-element cost, and every one below
  came off a per-call cost. Read only the cells whose trials span a few
  percent, and pick the protocol from the row: a scoped pair where its trials
  are quiet scoped, a full pair where they are not. Compare a full run against
  the checked-in table and not against a figure quoted in this document: the
  catalog carried `--!native` on the fixtures and the baseline from the run
  after `0b4a259`, so a comparison reaching back past it measures a change of
  compilation mode as well as whatever else moved. That is the same mistake
  the first native run made one level down, when it treated the baseline as a
  control while marking it.
- Recommend both directives as defaults, and recommend the file shape that
  makes them safe: a module holding the serializers and the types they are
  built from, and nothing else. A TypeScript type emits no Luau, and roblox-ts
  elides an import used only as a type, so such a module compiles to the
  injected `@rbxts/surge` import, one closure per serializer, and the export
  table — every line of it the code the directives are meant for. Checked
  against `tests/src/bench/fixtures/cframes.ts`, whose `import type * as
Serio`, `import type { Fixture }` and `DataType` produce nothing at all in
  the compiled `cframes.luau`. The objection this bullet used to raise against
  `//!native` — a whole file compiled natively whether the rest of it should
  be or not — is an objection about file layout, and the layout is the
  recommendation. `//!optimize 2` needs no such care and goes on every module
  a consumer writes: it is the level a published place compiles at and Studio
  does not.
- The number `docs/usage.md` should quote is 1.10× on decode and 1.03× on
  encode, not the 1.02× this document carried for one change. That figure was
  measured before the inline reservation removed the per-field crossing out of
  the native region; measured again after it, every readable decode cell
  clears the control band and the median is 1.099×. What `--!native` is worth
  on surge's generated code, in What `--!native` is worth once the crossing is
  gone, is the entry to quote.
- If surge is ever to inject `//!native` itself, the check is not "one
  serializer call and its export", which is what this bullet used to propose.
  A module may declare several serializers — three of the benchmark fixtures
  do — and may import types from anywhere, since none of that reaches the
  Luau. What a check would have to establish is that the module emits no other
  runtime code, which is a statement about what its statements compile to and
  not about how many serializers it declares.
- The narrower route is the per-function `@native` attribute, which would make
  the file shape irrelevant. It is valid before a function expression
  (`Parser::parseAttributedFunction`, no FFlag gate), so it can sit on the
  generated `serialize = function(value)` and on nothing else in the file. It
  has no `ts.factory` representation, so it needs the post-emit rewrite
  `rbxts-transform-luau` is the prior art for — and that package matches
  `local function NAME(` by name, which does not reach an anonymous function
  expression inside a table constructor. So it is a contribution there or a
  pass of surge's own, not something that works for a consumer today.
