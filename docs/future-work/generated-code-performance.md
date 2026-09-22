# Future work: generated code performance

Part of the [surge](../architecture.md) design. The performance goal is the
project's reason to exist, and the harness in
[benchmark-tooling.md](benchmark-tooling.md) has now measured it.
[benchmarks/speed.md](../benchmarks/speed.md) puts surge between 2.59× and
4.66× behind a hand-written codec that writes its exact bytes on encode, and
between 2.28× and 2.74× behind it on decode. That is the size of what this
document is about. It does not say which item below accounts for what: every
entry here is still what the compiled output shows, not what was measured one
at a time. The local-register ceiling that this document used to record has
landed; see Risks in [transformer.md](../transformer.md).

## What

**Read loops lower to a flag loop.** Every count-driven read
(`array`, `tuple` rest, `dict`, sequences) is emitted as
`for (let i = 0; i < count; i++)`, which roblox-ts lowers (see
`tests/out/tests/coverage.spec.luau`) to:

```lua
local i55 = 0
local _shouldIncrement = false
while true do
	if _shouldIncrement then i55 += 1 else _shouldIncrement = true end
	if not (i55 < count53) then break end
	...
end
```

instead of a numeric `for`. Every element read pays that branching.

**Tagged-union reads copy the object.** `readTaggedUnion` builds the
variant literal, then spreads it to add the tag, which roblox-ts lowers to
`table.clone` plus `setmetatable(_object, nil)` plus one assignment per
variant read.

**One helper call per field.** Each field, however small, calls `alloc`
or `readAlloc` and destructures a multi-return. A vector3 already shows
the alternative (`alloc(12)` once, `pos + 4`, `pos + 8`); consecutive
fixed-size fields could share one reservation the same way, which is what
Zap's emitted code does. On the read side the input buffer never changes
during a call, so a single `readAlloc(totalFixedBytes)` per
fixed-size run, or a local cursor with no helper call at all, is possible.

**Smaller items.** Strings evaluate `s.size()` twice; `finishWrite`
copies the payload (inherent to the shared scratch design); the scratch
buffer only grows, so one large payload pins its memory for the module's
lifetime. An object large enough to be emitted in blocks (the
local-register fix) is read as `const result = {}` plus one assignment per
field, so its table grows by rehashing instead of being sized once by a
table constructor.

**Native code generation (`--!native`/`//!native`).** The generated
write/read code is mostly what native codegen helps most — straight-line
`buffer.writeXX`/`readXX` calls, count-driven loops for `array`/`dict`, and
recursive helper calls — so a user adding the pragma to a file that calls
`createBinarySerializer`/`createSerializer`/`createDeserializer` today is
plausible free performance: a `//!native` comment as the first line of the
`.ts` file compiles straight through roblox-ts's ordinary comment handling
to `--!native` as line 1 of the emitted `.luau` (confirmed empirically —
it lands ahead of roblox-ts's own "Compiled with roblox-ts" banner, which
is what makes Luau actually honor it as a file pragma). surge doesn't add
it automatically: the
generated code is inlined into the call site's own file (Transformer
Design §2, "call site is transformed independently"), not emitted as a
separate module, so a file-level `--!native` would also force native
compilation of whatever unrelated code the user's file happens to contain
— a blast radius surge can't reason about or promise is safe. Luau's
narrower per-function `@native` attribute isn't reachable as a fix: it has
no `ts.factory` representation, and the transformer's only text-injection
path (a synthetic leading comment) always renders as a real `--` comment
(confirmed against `@roblox-ts/luau-ast`'s `renderComment.js` and
`renderFunctionDeclaration.js`), so `@native` would come out as an inert
`--@native` rather than a live attribute.

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

Two things follow. `--!native` is the whole effect, and on the loop shape
that matters here it is worth about 2.25× — the same order as the lead fbs
and Blink hold over surge on most rows, which is what makes the pragma the
first thing to try rather than the last. And `--!optimize 2` measured as
nothing: both of its figures straddle 1.00×, and adding it to `--!native`
changed nothing either. Whether that is because Studio already compiles at
that level, or because this code gains nothing from it, is not established
here, and a published place may differ from Studio in either direction. So
the `--!optimize 2` result is a fact about this run, not a general one.

## Why deferred

All of these are measurement-driven, and the baseline in Benchmarking
strategy ([testing.md](../testing.md)) has now given the total rather than
the parts: the figures at the head of this document. Which item accounts for
what still needs one change and one re-run each, which is the work this
document orders. Native codegen is the exception — it is measured above, and
it is the largest single number here — but it has a second open question
even so: making it automatic needs a way to
verify a file is safe to mark file-wide native (only surge's generated
exports, nothing else) before surge could inject the pragma itself, and no
such check exists yet.

## How, briefly

- Emit `for (const i of $range(1, count))`, or an equivalent roblox-ts
  numeric-loop pattern, for count-driven reads.
- Put the tag directly in the variant literal instead of spreading.
- Coalesce consecutive fixed-size fields into one `alloc`/`readAlloc`.
- Golden checks in `test/golden.test.mjs` for each: no `_shouldIncrement`,
  no `table.clone` in a tagged-union read, one `alloc` per fixed-size run.
- Document `--!native`/`//!native` as a manual opt-in in
  [documentation-gaps.md](documentation-gaps.md)'s `docs/usage.md` once
  that exists; note it here in the meantime. Leave `//!optimize 2` out of
  that documentation unless a later measurement finds something: it changed
  nothing here, alone or alongside `--!native`.
- If pursued as an automatic default: design a "this file is safe to mark
  file-wide native" check (for example, restrict it to a mode where the
  whole file is one `createBinarySerializer`-style call and its export,
  nothing else) before surge injects the pragma itself, since there's no
  way to scope it to just the generated functions.
