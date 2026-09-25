# Performance

Put serializers in a module of their own, and mark it for native code:

```ts
// src/shared/serializers.ts
//!native
//!optimize 2
import { DataType, createCodec } from "@rbxts/surge";

export interface Move {
	position: Vector3;
	facing: DataType.u16;
}

export const move = createCodec<Move>();
```

## The two directives

`//!native` compiles the module to native code, and `//!optimize 2` compiles
it at the optimization level a published game uses. roblox-ts writes them
into the Luau as `--!native` and `--!optimize 2`, ahead of the first line of
code, where Luau reads them. Both apply to the whole file.

- **`//!optimize 2`** belongs on every module. Studio compiles at level 1 by
  default and a live game at level 2
  ([Luau comments](https://create.roblox.com/docs/luau/comments)), so pinning
  level 2 makes a profile taken in Studio a profile of what players run.
- **`//!native`** is what speeds up the generated code, and it compiles
  everything else in the file natively too. That is why the module should hold
  serializers and the types they are built from, and nothing else.

A type emits no Luau, and an import used only as a type is removed, so such a
module compiles to surge's import, one closure per serializer, and its
exports. Every line of it is code the directives are for. A module that also
holds game logic gives that logic native compilation as well, which is a
choice to make for that logic on its own terms.

Keep the module free of top-level declarations named after a Luau global the
generated code uses, such as `buffer` or `Vector3`: a module-level `const
buffer` would shadow the global for every serializer in the file
([specs/transformer.md](specs/transformer.md) 6.5). A module that holds only
serializers and types has none.

surge does not add the directives itself. The generated code is written into
the calling module, so a directive surge added would apply to code surge did
not write.

What the directives are worth on the generated code is measured in
[research/file-directives-on-generated-code.md](research/file-directives-on-generated-code.md).

## What to expect

- **Against flamework-binary-serializer**, surge encodes and decodes faster on
  every shape in the benchmark catalog, and writes the same bytes on most of
  them. The numbers are in [benchmarks/speed.md](benchmarks/speed.md) and
  [benchmarks/size.md](benchmarks/size.md).
- **Against hand-written Luau** that writes the same bytes, surge's encode
  pays a cost once per call and a cost per element
  ([research/generated-code-against-hand-written.md](research/generated-code-against-hand-written.md),
  and [research/tables-around-serialize.md](research/tables-around-serialize.md)
  for the per-call part).
- **`Packed<T>`** saves bytes on booleans, optionals and axis-aligned
  `CFrame`s, adds a byte to an arbitrary `CFrame`, and can slow encode or
  decode
  ([research/packed-against-unpacked.md](research/packed-against-unpacked.md)).

Each benchmark result is one shape in a warm loop on one machine. Measure a
game's own shapes before deciding on the strength of one.

## What the checks cost

`readChecks` adds a comparison to every read and a check of the input's shape
to every call, which costs a decode a few percent
([research/read-checks-cost.md](research/read-checks-cost.md)). It belongs on
the server,
for what clients send, and not where the bytes are the game's own
([errors-and-guarantees.md](errors-and-guarantees.md)).

`writeChecks` adds a comparison to every narrowed or exact `Length` and every
`Range` number it writes, and nothing to a type with neither. Turn it on
where such a value is built at run time.
