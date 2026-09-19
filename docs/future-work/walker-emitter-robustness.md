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
  throws a plain `Error` for a `vector2`/`vector3`/`cframe`/`enum`/
  `optional` variant, and `classifyUnion` does not count these as
  table-shaped, so `Vector3 | CFrame` reaches the emitter and crashes with
  a stack trace instead of a diagnostic. `Vector3 | string` only works
  because the userdata variant happens to come last in the checker's
  constituent order and the last variant is never guarded. (Both walks
  were executed: `Vector3 | CFrame` produces a `guardedUnion` of `vector3`
  then `cframe`, which `guardFor` rejects; the emitter throw itself is
  from code reading.) `Vector2` joined this gap once
  [blob-classification.md](blob-classification.md)'s Tier A gave it a real
  `vector2` scalar kind instead of collapsing into `blob`: a
  `Vector2 | Instance`-shaped union used to collapse to a single `blob`
  (every constituent routing to `blob`) and now reaches this same
  `guardFor` gap instead, identical to how `Vector3 | Instance` already
  behaved before this fix.
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
  never used.
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
  checks for the userdata kinds and make `classifyUnion` reject what
  `guardFor` cannot guard, as a diagnostic.
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
