# Future work: round-trip test coverage

Part of the [surge](../architecture.md) design. All eight existing
round-trip facts pass under Lune, and none of them can see the bugs in the
sibling documents here: the suite exercises one instance of each easy
kind, with weak assertions, and skips most of the Type Coverage table.

## What

Promised by [testing.md](../testing.md) but absent from
`tests/src/tests/`:

- "at least one `@Fact` per shape that loops over many locally-generated
  random values" (a seeded fuzz loop): none exist.
- `@Theory` with `@InlineData` fixed cases: none exist.
- "arrays of unions, optional chains, recursive types, `Packed<T>`
  subtrees": only the simplest one of each.

Kinds and features with no round-trip fixture at all:

- `DataType.f32`/`u8`/`u16`/`u32`/`i8`/`i16`/`i32` (no branded width is
  used anywhere in `tests/`; `walk.test.ts` checks only that `DataType.f32`
  classifies as `f32`, not how any width round-trips).
- `blob` (`unknown`, `Instance`), `ColorSequence`, `NumberSequence`
  (the Lune runner does not bind those globals yet), `literal` unions,
  `literalConst` zero-byte fields, TypeScript `enum`s, `Enum` values with
  more than 256 members, `Record<number, V>`, `ReadonlyMap`/`ReadonlySet`,
  tuples with a rest element, nested optionals (`optional<object>`,
  `optional<array>`), a guarded union with a table variant
  (`string | Foo`), a tagged union with more than two variants or with
  nested unions, generic instantiations, mutual recursion, recursion
  through `Map`/optional, `Packed<T>` over a nested object or inside a
  union variant, a packed shape with more than 8 booleans (crosses a byte).
- `createSerializer`/`createDeserializer` used individually, and a
  re-exported or aliased factory (the transformer repository's unit tests
  cover these only at compile time: `detect.test.ts` resolves an aliased
  factory, and `transform.test.ts` transforms `createSerializer` and
  `createDeserializer` calls; no round-trip fixture runs any of them).
- `deserialize` called without `inputBlobs` on a blob-free shape.
- Empty collections, empty strings inside collections, strings with
  embedded `\0` and multibyte UTF-8, numeric edge values (`NaN`, `-0`,
  `math.huge`, integer widths at their bounds and beyond).
- Byte-level assertions: the packed-boolean fact is the only one that
  checks `buffer.len`. No fixture pins the exact bytes of a shape, so a
  wire-format change goes unnoticed (see
  [wire-format-determinism.md](wire-format-determinism.md)).
- Cross-call-site agreement: two `createBinarySerializer<T>()` calls for
  the same `T` in two files producing byte-identical output, the property
  Transformer Design §3 exists for.

Weak assertions in the existing facts:

- `roundTripsRobloxTypes` asserts `position.X` and `rig` only; the
  `CFrame` rotation and the `Color3` are serialized but never checked.
- `roundTripsCollections` checks `items.size()` and one entry of each
  other collection; no `items` element, `pair[0]`, `record.y`, or
  `set.has("q")` is checked.
- `roundTripsTaggedUnion` checks only the tag, not `width`/`height`, and
  never serializes the `circle` variant.

Runner gaps: `lune-test-runner.luau` binds `CFrame`, `Vector3`, `Color3`,
`Enum`, and an `Instance.new` shim that builds only `BindableEvent`;
fixtures for sequences, `Vector2`, `UDim2`, or `Instance` blobs need the
corresponding globals or a constructible fake Instance class added there.

## Why deferred

Test additions follow the fixes they pin; several fixtures above cannot
pass until the bugs in the sibling documents are fixed.

## How, briefly

- Add a `deepEqual`-style helper to the suite so every fact compares the
  whole value, and a small seeded generator per kind for the fuzz loops.
- One `coverage-*.spec.ts` per Type Coverage row, each with a fixed
  `@Theory` and one fuzz `@Fact`, plus a `bytes.spec.ts` that pins exact
  buffers for a handful of stable shapes.
- Extend the Lune runner's datatype globals as fixtures need them.
