# Future work: generated code performance

Part of the [surge](../architecture.md) design. The performance goal is the
project's reason to exist, and the harness in
[benchmark-tooling.md](benchmark-tooling.md) has now measured it.
[benchmarks/speed.md](../benchmarks/speed.md) puts surge between 2.12× and
2.82× behind a hand-written codec that writes its exact bytes on encode, and
between 1.51× and 2.40× behind it on decode. That is the size of what this
document is about. It does not say which item below accounts for what.
Six things have since been measured on their own. Five are changes that
landed: the read loop, worth nothing; the tagged-union read's table copy,
worth 1.39× on the one row that has one; a `CFrame`'s two reservations
becoming one, worth 1.61× on encode; every run of consecutive fixed-size
fields sharing one reservation, worth up to 4.70×; and the blob side channel
no longer being emitted where it is unused, worth nothing. The sixth is a
probe that was reverted: `finishWrite` without its copy, also worth nothing.
Together they say that per-element cost is what matters and per-call cost is
not. Every other entry here is still what the
compiled output shows, not what was measured. The local-register ceiling that this
document used to record has landed; see Risks in
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
surge's rate and reads it at 0.65× now.

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
and is now its best at 2.87×; on decode it went from 2.17× to 1.60×, which
is the closest surge has been to straight-line Luau on any row. It also
takes the row's decode past fbs, which read it at 1.08× of surge's rate and
reads it at 0.81× now.

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

What it costs elsewhere is worth recording. `Packed<T>` now encodes 1.22×
faster than the same shape unpacked, against 2.11× before, and decodes at
0.48× against 0.75×: the packed path was not touched, and the unpacked one
got much faster. Against fbs, surge went from behind on 14 of the 16 encode
rows to behind on 10.

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
the subject of the next section. Three mechanical facts come first.

**A `//!native` on a transformed file is inert today.** The comment does
reach the emitted Luau as `--!native` on line 1, ahead of roblox-ts's own
"Compiled with roblox-ts" banner, which is what makes Luau honour it as a
file pragma — but only in a file this transformer leaves alone. In a file
that calls `createBinarySerializer`, the injected `local __surge_*` imports
are emitted above it and the directive lands around line 12, where Luau
ignores it. Measured on the benchmark fixtures, where it had to be hoisted
by hand before those modules compiled natively at all. That is a defect in
the emission, not a property of the pragma, and it has to be fixed before
any of this can be put to a user.

**surge's own package carries it.** `alloc`, `blobs`, `cframe`, and `pack`
are the four modules with hot runtime code, and each has `//!native` as its
first line; `data-type`, `serializer`, and `index` do not, having none. That
is surge's own code, so it has no blast radius — and on its own it is worth
nothing, which the next section measures.

**Neither `@native` nor typed Luau is reachable.** Luau's narrower
per-function `@native` attribute has no `ts.factory` representation, and the
transformer's only text-injection path (a synthetic leading comment) always
renders as a real `--` comment (confirmed against `@roblox-ts/luau-ast`'s
`renderComment.js` and `renderFunctionDeclaration.js`), so `@native` would
come out as an inert `--@native`. Type annotations are not reachable either:
`@roblox-ts/luau-ast`'s `SyntaxKind` has forty node kinds and not one of them
is a type, so the emitter has no way to write
`local function f(buf: buffer, offset: number): number`. What those absences
cost is measured below.

Nor is `const`, for the same reason — the AST has `VariableDeclaration` and
nothing else. Two things about it, since it comes up: Roblox's Luau does
parse `const`, and Lune 0.10.5 does not, so emitting it would break the
round-trip suite this repository runs under Lune. And it measured at 1.00×
against `local`, with `--!native` and without, so nothing is lost by the
absence.

surge still does not put the pragma in the consumer's file. The generated
code is inlined into the call site's own file (Transformer Design §2, "call
site is transformed independently"), not emitted as a separate module, so a
file-level `--!native` would also force native compilation of whatever
unrelated code that file happens to contain — a blast radius surge cannot
reason about or promise is safe.

**What the pragmas are worth, measured.** The speed tier's first run made
this concrete, and not in surge's favour. fbs carries `--!native` and
`--!optimize 2` on the two modules its codec runs in, and Blink's generated
module carries both, where roblox-ts emits neither: two of the five columns
of [benchmarks/speed.md](../benchmarks/speed.md) are natively compiled and
three are not, which is why that file opens by saying its columns are not a
comparison of codec design. How much that is worth was measured in the same
Studio build, on four modules built at run time from one source and differing
only in their first lines, over four alternating passes:

| Loop                                                               | `--!optimize 2` | `--!native` | Both   |
| ------------------------------------------------------------------ | --------------- | ----------- | ------ |
| Tight numeric `buffer` loop                                        | 1.01×           | 11.68×      | 11.65× |
| Codec-shaped: one allocation per call, table reads, a string write | 0.92×           | 2.25×       | 2.22×  |

Two things follow. `--!native` is the whole effect on a loop of that shape.
And `--!optimize 2` measured as nothing: both of its figures straddle 1.00×,
and adding it to `--!native` changed nothing either. Whether that is because
Studio already compiles at that level, or because this code gains nothing
from it, is not established here, and a published place may differ from
Studio in either direction. So the `--!optimize 2` result is a fact about
this run, not a general one.

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

**On the catalog, the pragma reaches one row of the emitted code.** Two runs
of the speed tier, back to back on one machine. The first marked only surge's
package native; the second marked the fixture modules and
`bench/baseline/codecs.luau` as well, so that both sides of the generated
code were native. Reproducing the second needs the directive hoisted by hand
in the compiled fixtures, for the reason above, so no task repeats it today.
fbs, serio, and Blink changed in neither run and are the control: their
medians moved 1.00×.

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

So the per-call list is closed **for interpreted code**, and that
qualification is the whole of what is left to say about it. Every one of
these 1.00× results is of the form "this is invisible against the total",
and `--!native` shrinks the Luau part of that total by 2.25× on a
codec-shaped loop and 11.68× on a tight numeric one while leaving a C call
exactly where it was. The table below is that effect measured directly: the
same two calls go from invisible to dominant. So the read loop, the blob
channel and `finishWrite` all have to be measured again if the generated
code ever compiles natively, and the order matters — the pragma is worth
nothing on surge's emitted code today partly because of the per-call copy,
and the copy measures at nothing partly because the code is not native.
Neither reading is wrong; they are one number seen twice. The emission fix
below is what breaks the loop, and nothing on this list should be called
settled under native until it lands.

The per-element results do not have that problem. A call out of a native
region into a module that is not native costs more, not less, so removing
one per field is worth at least what it was measured at.

What remains, then, is the smaller items, the emission fix, and tuple
elements, none of which is a fifth item of the size of the fourth. Native
code generation looked like
the exception and is not either: measured, it reaches one row of the emitted
code and leaves the rest, so it removes no item from that list. It keeps an
open question of its own if it is ever made automatic, which needs a way to
verify a file is safe to mark file-wide native (only surge's generated
exports, nothing else) before surge could inject the pragma itself, and no
such check exists.

## What native would change

Every measurement in this document was taken on interpreted code, because
that is what roblox-ts emits and what a `//!native` cannot reach today. Some
of the conclusions survive that and some do not, and the difference is
mechanical: `--!native` makes Luau work 2.25× to 11.68× cheaper and leaves a
C call, a cross-module call, and an allocation exactly where they were. A
result that says "X is invisible against the total" is a result about that
ratio, not about X.

Three groups, and the emission fix below is what makes the first of them
answerable.

**Conditional — re-measure once generated code compiles natively.** Each of
these rests on a measured 1.00× against an interpreted total.

- The read loop, the blob side channel, and `finishWrite`'s copy. All three
  landed or were probed at 1.00×; all three are per-call or per-branch costs
  that native code generation cannot make cheaper while it makes everything
  around them cheaper.
- The two-pass exact-sizing design that Transformer Design §4 in
  [transformer.md](../transformer.md) rejected, for one traversal of the
  value instead of two. Native inverts that trade: the extra traversal is
  Luau work that gets 2× to 11× cheaper, while the `buffer.copy` it removes
  is a C call that does not. It is the clearest case in this list.
- The package pragma, which this document records as worth nothing. That is
  true of the configuration it was measured in and not of the one that
  follows. The helper and caller table above has all four cells: marking
  only the package is 0.04253s against 0.04233s, but once the caller is
  native, marking the package as well takes 0.04278s to 0.02909s — 1.47×.
  Nothing to do about it, since all four hot modules already carry the
  directive, but "worth nothing" is not what it will mean.
- `Packed<T>`'s advantage over the same shape unpacked, which
  [benchmark-tooling.md](benchmark-tooling.md) records as 1.24× on encode.
  It was 2.11× before the shared-reservation change, purely because the
  unpacked path got faster. Bit packing is Luau arithmetic, so native moves
  it again; which way is not worth guessing.
- No f16, in [type-coverage-parity.md](type-coverage-parity.md). Half of
  that argument is design — a software conversion with a branch per value is
  the opposite of flat generated code — and half is what the branching
  costs. Native only touches the second half.

**Settled — already measured with `--!native`, and still dismissed.**

- `--!optimize 2`. Measured alone and alongside `--!native`, both straddling
  1.00×. Its result is a fact about that run rather than a general one, but
  it is not a fact about interpreted code.
- `const` against `local`. Measured at 1.00× with the directive and without,
  and unreachable besides.

**Blocked on reachability, not on value, and the value is native-only.**

- Type annotations on the generated write and read functions, worth about
  1.09× on top of `--!native` and nothing without it. They are dismissed
  because `@roblox-ts/luau-ast` has no type node to emit, not because they
  were measured as worthless — so if generated code ever compiles natively,
  the right move is to reopen the reachability problem (a roblox-ts change,
  or a text-injection path the emitter does not have today) rather than to
  re-measure. The same is true of the per-function `@native` attribute.

One inversion runs the other way, and is worth stating so it is not filed
with the rest: the smaller items on this list are Luau work, not calls.
Evaluating `s.size()` twice for a string gets _less_ worth fixing under
native, not more.

## How, briefly

- Emit file directives ahead of the injected `__surge_*` imports, first,
  and not only because a `//!native` on a file that calls
  `createBinarySerializer` is silently inert until it is. It is also what
  makes the section above answerable: the benchmark fixtures had to have
  the directive hoisted by hand before they compiled natively at all, which
  is why no task repeats that run today. With the emission fixed, marking a
  fixture native is a line of source, and the conditional list becomes a
  measurement pass rather than a manual one.
- Coalesce a tuple's consecutive fixed-size elements, the way an object's
  fields already are. The mechanism is `fixedBytes`, `allocRuns` and
  `withAllocRun`, unchanged; what is missing is a benchmark fixture that
  serializes a tuple, without which nothing measures it.
- A golden check in `test/golden.test.mjs` for each. The read loop's, the
  tagged union's, the `CFrame`'s and the shared reservation's are there
  already.
- Measure each one, and predict nothing from the compiled output. The five
  measured so far came back at 1.00×, 1.39×, 1.61×, 4.70× and 1.00×, and
  neither the shape of the code removed nor the size of the saving said
  which would be which. What did, in hindsight, is whether the cost was per
  element or per call.
  Read only the cells whose trials span a few percent, and pick the protocol
  from the row: a scoped pair where its trials are quiet scoped, a full pair
  where they are not.
- Do not document `--!native`/`//!native` as a manual opt-in until the
  emission fix has landed and the conditional list has been re-measured
  through it. On the current measurement the directive reaches one row of
  the emitted code, so the advice would cost a user the blast radius and
  return almost nothing; what it is worth afterwards is the open question.
  Leave `//!optimize 2` out either way: it changed nothing here, alone or
  alongside `--!native`.
- If pursued as an automatic default: design a "this file is safe to mark
  file-wide native" check (for example, restrict it to a mode where the
  whole file is one `createBinarySerializer`-style call and its export,
  nothing else) before surge injects the pragma itself, since there's no
  way to scope it to just the generated functions.
