# Future work: enum index width and lookup tables

Part of the [surge](../architecture.md) design. **The first item is a
correctness bug in shipped behavior:** `Enum.KeyCode` does not fit the
1-byte index.

## What

- **Index overflow.** `walk.ts` sorts an enum's members and the emitter
  always writes the index with `buffer.writeu8`. The `@rbxts/types`
  version installed in `surge/node_modules` declares 283 members for
  `Enum.KeyCode` (counted from `enums.d.ts`), so 27 of them have an index
  of 256 or more, which `writeu8` truncates. Those key codes deserialize
  as a different key. `KeyCode` is the enum an input-replication shape is
  most likely to carry. `literal` unions already switch to `u16` above
  256 values; `enum` does not.
- **Bare `EnumItem`.** A field typed `EnumItem` (not a specific enum)
  classifies as `enum` with `enumName: "Enum"` and members
  `["EnumItem"]`, so the read side emits `Enum.Enum.EnumItem` and errors
  at runtime. Confirmed by walking `interface T { any: EnumItem }`.
- **A single enum item literal** (`Enum.HumanoidRigType.R15` as a type)
  costs one byte where a `literalConst` would cost zero. Minor.
- **The lookup is not O(1).** Type Coverage in
  [transformer.md](../transformer.md) says the enum index is "a
  compile-time-computed `{[EnumItem]: index}` lookup table emitted as a
  module constant" and calls the O(1) lookup "a concrete win beyond
  merely matching fbs's coverage". The emitter (`enumIndexExpr`,
  `enumFromIndexExpr`) produces a nested ternary chain instead. From
  `tests/out/tests/coverage.spec.luau`:

    ```lua
    buffer.writeu8(buf10, pos11, if value.rig.Name == "R15" then 0 else 1)
    ```

    For `KeyCode` that is up to 282 string comparisons per field per call on
    write, and up to 282 integer comparisons on read: a linear scan, the
    same cost class as fbs's `indexOf`.

- **Version coupling.** Member lists come from the installed
  `@rbxts/types`; when Roblox adds an enum member that sorts before an
  existing one, every index after it shifts. Nothing documents that enum
  encodings depend on the `@rbxts/types` version (see
  [schema-versioning.md](schema-versioning.md)).

## Why deferred

The width fix is one line but changes the wire format for large enums;
the lookup-table change is the codegen the design already describes and
should land with the enum-heavy benchmark row that justifies it (see
[benchmark-tooling.md](benchmark-tooling.md)).

## How, briefly

- Choose `u8`/`u16` from `members.length` exactly as `literal` does.
- Emit, per enum used in a call site, a `Map<EnumItem, number>` and an
  `EnumItem[]` inside the generated IIFE (roblox-ts lowers both to plain
  tables), then `INDEX.get(value)!` on write and `ITEMS[idx]` on read.
- Report a diagnostic for a bare `EnumItem` field; classify a single item
  literal as `literalConst`.
- Document the `@rbxts/types` dependency of enum encodings.
- Tests: a `KeyCode` round trip of a member whose sorted index is at least
  256; the `EnumItem` diagnostic; a golden check that no
  `.Name ==` chain appears in the compiled Luau.
