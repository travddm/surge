# Future work: native code limits on a large serializer

Part of the [surge](../architecture.md) design.

## What

A generated serializer is one flat function per side (Transformer 5.2 in
[specs/transformer.md](../specs/transformer.md)), so its size grows with its
type. The emitter keeps each function under Luau's local register limit by
wrapping properties in blocks (Transformer 5.8). It tracks no other limit.
The limits a large type can reach are native code generation's, not the
compiler's:

- **The compiler's limits are out of reach.** Luau raises "Exceeded function
  instruction limit" only past 1,000,000,000 instructions in one function. It
  expands a jump that does not fit a 16-bit offset with a `JUMPX` trampoline,
  up to 2^23 instructions
  ([`BytecodeBuilder.h`](https://github.com/luau-lang/luau/blob/master/Bytecode/include/Luau/BytecodeBuilder.h),
  [`Compiler.cpp`](https://github.com/luau-lang/luau/blob/master/Compiler/src/Compiler.cpp)).
- **Native code generation has three lower limits.** The defaults are 65,536
  IR instructions in one block of a function, 32,768 blocks in one function,
  and 1,048,576 IR instructions in one module
  ([`CodeGen.cpp`](https://github.com/luau-lang/luau/blob/master/CodeGen/src/CodeGen.cpp)).
  They are fast flags, which Roblox can change. A function past either of the
  first two, or one that would take the module past the third, stays
  interpreted while the rest of the module runs natively
  ([`CodeGenContext.cpp`](https://github.com/luau-lang/luau/blob/master/CodeGen/src/CodeGenContext.cpp)).
  Studio's Output reports each one, for example "exceeded total module
  instruction limit"
  ([Native code generation](https://create.roblox.com/docs/luau/native-code-gen)).
  A game also has a total native code size limit. Past it, native compilation
  stops.

[performance.md](../performance.md) makes the module limit the likely one to
reach: it recommends one `--!native` module of serializers, and that module
holds every serializer it declares. A serializer past a limit still runs, but
slower, and the transformer reports nothing.

## Why deferred

No type in the benchmark catalog or the round-trip suite is known to reach a
limit. How large a type must be to reach one is not measured.

## How, briefly

- Measure first. Generate types of increasing size in properties, nested
  objects and union variants, and find where each limit is reached: Studio
  reports it, and `debug.dumpcodesize()` shows each function's native code
  size.
- If a realistic type reaches a limit, choose between a diagnostic and a
  split. The transformer cannot count IR instructions, so a diagnostic would
  warn from an estimate, such as the number of statements emitted. A split
  emits a large nested object as a local function, as a recursive type
  already is (Transformer 5.2). That gives each part its own block limits, at
  the cost of a call. The module limit is the user's to split, across
  modules.
- Either choice updates Transformer 5.8. Its last sentence says that the
  instruction-count limit of a Luau function is not handled, without naming a
  limit: the compiler's is out of reach, and native code generation's is the
  one that applies.
