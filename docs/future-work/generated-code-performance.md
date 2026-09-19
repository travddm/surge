# Future work: generated code performance and the local-register ceiling

Part of the [surge](../architecture.md) design. The performance goal is the
project's reason to exist, and nothing has measured it yet (see
[benchmark-tooling.md](benchmark-tooling.md)). This records what the
compiled output already shows, before any measurement.

## What

**Local-register ceiling (confirmed).** Risks in
[transformer.md](../transformer.md) says a flat sequence of hundreds of
`buffer.writeXX` calls "with no local declarations does not approach"
Luau's 200-locals-per-function limit. The emitter declares two locals per
field (`const [bufN, posN] = alloc(n)`), plus temporaries for strings,
optionals, arrays, dicts, and unions. Compiling the emitted pattern with
Lune's `luau.compile`: 99 fixed-size fields compile; 100 fail with
`Out of local registers when trying to allocate pos100: exceeded limit 200`
(with the `value` parameter, 100 fields need 201 registers). A struct
with about 100 numeric fields, or fewer with strings, is not
"pathologically large", and the failure is a Luau syntax error in the
user's build.

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

**Enum lookups are linear.** See [enum-encoding.md](enum-encoding.md).

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
lifetime.

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

## Why deferred

All of these are measurement-driven: the hand-written baseline in
Benchmarking strategy ([testing.md](../testing.md)) exists precisely to
show which of them matter. The local-register ceiling is the exception and
is a correctness limit, not a tuning question. Native codegen has a second
open question even once measured: making it automatic needs a way to
verify a file is safe to mark file-wide native (only surge's generated
exports, nothing else) before surge could inject the pragma itself, and no
such check exists yet.

## How, briefly

- Split large object bodies into helper functions once the projected
  local count nears the limit (the emitter knows every local it declares),
  and correct the Risks paragraph to state the real ceiling.
- Emit `for (const i of $range(1, count))`, or an equivalent roblox-ts
  numeric-loop pattern, for count-driven reads.
- Put the tag directly in the variant literal instead of spreading.
- Coalesce consecutive fixed-size fields into one `alloc`/`readAlloc`.
- Golden checks in `test/golden.test.mjs` for each: no `_shouldIncrement`,
  no `table.clone` in a tagged-union read, one `alloc` per fixed-size run.
- Document `--!native`/`//!native` as a manual opt-in in
  [documentation-gaps.md](documentation-gaps.md)'s `docs/usage.md` once
  that exists; note it here in the meantime.
- If pursued as an automatic default: design a "this file is safe to mark
  file-wide native" check (for example, restrict it to a mode where the
  whole file is one `createBinarySerializer`-style call and its export,
  nothing else) before surge injects the pragma itself, since there's no
  way to scope it to just the generated functions.
