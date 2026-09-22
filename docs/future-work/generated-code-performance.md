# Future work: generated code performance

Part of the [surge](../architecture.md) design. The performance goal is the
project's reason to exist, and the harness in
[benchmark-tooling.md](benchmark-tooling.md) has now measured it.
[benchmarks/speed.md](../benchmarks/speed.md) puts surge between 2.87× and
3.29× behind a hand-written codec that writes its exact bytes on encode, and
between 1.60× and 2.65× behind it on decode. That is the size of what this
document is about. It does not say which item below accounts for what.
Three changes have since been measured on their own — the read loop, worth
nothing; the tagged-union read's table copy, worth 1.39× on the one row that
has one; and a `CFrame`'s two reservations becoming one, worth 1.61× on
encode and 1.35× on decode on the row that reads a thousand of them — and
every other entry here is still what the compiled output shows, not what was
measured. The local-register ceiling that this
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

**One helper call per field.** Each field, however small, calls `alloc`
or `readAlloc` and destructures a multi-return. A vector3 already shows
the alternative (`alloc(12)` once, `pos + 4`, `pos + 8`); consecutive
fixed-size fields could share one reservation the same way, which is what
Zap's emitted code does. On the read side the input buffer never changes
during a call, so a single `readAlloc(totalFixedBytes)` per
fixed-size run, or a local cursor with no helper call at all, is possible.

**One `CFrame` does now, and it is the largest result in this document.**
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
is 24 bytes of otherwise straight-line writes. That is the case for the rest
of this item, which is still open: the wide struct reserves twenty times per
call and the flat struct five, each for a handful of bytes.

**Smaller items.** Strings evaluate `s.size()` twice; `finishWrite`
copies the payload (inherent to the shared scratch design); the scratch
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
measured here — but the per-call copy is the largest part of it. Which makes
`finishWrite`'s copy, filed under Smaller items above, the first thing to
measure a change against, not the native list.

## Why deferred

All of these are measurement-driven, and the baseline in Benchmarking
strategy ([testing.md](../testing.md)) has now given the total rather than
the parts: the figures at the head of this document. Which item accounts for
what still needs one change and one re-run each, which is the work this
document orders. Three changes have been through it, and together they say
where the time goes. The read loop came back at 1.00×: a thousand iterations
of the flag loop cost nothing readable, so it is not branching. The tagged
union's table copy came back at 1.39×, and one `CFrame`'s second reservation
at 1.61× on encode. It is the tables and the helper calls each element pays
for, which is what the rest of the one-call-per-field item is about and why
it is what remains worth doing first. Native code generation looked like
the exception and is not either: measured, it reaches one row of the emitted
code and leaves the rest, so it removes no item from that list. It keeps an
open question of its own if it is ever made automatic, which needs a way to
verify a file is safe to mark file-wide native (only surge's generated
exports, nothing else) before surge could inject the pragma itself, and no
such check exists.

## How, briefly

- Coalesce consecutive fixed-size fields into one `alloc`/`readAlloc`. The
  `CFrame` case landed on its own, for 1.61× on encode, and is the evidence
  that the rest is worth the machinery. A run of fields is harder than one
  field's two halves: `alloc` order is byte order, so a run cannot span a
  variable-size reservation, a runtime helper that allocates
  (`writePackedCFrame`, a recursion helper), or a nested statement list.
- Measure a `finishWrite` that does not copy. On the numbers above it is the
  largest single cost in a small value's encode, which was not obvious when
  it was filed as a smaller item.
- A golden check in `test/golden.test.mjs` for each: one `alloc` per
  fixed-size run. The read loop's, the tagged union's, and the `CFrame`'s
  are there already.
- Measure each one, and predict nothing from the compiled output. The three
  measured so far came back at 1.00×, 1.39× and 1.61×, and neither the shape
  of the code removed nor the size of the saving said which would be which.
  Read only the cells whose trials span a few percent, and pick the protocol
  from the row: a scoped pair where its trials are quiet scoped, a full pair
  where they are not.
- Emit file directives ahead of the injected `__surge_*` imports, so that
  a `//!native` on a file that calls `createBinarySerializer` is honoured at
  all. Nothing below can be put to a user until this is fixed.
- Do not document `--!native`/`//!native` as a manual opt-in yet. On this
  measurement it reaches one row of the emitted code, so the advice would
  cost a user the blast radius and return almost nothing. Revisit once the
  items above land and the shape changes. Leave `//!optimize 2` out either way: it
  changed nothing here, alone or alongside `--!native`.
- If pursued as an automatic default: design a "this file is safe to mark
  file-wide native" check (for example, restrict it to a mode where the
  whole file is one `createBinarySerializer`-style call and its export,
  nothing else) before surge injects the pragma itself, since there's no
  way to scope it to just the generated functions.
