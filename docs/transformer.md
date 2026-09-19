# rbxts-transformer-surge: design

Part of the [surge](architecture.md) design. This is the `transformer/`
package: the TS transformer that walks a type and emits specialized
serialize/deserialize code for it at compile time. It has no runtime code
of its own — see [serde.md](serde.md) for the package its generated code
calls into.

## Why fbs is slower: confirmed root cause

Read directly from fbs's `src/serialization/createSerializer.ts` and
`createDeserializer.ts`: every `serialize()`/`deserialize()` call is one
recursive function with an `if/elseif` chain dispatching on a `meta[0]`
"kind" string (`"f32"`, `"object"`, `"array"`, `"union"`, …), walking a
metadata tree that Flamework's `@metadata` macro captured from `T` and
embedded as a data literal at compile time. Every field, on every call,
pays a linear string-compare cascade plus a recursive call into the same
interpreter for nested shapes.

fbs also pays a second, separate cost at module-load time:
`processSerializerData.ts` runs a full preprocessing pass over the
metadata literal for every `createBinarySerializer<T>()` call site —
flattening `object_raw` into `object`, computing union/literal byte widths,
and building each referenced enum's sorted-item table
(`Enum[name]:GetEnumItems()`, sorted). This is a real, if one-time, cost
our design has no equivalent of: all of this resolves into the generated
code directly at TS-compile time, so there is nothing left to compute when
a Luau module using the generated serializer loads.

Zap's Rust codegen (`zap/src/irgen/ser.rs`, `mod.rs`, confirmed by reading
source on the `0.6.x` branch) avoids the runtime-dispatch cost differently
than initially expected: its buffer/cursor strategy (`alloc(n)` growing a
shared buffer, writing at a running cursor) is essentially the same
mechanism fbs already uses — **that is not the differentiator**. The
actual difference is that Zap's IR generator (`push_struct`, `push_ty`)
walks the schema once, at `.zap`-compile time, in Rust, and emits a flat,
fully inlined sequence of Luau statements per shape — one
`buffer.writeXX(...)` call per field, in source order, with **no runtime
type dispatch and no recursive call into a shared generic serializer**.
Nested structs are inlined by Rust-side recursion into more flat
statements in the same function, not a Luau function call.

So the entire perf gap comes down to: **resolve "what to read/write and in
what order" once, at schema-compile time, instead of on every
serialize/deserialize call, and instead of once per module load.**

One additional concrete example of the same class of bug living inside
fbs's _type-level_ encoding, not just its runtime: fbs's enum fields are
encoded as an index into `sortedEnums[name]`, but the index is found with
`sortedEnums[name].indexOf(value)` — a **linear scan, on every serialize
call, per enum field**. Because our design resolves the enum's value set
at TS-compile time, the equivalent lookup can be a direct compile-time
computed table (see Type Coverage below) — an O(1) table index instead of
a linear scan, a concrete win beyond merely matching fbs's coverage.

## Why this is portable to TypeScript/roblox-ts

Luau has no runtime codegen path (`loadstring` is disabled on clients and
off by default on servers), so code generation must happen at TypeScript
compile time, via a custom TS transformer emitting TS AST that roblox-ts
then compiles to Luau — mirroring what Zap's Rust binary does ahead of
time, just inside the roblox-ts pipeline instead of a separate CLI/schema
file.

This was confirmed to compile correctly with a throwaway spike
(`spike-transformer/`, since removed from this repo now that its findings
are captured here — it was never part of the shipped design and was never
executed in Roblox, only compiled): a standalone transformer
(`spike-transformer/transformer/index.js`) that, given
`createSerializer<Data>()`, uses the TypeScript checker to walk `Data`'s
properties and emits a full multi-statement function body via
`ts.factory` (a local `buf`, sequential `buffer.writeXX` calls, a `return`).
roblox-ts compiled it straight through to:

```lua
local serializeData = function(value)
	local buf = buffer.create(9)
	buffer.writef64(buf, 0, value.a)
	buffer.writeu8(buf, 8, if value.flag then 1 else 0)
	return buf
end
```

Flat, no dispatch, no recursion into a shared interpreter — the Zap shape,
produced by a roblox-ts transformer. This resolves the only real unknown:
whether a roblox-ts transformer can emit imperative multi-statement bodies
at all (existing precedents like `rbxts-transformer-t` only ever emit single
expressions).

The spike also confirmed this transformer can coexist with
`rbxts-transformer-flamework` in the same `tsconfig.json` `plugins` array,
processing the same file without interference: with both registered, a
`Flamework.createGuard<Data>()` call in the same file as
`createSerializer<Data>()` compiled correctly, each transformer only
touching its own calls. One related, non-blocking finding: Flamework's
transformer detected a TypeScript version mismatch against the version
roblox-ts bundles (`v5.9.3` vs. the `v5.5.3` Flamework prefers) and fell
back automatically, only emitting a warning. This is a reason to keep this
transformer's own factory relying on the `ts` instance roblox-ts injects
as the third factory argument (confirmed present, see "Transformer
design" below) rather than importing its own `typescript` dependency, so
it cannot itself be a second source of version drift.

Before being removed, the spike was extended once more to de-risk
signature-based detection specifically (see Transformer Design §1 below):
with `createSerializer` re-exported under an alias
(`export { createSerializer as createSerializerAlias } from "./serializer"`)
and called as `createSerializerAlias<Data>()`, resolving the call
expression's symbol and following `checker.getAliasedSymbol` back to the
canonical declaration correctly identified it as the same
`createSerializer`, and the aliased call got the identical flattened
`buffer.writeXX` body. A negative control in the same build — an unrelated
local function that merely happens to also be named `createSerializer`,
called directly — was correctly left untouched, confirming this is
detection by declaration identity, not by matching the name "createSerializer"
as text.

Further confirmed while building the real transformer, since these were
the actual mechanics the design (and this note) depends on, not just the
detection scheme above:

- A synthetic (`ts.factory`-built) parameter gets full type-directed
  lowering exactly like a hand-written one, _provided_ it carries a real
  `ts.TypeNode` — a synthetic `number[]`-typed parameter correctly lowers
  `for (const x of value)` to `for _, x in value do` and `value[0]` to
  `value[1]` (the 0→1 index shift applied correctly), and a synthetic
  `Map<K,V>`-typed parameter correctly lowers destructured `for...of` and
  rejects `.size()` as "cannot index a method without calling it" — the
  same diagnostic hand-written code gets, confirming the checker treats
  the synthetic node exactly as it would a real one. `any`-typed
  synthetic values are the one exception: roblox-ts's compiler outright
  refuses to compile a call or property access through `any` ("Using
  values of type `any` is not supported!"), and `for...of` over an
  `any`-typed expression crashes the compiler outright ("ForOf iteration
  type not implemented: any") — a real compiler limitation, not
  something this design works around by avoiding `any`, but something it
  has to route around by giving every synthetic value a real type
  (`unknown`, a literal type built from the `Field` IR, or a named type
  alias for a self-referential shape) instead.
- roblox-ts flatly rejects TypeScript's `for...in` statement
  ("for-in loop statements are not supported!"). A `Record<K, V>` has no
  other TypeScript-level iteration protocol (it isn't `Iterable`), so
  iterating one requires a synthetic `value as unknown as Map<K, V>` cast
  immediately before the `for...of` — lossless at runtime, since a
  `Record`'s Luau representation is already the identical plain table a
  `Map` would be (see Type Coverage below), and the cast only changes
  what the type checker sees.
- Neither array nor string has a `.length` property under roblox-ts's
  `noLib` global set — both use a `.size()` method instead (compiling to
  Luau's `#` operator). Getting this wrong doesn't fail loudly at the
  transformer level; it surfaces later as a `tsc` type error in whatever
  file happens to call the generated code.
- The checker represents the plain `boolean` type itself as the union
  `true | false` in property-type position (unlike `number`/`string`,
  which keep their own dedicated, non-union type flags), so the type
  walk's union branch must special-case "exactly the two boolean
  literals" back to `bool` before its generic literal-union handling
  runs — otherwise every `boolean` field silently becomes a 2-value
  literal-index encoding instead: it still round-trips correctly (which
  is why this shipped once, undetected by the round-trip suite, until a
  review caught it against the generated Luau), just as 1 byte instead of
  1 bit once wrapped in `Packed<T>`, defeating the packing entirely
  without any test failing. the transformer repo's `test/walk.test.ts` now pins this
  case directly, and `coverage.spec.ts`'s packed-boolean fixture asserts
  the packed buffer's byte size, not just round-trip equality, so a
  regression here fails loudly again.
- Returning a plain `ts.factory.createFunctionExpression` as an
  object-literal property (`{ serialize: function(value) {...} }`) gets
  roblox-ts's method-call heuristic applied to it: it adds an implicit
  `self` parameter and expects `:`-call at every call site. `Serializer<T>`
  declares `serialize`/`deserialize` as arrow-typed _properties_, so a
  caller that holds a value through that type (rather than the inferred
  type of the immediate `createBinarySerializer<T>()` call) generates a
  `.`-call, and `self` silently receives the first real argument instead
  of `value`/`input`. The fix is to build these with
  `ts.factory.createArrowFunction` instead, which never gets the implicit
  `self` and always call/declare-site-agrees on `.`.
- The type walk memoizes a resolved `Field` (and its recursion-helper name,
  if any) by `(ts.Type, packed)`, not by `ts.Symbol`. Two reasons: the same
  `interface` can legitimately appear twice in one root type, once as a
  plain field and once inside a `Packed<T>` subtree (e.g. a shared `Flags`
  interface reused as both `plain: Flags` and
  `wrapped: DataType.Packed<Flags>`), and those two walks must produce
  different `Field`s (only one has its booleans bit-packed); and every
  instantiation of one generic declaration (or one anonymous alias body)
  shares a single declaration symbol, so `Box<number>` and `Box<string>`
  need to classify independently too. `ts.Type` is what the checker
  actually interns per instantiation, so keying on it (rather than symbol,
  or symbol plus type arguments, which still collapses an anonymous alias
  body's identical `__type` symbol) covers both cases, including a
  self-referential type reused in both a plain and a `Packed<T>` context
  getting its own recursion helper per context. Pinned by dedicated cases
  in the transformer repo's `test/walk.test.ts`.

The transformer does **not** shell out to Zap or reuse its Rust code — Zap
is Rust-CLI-based and targets its own `.zap` DSL and event/networking
model. Only the _technique_ (schema-time specialization) is reused; this
project's own small IR is written in TypeScript.

## Transformer design

1. **Detection**: match calls to `createSerializer<T>()` /
   `createDeserializer<T>()` / `createBinarySerializer<T>()` by resolved
   declaration identity via the checker, not by name string, so
   re-exports/aliases still work. **Confirmed** (see "Why this is portable"
   above): resolving a call expression's symbol and, when it's an alias,
   following `checker.getAliasedSymbol` to the underlying declaration
   correctly followed a re-exported/aliased `createSerializer` import back
   to the real one, while a same-named but unrelated declaration was
   correctly left alone — the mechanism this design depends on for every
   later step, not just the simpler identifier-text match the spike used
   initially.
2. **Type walk**: `checker.getTypeFromTypeNode(typeArgument)`, then walk
   properties/union constituents/array element types/tuple element
   types/index signatures recursively, classifying each into an internal
   `Field` IR node (kind + width + child nodes for aggregates). See Type
   Coverage below for the full set of `Field` kinds and how each fbs
   metadata kind maps onto one.
3. **Field order determinism**: sort each object type's properties **by
   property name**, not by checker iteration order or declaration position.
   An earlier version of this design used
   `symbol.valueDeclaration.pos`, but that is a per-file text offset —
   comparing it across properties contributed by different files (`A & B`,
   `extends` across modules) compares unrelated numbers, and transient
   symbols from `Partial<T>`/`Pick<T>`/mapped types can lack a
   `valueDeclaration` entirely. Sorting by name is fully deterministic
   regardless of how the type was constructed and needs no fallback case.
   This is the fix for the exact instability fbs's own doc comment on
   `createBinarySerializer` admits to: _"this serializer depends on the
   order of emit, but this isn't guaranteed to be stable across
   compiles... two binary serializers for type T may be incompatible if
   they're not created within the same TS file."_ Order is now a pure
   function of the property names in the type, independent of file,
   compiler version, or iteration state.
4. **Buffer strategy (decided)**: a single growable, module-scoped scratch
   buffer with a runtime write cursor — the same mechanism fbs and Zap both
   already use. Generated `write` functions call a shared `alloc(n)` helper
   (from `@rbxts/surge`, see [serde.md](serde.md)) that advances the
   cursor and doubles the scratch buffer on overflow; at the end of a
   top-level `serialize()` call, the used region is copied into an
   exact-size result via `buffer.copy`. This was chosen over a two-pass
   exact-allocation design (a companion `size(value)` function generated
   per shape, sized first, written with no copy) because it needs one
   traversal of the value instead of two, and because it reuses the same
   runtime helper regardless of whether a shape is all-fixed-size or has
   variable-length fields — the `Field` IR does not need to branch on that
   distinction when emitting the buffer-writing statements, only when it
   emits size validation/guards. Variable-length aggregates
   (arrays/maps/sets/records/dynamic strings) reserve their length prefix
   with `alloc(4)`, remember the returned position, count entries while
   writing them, then backpatch that position with `buffer.writeu32` once
   the count is known — a single pass, same technique fbs's own
   array/map/set encoding already uses.
5. **IR → code emission**: a small internal `Stmt`/`Expr`-shaped builder
   (mirroring Zap's `irgen`, but producing `ts.factory` nodes instead of a
   Rust string emitter) turns the `Field` tree into one flat function body:
    - Every field, fixed or variable-size, emits `alloc(n)` then
      `buffer.writeXX(buf, cursor, expr)` / the matching read, in source
      order, with no runtime dispatch on field kind.
    - Variable-size fields (strings, dynamic arrays/maps/sets/records)
      additionally emit a length write/read followed by a loop, still
      inline in the same function, not delegated to a shared generic
      loop-over-metadata helper.
    - Nested anonymous or non-recursive object/array/tuple element types are
      inlined recursively at transform time, same as Zap's Rust-side
      recursion for struct fields — no per-field function-call indirection.
      This does not extend to Zap's `.zap`-level named `type` declarations,
      which Zap compiles to their own shared function (`push_tydecl`) because
      they can be referenced from many events; this project has no
      equivalent multi-root-shape registry, since each `createSerializer<T>()`
      call site is transformed independently.
6. **Recursive/self-referential types**: detected during the type walk (a
   type reappearing on its own path); these compile to a **named helper
   function** (module-scoped local) instead of infinite inlining, with
   direct calls at the recursion points. This is the one place indirection
   is intentionally kept.
7. **Deserialization** mirrors serialization statement-for-statement
   (`buffer.readXX` in the same field order), built from the same `Field`
   IR so the two can never drift out of sync for a given compiled shape.
   Generated reads do **not** bounds-check the input buffer by default —
   matching fbs, which doesn't either; Zap's equivalent, `write_checks`, is
   opt-in, not default. `deserialize()` given a malformed or truncated
   `buffer` therefore has unspecified behavior (a wrong value or a runtime
   error), not a guaranteed clean error. This keeps the generated read path
   exactly as flat as the write path (see [testing.md](testing.md) for the
   corresponding test-scope decision this implies).
8. **Error model**: a type the transformer cannot encode correctly is a
   build error, never a silent fallback and never a Node stack trace. The
   walker collects a diagnostic for each such type (a function, `symbol`,
   `bigint`, `null`, or template literal type; properties plus an index
   signature; a bare `EnumItem`; a union of items from two enums; a tuple
   whose rest element is not last; a union the write side cannot guard,
   see Type Coverage), and `index.ts`
   adds each one to the transformation context as a `ts.Diagnostic` with
   category `Error`. The diagnostic points at the declaration of the
   offending property when that declaration is in the file being
   transformed, otherwise at the factory call. A factory call without
   exactly one explicit type argument
   (`const s: Serializer<Foo> = createBinarySerializer()`) is also a
   diagnostic: the type is not inferred from the contextual type. A call
   site with a diagnostic is left untransformed. roblox-ts 3.0.0 adds the
   transformers' diagnostics to its own and stops before emit when any is
   an error (`compileFiles.js`), so the user sees
   `file.ts:5:2 - error TS surge: ...`. `addDiagnostic` is internal to
   TypeScript (absent from `typescript.d.ts`). A plain `throw` is reserved
   for internal invariants.
9. **Injected imports**: the generated code calls `@rbxts/surge` exports
   (`alloc`, `readAlloc`, ...). The transformer adds one import declaration
   per file and aliases every name
   (`import { alloc as __surge_alloc } from "@rbxts/surge"`), so a user
   declaration named `alloc`, at the top level or in a scope enclosing the
   call site, can neither collide with the import nor shadow it. Named
   imports, not a namespace import: roblox-ts compiles each one to a local
   (`local __surge_alloc = _surge.alloc`), so a call costs no table index.

## Type coverage

Parity target is fbs's complete supported surface, confirmed by reading
`src/metadata/index.ts`, `unions.ts`, `dataType.ts`,
`processSerializerData.ts`, `createBinarySerializer.ts`, and both
serialization files, plus one addition (`Record`/index-signature
dictionaries) fbs cannot express at all.

One empirical finding changes three rows below at once: compiling actual
`Map`/`Set`/`Record` usage through the installed roblox-ts 3.0.0 (not
assumed — checked by compiling `new Map<string, number>()`,
`new Set<number>()`, and a `Record<string, number>` literal) shows that
roblox-ts has **no wrapper class for `Map`/`Set` at all** — both compile
directly to a plain Luau table (`m.a = 1`), `.size()` compiles to an
inline `for _ in m do count += 1 end` loop (**O(n)**, not O(1)), and
`for (const [k, v] of m)` compiles to plain `for k, v in m do`. This is
Luau's ordinary table-iteration syntax, identical to what a `Record`/index
signature lowers to. So `map`, `set`, and `record` are not three
codegens — they are **one**, differing only in whether a value is written
alongside the key (`map`/`record`) or the key alone with a `true` marker
written back on read (`set`), and in the declared TS return type
(`Map`/`Set`/plain object) used to reconstruct the result on deserialize.
This also means our codegen must never call `.size()` — irrelevant anyway,
since the buffer strategy already counts while iterating and backpatches
the length (Transformer Design §4), the same technique fbs's own
`map`/`set` serializer already uses for exactly this reason.

| fbs metadata kind                                   | TS surface that produces it                                                                                                 | This design's `Field` kind                                  | Encoding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `f32`/`f64`/`u8`/`u16`/`u32`/`i8`/`i16`/`i32`       | `DataType.f32` etc. branded numbers (`number & { _u8?: never }`), or plain `number` → `f64` by default                      | `num(width)`                                                | direct `buffer.writeXX`/`readXX`, no branching. `DataType.u24`/`i24` (not in fbs) are 3 bytes: Luau has no 24-bit buffer calls, so each is a `u16` of the low bits and a `u8` of the high bits, still with no branch (`bit32` stores a negative `i24` in two's complement, and one exclusive-or and a subtraction sign-extend it on read)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `boolean`                                           | `boolean`                                                                                                                   | `bool`                                                      | 1 byte by default; bit-packed only inside `Packed<T>` (see below)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `string`                                            | `string`                                                                                                                    | `str`                                                       | `u32` length prefix + `buffer.writestring`/`readstring`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `blob`                                              | `Vector2`                                                                                                                   | `vector2`                                                   | 2×`f32` — fbs has no dedicated `Vector2` kind and routes it to its side table; this design gives it a real encoding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `blob`                                              | `Vector3int16`, `UDim`, `UDim2`, `BrickColor`, `NumberRange`, `Rect`, `DateTime`                                            | `datatype(name)`                                            | the value's numbers at fixed offsets in one allocation, rebuilt with the type's constructor: `Vector3int16` 3×`i16`, `UDim` `f32` scale + `i32` offset (Roblox stores the offset as an int32), `UDim2` two `UDim`s (X, then Y), `BrickColor` `u16` `.Number` (the largest palette number is 1032), `NumberRange` 2×`f32` (`Min`, `Max`), `Rect` 4×`f32` (`Min.X`, `Min.Y`, `Max.X`, `Max.Y`), `DateTime` `f64` `UnixTimestampMillis`, rebuilt with `DateTime.fromUnixTimestampMillis`. One row of `FIXED_DATATYPES` (`datatypes.ts`) per type, not a `Field` kind each; fbs routes all of these to its side table. The `typeIs` tag of a union member is the type's name                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `blob`                                              | `buffer`                                                                                                                    | `buffer`                                                    | `u32` length prefix + the bytes (`buffer.copy`), like `str`. The read side returns a copy, not a view of the payload; fbs routes a `buffer` to its side table                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `vector`                                            | `Vector3`                                                                                                                   | `vector3`                                                   | 3×`f32`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `cframe`                                            | `CFrame`                                                                                                                    | `cframe`                                                    | 6×`f32` (position + axis-angle) by default. Anywhere inside `Packed<T>`: one header byte, then 3×`f32` position unless it is `Vector3.zero` or `Vector3.one`, then 3×`f32` axis-angle unless the rotation is one of the 24 axis-aligned ones (1, 13, or 25 bytes; see below)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `color3`                                            | `Color3`                                                                                                                    | `color3`                                                    | 3×`u8` (0–255 channel quantization, same precision trade-off fbs makes)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `colorsequence` / `numbersequence`                  | `ColorSequence` / `NumberSequence`                                                                                          | `colorSequence` / `numberSequence`                          | `u8` keypoint count + fixed-size keypoints: `f32` time + 3×`u8` color, or `f32` time + `f32` value + `f32` envelope. fbs uses the same layout without the envelope, which it drops                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `enum`                                              | `EnumItem`                                                                                                                  | `enum(enumName)`                                            | `u8`/`u16` index (like `literal`, above 256 members — `Enum.KeyCode` needs it) into a **compile-time-computed** `{[name]: index}` lookup table emitted as a module constant (keyed by `EnumItem.Name`, a plain string, not the `EnumItem` value itself — confirmed by execution that Lune's `EnumItem`s aren't stable table keys across separate accesses, unlike real Roblox's engine singletons), entries in **member-name-sorted order** (same discipline as object field sorting, Transformer Design §3 — not `.d.ts` declaration order or a runtime `GetEnumItems()` call, neither of which this design relies on being stable) — O(1), unlike fbs's runtime `indexOf` scan. A bare `EnumItem` field (no specific `Enum.*` type) is rejected with a diagnostic instead, since it has no member list to index into.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `object` / `object_raw`                             | interface / object type literal                                                                                             | `object(fields[])`                                          | fields inlined in name-sorted order; fbs's `object_raw → object` runtime flattening pass has no equivalent here since the flattening already happened at transform time                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `array`                                             | `T[]`                                                                                                                       | `array(element)`                                            | `u32` count + inline loop over element `Field`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `tuple`                                             | `[A, B, ...]`, incl. rest (`[A, ...B[]]`)                                                                                   | `tuple(fixed[], rest?)`                                     | fixed elements inline in order; rest element count-prefixed like an array                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `map`                                               | `ReadonlyMap<K, V>`                                                                                                         | `dict(key, value)`                                          | `u32` count (backpatched) + inline `for k, v in value do` loop — see the Map/Set/Record note above; iteration order is unspecified, not sorted (see caveat below)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `set`                                               | `ReadonlySet<V>`                                                                                                            | `dict(key, undefined)`                                      | same as `map`, writing only the key; reconstructed by setting each read key to `true` in the result table                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `optional`                                          | `T \| undefined`                                                                                                            | `optional(inner)`                                           | 1-byte presence flag by default; as a direct property of an object inside `Packed<T>`, one presence bit in that object's packed region and no flag byte (see below)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `literal` (multi-value)                             | literal union (`"a" \| "b" \| "c"`, numeric/boolean literal unions, including one that also admits `undefined`)             | `literal(values[])`                                         | `u8`/`u16` index into a fixed values table, chosen by value count, matching fbs's width thresholds; values in canonical order (by `typeof`, then value, `undefined` last — not the checker's type-id/creation order, which depends on unrelated files, see Transformer Design §3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `literal` (single value)                            | a **required** field whose type has exactly one possible literal value, and does not include `undefined`                    | `literalConst(value)`                                       | **zero bytes** — the value is a compile-time constant on both ends, same optimization fbs makes. `SomeLiteral \| undefined` does not qualify: fbs's own type-level rule folds it into the multi-value `literal` case instead (a 2-slot value set, one slot meaning "absent"), costing 1 byte (or 1 bit inside `Packed<T>`) — not `optional(literalConst)` and not zero bytes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `union` (discriminated)                             | object union sharing one unique-per-variant literal key                                                                     | `taggedUnion(tagKey, variants[])`                           | `u8`/`u16` variant index + inline variant fields (tag key omitted from the payload, restored on deserialize). With two variants, as a direct property of an object inside `Packed<T>`: one tag bit in that object's packed region and no index                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `union` (guard, ≤1 table-shaped variant)            | e.g. `string \| number`, `SomeInterface \| string`                                                                          | `guardedUnion(variants[])`                                  | 1-byte variant index; variants sorted by `Field` kind, then by literal value for two `literalConst` constituents (the only kind that can repeat — see Transformer Design §3), not the checker's `type.types` order. **This design** emits a direct `typeIs(value, "string")`/`"number"`/`"boolean"` check per primitive constituent instead of a generated guard — simple because these are Luau built-in type tags, not because fbs does the same. fbs, by contrast, still requests a Flamework-generated guard (`Modding.Generic<T, "guard">`) for every non-table constituent; only the one lucky "singular object constituent" gets `undefined` in place of a guard, falling back to `typeIs(value, "table")`. **"Table-shaped" is deliberately broader than "object":** it must count objects, arrays, tuples, and `dict` (`Map`/`Set`/`Record`) constituents together, since all of them compile to a plain Luau table and are equally indistinguishable via `typeIs(value, "table")` — fbs's own `IsTableObject<T>` check is written this way for the identical reason (`T extends object` is true for arrays too, so fbs already counts an array constituent against the "≤1" budget, not just plain interfaces). A `Vector2`, `Vector3`, `CFrame`, `Color3`, `ColorSequence`, or `NumberSequence` constituent is guarded by its own `typeIs` tag, a single specific enum by `"EnumItem"`, and a recursive object type by `"table"`. The walker rejects, with a diagnostic, every union this scheme cannot decide: two constituents with the same runtime type (two `DataType` number widths, an enum with several members next to another type), and an opaque (`blob`) constituent next to any other |
| `union` (guard, 2+ ambiguous table-shaped variants) | e.g. `{a:1} \| {b:1}`, or `{a:1} \| number[]` — two _different_ table-shaped constituents, not just two object constituents | `guardedUnion(variants[])` with generated structural guards | see Risks below — the one corner of union support still open                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `blob`                                              | `unknown`, `Instance` (and subclasses), any other type this design can't structurally encode                                | `blob`                                                      | not written into the buffer at all; pushed onto a side array returned alongside the buffer in encounter order (generalizes Zap's `outgoing_inst` Instance-only side table to any opaque value, matching fbs) — see the gating note below `unknown` and `any` walk as `optional(blob)`, with the usual 1-byte presence flag: either can hold `undefined`, and an `undefined` value pushes no blob (see Blob / passthrough channel)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| _(not in fbs)_                                      | `Record<K, V>` / `{ [key: string]: V }` / `{ [key: number]: V }` index-signature types                                      | `dict(key, value)`                                          | identical codegen to `map` (see above); see below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### `Record<K, V>` / index-signature dictionaries

fbs cannot express this today: its object walk requires a known, finite
`keyof T` (`{ [k in keyof T]-?: [k, SerializerMetadata<T[k]>] }[keyof T][]`),
which does not resolve usefully for an index signature. This design adds
it as a first-class case of the same `dict` `Field` kind used for `Map`:

- **Detection**: `checker.getIndexInfosOfType(type)` (the current TS 5.x
  API — the older singular `getIndexInfoOfType` is deprecated), checked
  _after_ the fixed-property walk finds no declared properties — so a
  plain interface is never misread as a dictionary.
- **Representation shape**: confirmed by actually compiling a
  `Record<string, number>` literal, a `new Map<string, number>()`, and a
  `new Set<number>()` through roblox-ts 3.0.0 — all three lower to a plain
  Luau table with no wrapper class, iterated with plain `for k, v in value
do`. So `dict` needs exactly one codegen path for `Map` and `Record`
  alike (see the Type Coverage note above); a `record` is not a special
  case needing its own iteration strategy.
- **Key type**: `Record<string, V>` and `Record<number, V>` (and their
  bare index-signature equivalents) are both supported; the key `Field` is
  encoded the same way a `string`/numeric `Field` would be anywhere else.
  `Record<SomeUnion, V>` (a finite key union, not a true index signature)
  is out of scope for this kind — that's better served by treating it as a
  fixed-property `object` if the union is closed, which the property walk
  already handles when `keyof T` is a finite literal union.
- **Ordering is not deterministic, by design, matching an existing fbs
  limitation.** Unlike object fields (name-sorted, Transformer Design §3),
  a `dict`'s entries serialize in whatever order Luau's table iteration
  visits them — unspecified, and not guaranteed stable across two calls
  with equal-content input. fbs's own `map`/`set` encoding has the
  identical property (it iterates the value directly with no sort step).
  Sorting keys before writing would fix this but costs an allocation and a
  sort on every `serialize()` call for that field, which contradicts the
  performance goal — so this design keeps the same trade-off fbs already
  makes rather than pay for determinism. Anyone hashing or diffing
  serialized payloads containing a `Map`/`Set`/`Record` needs to know
  byte-equality is not guaranteed for equal values, only round-trip
  equality is.

### `Packed<T>`: opt-in bit-packing

fbs's bit-packing is not a global mode — it is **opt-in per subtree**,
via a branded wrapper type:
`DataType.Packed<T> = T & { _surge_packed?: [T] }`. The transformer
recognizes a direct reference by alias identity and a re-alias
(`type PackedFlags = DataType.Packed<Flags>`) by the brand property, whose
tuple element carries `T`.
Only `boolean` and `optional` fields _inside_ a `Packed<T>` subtree get
bit-packed; everywhere else they are byte-aligned. Each object in the
subtree starts with its own packed region: one bit per packed `boolean`
property and one presence bit per packed `optional` property, in property
name order, rounded up to whole bytes. An optional `boolean` is two
adjacent bits (presence, then value) and has no byte of its own. A
tagged-union property with exactly two variants is one tag bit (set for
the second variant in tag order) and has no index byte; with more
variants it keeps its index. The region comes first because the read side
needs a presence or tag bit before it reaches the value it describes.

A `CFrame` anywhere inside a `Packed<T>` subtree (a property, an array
element, a union variant) uses the packed form. It needs no bit in a
packed region, so it does not have to be a direct property:

- One header byte. Bits 0-4 are the rotation: 0-23 for an axis-aligned
  rotation, 31 for any other. Bits 5-6 are the position: 1 for
  `Vector3.zero`, 3 for `Vector3.one`, 0 for any other.
- Then 3×`f32` position, unless the header gives it.
- Then 3×`f32` axis-angle, unless the header gives the rotation.

An axis-aligned `CFrame` at the origin is 1 byte, one elsewhere is 13, and
a `CFrame` with neither property is 25, which is 1 more than outside
`Packed<T>`. fbs avoids that byte with a bit in its global bit stream;
here it would need a packed region, which an array element does not have.
The rotation index is `xCode * 4 + rank`: the X vector's direction (6
codes, `axis * 2 + negative`), and which of the 4 directions off that axis
the Y vector has. It is not fbs's 24-entry table: that table is a list of
`CFrame.Angles` results, and only 20 of them are distinct under Lune's
`CFrame.Angles`. A `CFrame` stores `f32` components, so
`CFrame.Angles(math.pi / 2, 0, 0)` has a component of `-4.4e-8` where the
exact rotation has 0; a vector counts as axis-aligned when its two other
components are within `1e-6`, which moves the rotation by less than the
`f32` axis-angle form does. fbs compares with `==` against its
`CFrame.Angles` results, so it matches only a rotation with the same
drift. This is the one encoding that branches on the value, so it is a
runtime function (`writePackedCFrame`/`readPackedCFrame` in
`@rbxts/surge`'s `cframe.ts`), not inlined code.

This design adopts the same opt-in mechanism as fbs rather than
picking a single global default, which resolves the bit-packing question
from the previous version of this document without trading away the
default performance goal: byte-aligned stays the default everywhere,
and a user who wants the smaller wire format for a specific `boolean`-
or `optional`-heavy shape can ask for it explicitly with the same,
already-familiar `Packed<T>` wrapper fbs users already use.

### Blob / passthrough channel

Some values cannot or should not be encoded into the buffer at all:
`unknown`, `Instance` and its subclasses (a `buffer` cannot hold an
object reference), and, in fbs's own implementation, any type its walk
doesn't otherwise recognize. This design keeps the same escape hatch:
such a field is classified as `blob`, is not written into the buffer, and
is instead pushed onto a `blobs: defined[]` array returned alongside the
buffer from `serialize()` — the same shape as fbs's existing
`{ buffer, blobs }` result and `deserialize(input, inputBlobs?)`
parameter (see [serde.md](serde.md)). This generalizes Zap's
`outgoing_inst` side table (Instance-only) to any opaque value, matching
fbs's broader scope.

Blobs are indexed purely by **encounter order** — nothing is written into
the buffer to mark a blob's position, matching fbs's own
`blobs[blobIndex++]` scheme exactly. The general rule this requires:
**anything that writes only on a taken branch — `optional`, `taggedUnion`,
or `guardedUnion` alike, not just "optional or union" as a shorthand —
must push its blobs inside that branch**, never unconditionally, or the
encounter order (and therefore the index) drifts between what
`serialize()` produced and what `deserialize()` expects to consume. Since
only one variant's fields are ever written for a tagged or guarded union
(same as only writing an `optional`'s inner value when present), this is
one rule applied consistently, not a special case per union kind.

`unknown` and `any` are themselves such a branch. Either can hold
`undefined`, `pushBlob(undefined)` appends nothing to a Luau array, and
the checker reduces `unknown | undefined` to `unknown`, so `a?: unknown`
has no `undefined` constituent for the walker to find. The walker
therefore classifies both types as `optional(blob)`: a 1-byte presence
flag, and a push only when the value is present. As a plain `blob`, an
absent `a?: unknown` shifted every later blob of the call into the wrong
field with no error. fbs makes the same choice. Every other `blob`
(`Instance`, a datatype without an encoding, `defined`) cannot hold
`undefined` and has no flag.

One case this rule does _not_ need to worry about: a blob written inside
an `array`/`dict` loop. Loop iteration count is itself encoded in the
buffer and both directions read/write exactly that many entries in
lock-step, so every iteration pushes unconditionally and stays in sync —
the "only push when taken" rule is specifically about conditional
branches, not loops. Nor does `dict`'s unspecified iteration order
(previous section) put blob indexing at risk: a blob's encounter-order
index tracks buffer-write order, and both `serialize()` and
`deserialize()` always agree on that order within one call, whatever
"logical" order produced it — the nondeterminism only affects which
bytes end up _where_ in the buffer, never which call reads which blob.

## Risks / open questions

- **Structurally-ambiguous union guards: implemented as a compile-time
  error, not guard codegen.** A union of two or more **table-shaped**
  variants — objects, arrays, tuples, or `dict` (`Map`/`Set`/`Record`) in
  any combination, not just two plain-object variants — with no shared,
  unique literal discriminant (e.g. `{a: 1} | {b: 1}`, or `{a: 1} |
number[]`) is the one union shape fbs handles by delegating to
  Flamework's own generated structural guards (`Modding.Generic<T,
"guard">`), which a standalone transformer has no access to and would
  have to reimplement. This design does not reimplement it: the
  transformer reports a diagnostic (Transformer Design §8) telling the
  caller to add a discriminant, rather than silently emitting wrong or
  ambiguous code. Note this is a narrower gap than "non-discriminated
  unions" as a whole: primitive unions (`string | number`) and unions
  with at most one table-shaped variant are handled cheaply with a
  `typeIs`/literal check and need no guard generation at all, and are
  fully implemented (see Type Coverage above) — and Zap itself has no
  equivalent to this narrower corner case either (its DSL only has tagged
  unions).
- **`Packed<T>` bit-packing is per object, for direct properties
  only.** It covers a `boolean`, an `optional`'s presence, and the tag of
  a two-variant tagged union. Each object gets its own leading packed
  region for its own direct properties of those kinds. One that is not a
  direct property of an object — an array, tuple, or dict element, a union
  variant that is not an object, or the root type — falls back to the
  byte-aligned encoding with no diagnostic, since the packed region's size
  has to be known at compile time and an array's length isn't. A packed
  `CFrame` is not affected: its header is a byte of its own.
- **Luau function-size limits: the register limit is handled, the
  instruction limit is not.** Luau allows 200 registers per function, and
  every declared local holds one until its scope ends. The emitter declares
  two locals per fixed-size field (`const [buf, pos] = alloc(n)`) and more
  for strings, optionals, arrays, dicts, and unions, so 100 numeric fields
  in one scope used to fail when the module loaded
  (`Out of local registers ... exceeded limit 200`, confirmed with Lune's
  `luau.compile`). The emitter now counts the locals it declares in each
  generated function. Past 120 it wraps the fields of an object, or the
  fixed elements of a tuple, in blocks: consecutive fields are grouped up
  to 32 locals, and a single field with more locals than that gets a block
  of its own. roblox-ts
  compiles a block to `do ... end`, and Luau frees a block's registers at
  its `end`, so this costs no function call. On the read side a block's
  locals cannot reach a later object literal, so an object emitted in
  blocks is built as `const result = {}` plus one assignment per field
  instead of one table constructor; an object below the threshold is
  unchanged. `coverage.spec.ts` round-trips a 200-field object. Not
  handled: the instruction-count limit (2^23 interpreted; 64K instructions
  per block under `@native`), which only a far larger struct reaches.

Two further open items that carry their own stubs rather than living here:
schema evolution/versioning
([future-work/schema-versioning.md](future-work/schema-versioning.md)) and
the lack of automated runtime CI ([testing.md](testing.md)).
