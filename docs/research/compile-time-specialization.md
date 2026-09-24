# Specializing serializers at compile time

2026-09-18 and before · surge `bc06cf7` · rbxts-transformer-surge `be80b01` ·
roblox-ts 3.0.0, TypeScript 5.5.3

## Abstract

flamework-binary-serializer (fbs) interprets a metadata tree on every call,
dispatching on a kind string per field. Zap avoids that cost by walking its
schema once, at schema-compile time, and emitting flat Luau with one buffer
call per field; its buffer strategy is the same as fbs's and is not the
difference. A throwaway transformer spike showed that a roblox-ts transformer
can emit the same flat multi-statement bodies inside the roblox-ts pipeline,
coexist with Flamework's transformer, and find its factory by declaration
identity. Building the real transformer then found six compiler behaviors it
has to route around. None of this ran in Roblox: it is a source reading and a
set of compilation results.

## Background

surge's premise is that serializers specialized per shape at compile time
beat a runtime interpreter. Luau has no runtime code generation path —
`loadstring` is disabled on clients and off by default on servers — so the
specialization has to happen when TypeScript compiles, in a transformer that
emits TypeScript AST for roblox-ts to compile to Luau. Two questions had to be
answered before building one: where the interpreter's cost actually is, and
whether a roblox-ts transformer can emit imperative multi-statement bodies at
all, since existing transformers such as `rbxts-transformer-t` emit single
expressions.

## Method

- **Source reading.** fbs's `src/serialization/createSerializer.ts`,
  `createDeserializer.ts` and `processSerializerData.ts`, and Zap's
  `zap/src/irgen/ser.rs` and `mod.rs` on its `0.6.x` branch, at the commits
  [../future-work/type-coverage-parity.md](../future-work/type-coverage-parity.md)
  pins.
- **A spike.** A standalone transformer, compiled through roblox-ts 3.0.0 and
  never run in Roblox, that walks a type's properties with the checker and
  emits a function body through `ts.factory`. It was removed before surge's
  first commit and never entered its history.
- **The real transformer.** Each mechanic under Results was confirmed by
  compiling a case through roblox-ts while building it, and the ones listed
  are pinned by the transformer's tests.

## Results

### Where fbs's cost is

Every fbs `serialize` and `deserialize` is one recursive function with an
`if`/`elseif` chain on a `meta[0]` kind string (`"f32"`, `"object"`,
`"array"`, `"union"`, …), walking a metadata tree Flamework's `@metadata`
macro captured from `T`. Every field, on every call, pays a string-compare
cascade and a recursive call for nested shapes. An enum field is found with
`sortedEnums[name].indexOf(value)`, a linear scan per field per call.
Separately, `processSerializerData.ts` preprocesses the metadata once per call
site at module load: flattening `object_raw` into `object`, computing union
and literal widths, and sorting each enum's items.

Zap's generator walks the schema once, in Rust, and emits one
`buffer.writeXX` call per field in source order, with nested structs inlined
into the same function. Its buffer strategy — `alloc(n)` growing a shared
buffer at a running cursor — is the one fbs uses. The difference is when the
walk happens, not how bytes are written.

### What a roblox-ts transformer can emit

Given `createSerializer<Data>()`, the spike's output compiled to:

```lua
local serializeData = function(value)
	local buf = buffer.create(9)
	buffer.writef64(buf, 0, value.a)
	buffer.writeu8(buf, 8, if value.flag then 1 else 0)
	return buf
end
```

With `rbxts-transformer-flamework` registered in the same `plugins` array, a
`Flamework.createGuard<Data>()` in the same file compiled correctly, each
transformer touching only its own calls. Flamework reported a TypeScript
version mismatch against the one roblox-ts bundles and fell back with a
warning.

With `createSerializer` re-exported under an alias and called through it,
resolving the call's symbol and following `checker.getAliasedSymbol` reached
the canonical declaration, and the aliased call got the same body. An
unrelated local function also named `createSerializer`, in the same build,
was left alone.

### Six compiler behaviors the transformer routes around

1. A `ts.factory`-built parameter is lowered exactly like a hand-written one
   when it carries a real `ts.TypeNode`: `for...of` over a synthetic
   `number[]` becomes `for _, x in value do`, and `value[0]` becomes
   `value[1]`. An `any`-typed synthetic value is refused — a call or property
   access through `any` does not compile, and `for...of` over one crashes the
   compiler — so every synthetic value is given a real type.
2. roblox-ts rejects `for...in`. A `Record<K, V>` has no other iteration
   protocol, so the generated code casts it to `Map<K, V>` before a
   `for...of`, which changes nothing at run time: both are the same Luau
   table.
3. Under roblox-ts's global set, neither an array nor a string has
   `.length`; both have `.size()`. The mistake surfaces as a type error in
   whatever file calls the generated code, not in the transformer.
4. The checker represents `boolean` in property position as the union
   `true | false`. Without a special case the walk classifies every boolean
   as a two-value literal: it round-trips, but costs a byte where
   `Packed<T>` should cost a bit.
5. A `ts.factory.createFunctionExpression` as an object-literal property gets
   roblox-ts's method heuristic: an implicit `self` parameter and a `:` call.
   A caller holding the value through `Serializer<T>`, whose members are
   arrow-typed properties, calls with `.`, so `self` receives the first real
   argument. An arrow function never gets the implicit `self`.
6. Every instantiation of one generic declaration, and every anonymous alias
   body, shares one symbol, and one interface can appear once plain and once
   inside `Packed<T>` in the same root type. Memoizing a walked type by
   `(ts.Type, packed)` rather than by symbol keeps each of those apart.

## Discussion

The source reading predicted where the cost was, and the benchmark later
measured it: surge encodes and decodes faster than fbs on every row of the
catalog, on the same bytes on fourteen of them
([../benchmarks/speed.md](../benchmarks/speed.md),
[serialized-size-across-libraries.md](serialized-size-across-libraries.md)). The
reading does not by itself say how large the gap is, and the spike measured
nothing: it compiled, and nothing compiled here was run.

Behavior 4 shipped once undetected, because a boolean that costs a byte
still round-trips; a review caught it against the generated Luau. Two
lessons follow that the rest of this repository now applies: a round trip
does not show what an encoding costs, and a packed shape's tests pin its
byte size.

The Flamework version mismatch is why the transformer uses the `ts` instance
roblox-ts passes to its factory rather than a `typescript` dependency of its
own: a second copy would be a second source of the same drift.

## Conclusion

The cost of a runtime serializer is the per-call walk of its schema, and a
roblox-ts transformer can move that walk to compile time, emitting the flat
code Zap emits from Rust. Doing so means routing around six behaviors of
roblox-ts and the TypeScript checker, which the transformer and its tests now
encode.

## Data

- The fbs and Zap sources, at the commits pinned in
  [../future-work/type-coverage-parity.md](../future-work/type-coverage-parity.md).
- The spike was never committed; its output above is the record of it.
- Behaviors 1–6 are pinned by `rbxts-transformer-surge`'s `test/` suites;
  behavior 4 also by the packed-boolean size assertion in
  `tests/src/tests/coverage.spec.ts`.
