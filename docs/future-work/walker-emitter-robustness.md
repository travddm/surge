# Future work: walker and emitter robustness on unusual but valid types

Part of the [surge](../architecture.md) design. Each item below is a valid
TypeScript shape that currently produces a compiler crash, invalid
generated code, or a wrong encoding, with no diagnostic. All were confirmed
by executing the compiled walker and emitter unless marked otherwise.

## What

- **Property names that are not identifiers.**
  `interface T { "my-key": number; 0: string }` emits `value.my-key`,
  `value.0`, and `{ my-key: ... }`: invalid TypeScript, so the build fails
  in whatever file holds the call with an error that does not mention the
  transformer. The emitter uses `createPropertyAccessExpression` and
  `createPropertyAssignment` with the raw name everywhere.
- ~~Type symbols named after `Object.prototype` members.~~ Fixed as a side
  effect of [blob-classification.md](blob-classification.md): the
  `symbolName in ROBLOX_SCALAR_KINDS` lookup that matched through the
  prototype chain is now also gated on the symbol's declaration resolving
  to `@rbxts/types`, so a user's own `toString(): string`-shaped method
  falls through to that fix's function-type diagnostic instead. See the
  regression test in `test/walk.test.ts`.
- **Tuples with a leading or middle rest element.**
  `[...number[], string]` walks as fixed `[str]` plus rest `num`, so the
  write reads `tup[0]` as the string. Only a trailing rest is supported;
  nothing rejects the other forms. (Optional trailing elements,
  `[number, string?]`, do work.)
- **Non-table, non-primitive union members.** `guardFor` in `emit.ts`
  handles `num`, `str`, `bool`, `literalConst`, and the four table kinds
  (`object`/`array`/`tuple`/`dict`), and throws a plain `Error` for every
  other kind. `classifyUnion` reports a diagnostic only for two or more
  table-shaped variants, so the other kinds reach the emitter and crash it
  with a stack trace. The kinds reachable as a bare union member are
  `vector2`, `vector3`, `cframe`, `color3`, `colorSequence`,
  `numberSequence`, `enum`, `blob`, and `recursiveRef`. `classifyUnion`
  sorts the variants by kind name and `writeGuardedUnion` never guards the
  last one, so the crash depends on alphabetical position:
  `Vector3 | string` sorts to `str`, `vector3` and works, while
  `CFrame | string`, `Instance | string` (`blob` sorts first), and
  `interface Node { next: Node | string }` (`recursiveRef`) all throw. A
  `recursiveRef` to an object is a table at runtime, so
  `typeIs(value, "table")` would guard it. (From code reading of
  `guardFor`, `writeGuardedUnion`, and the sort in `classifyUnion`; the
  `Vector3 | CFrame` walk was executed.) `Vector2` joined this gap once
  [blob-classification.md](blob-classification.md)'s Tier A gave it a real
  `vector2` scalar kind instead of collapsing into `blob`: a
  `Vector2 | Instance`-shaped union used to collapse to a single `blob`
  (every constituent routing to `blob`) and now reaches this same
  `guardFor` gap instead, identical to how `Vector3 | Instance` already
  behaved before this fix.
- **`Packed<T>` applies to object properties only.** The emitter honors
  the `packed` flag only when it collects the `bool` properties of an
  object (`writeObjectInline`/`readObjectInline`). A packed `boolean` as an
  array element, a tuple element, or the root type is written as a full
  byte with no diagnostic. `isPackable` in `field.ts` has no caller. From
  code reading.
- **Re-aliased `Packed<T>`.** `type PackedFlags = DataType.Packed<Flags>`
  is not recognized: the alias symbol is `PackedFlags`, so
  `getPackedInnerType` returns nothing and the intersection is walked
  structurally. Result: the booleans stay byte-aligned and an extra
  `_surge_packed` field (an optional tuple, one presence byte) is
  serialized. Aliasing a number brand (`type Health = DataType.u8`) does
  work, which makes the `Packed` case surprising.
- **`createBinarySerializer()` without an explicit type argument**
  (contextually typed, `const s: Serializer<Foo> = createBinarySerializer()`)
  is not transformed (`index.ts` requires exactly one type argument) and
  fails at runtime with a message saying the transformer is not
  registered. From code reading.
- **Walk diagnostics are thrown as a plain `Error`** from `index.ts`, so
  the user sees a Node stack trace instead of a `tsc`-style diagnostic
  with a file and position. The `WalkDiagnostic.node` is collected but
  never used, and it is always the factory call expression: `walk()`
  passes the same `node` to every recursive call, so a surfaced diagnostic
  would point at `createBinarySerializer<T>()`, not at the offending
  property.
- **Injected import name collisions.** The transformer adds
  `import { alloc, beginWrite, ... } from "@rbxts/surge"` at the top of the
  file, and the generated IIFE refers to those names unqualified. A user
  file that already declares a top-level `alloc` gets a
  duplicate-identifier error; a local `alloc` in a scope enclosing the call
  site shadows the import, so the generated code silently calls the user's
  function. From code reading.

## Why deferred

Each is a small fix, but together they define the transformer's error
model (what is a diagnostic, what is a hard failure), which should be
decided once and applied consistently rather than case by case.

## How, briefly

- Use element access and string-literal property names whenever the name
  is not a valid identifier; treat numeric keys as numbers.
- Reject non-trailing rest tuples with a diagnostic.
- Extend `guardFor` with `typeIs(value, "Vector3")`/`"Vector2"`-style
  checks for the userdata kinds and `typeIs(value, "table")` for a
  `recursiveRef` to a table shape, and make `classifyUnion` reject what
  `guardFor` cannot guard (a `blob` next to a non-`blob` variant, two
  variants with the same runtime type), as a diagnostic.
- Thread the declaration of the property or element being walked into
  `report()`, so a surfaced diagnostic points at it.
- Report a diagnostic for `Packed<T>` on a `boolean` outside an object
  property, or pack it.
- Detect `Packed` through alias chains (walk `aliasSymbol`'s declared
  type) or by the `_surge_packed` brand property's declaring package.
- Transform contextually typed factory calls too (read the contextual type
  from the checker), or report a diagnostic.
- Surface `WalkDiagnostic`s as `ts.Diagnostic` objects. roblox-ts 3.0.0
  collects `transformResult.diagnostics` into its `DiagnosticService`
  (`out/Project/functions/compileFiles.js`), so a diagnostic added through
  the transformation context's `addDiagnostic` (an internal API, absent
  from `typescript.d.ts`, so it needs a cast) should reach the user with a
  file and position; confirm that before relying on it. Alias the injected
  imports (`import * as __surge from "@rbxts/surge"`).
- Tests: one walker or emitter unit test per bullet.
