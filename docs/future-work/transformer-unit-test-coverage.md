# Future work: transformer unit test coverage

Part of the [surge](../architecture.md) design.

## What

The transformer's Jest suites ([testing.md](../testing.md)) leave these cases
open:

- **Diagnostic messages.** Nine cases in `walk.test.ts` assert only
  `diagnostics.length > 0`, not the message text or the node: the seven in
  `TypeWalker blob classification`, the one in `TypeWalker bare EnumItem`,
  and the two-table-shaped-variants case in `TypeWalker classification`. Any
  of them can regress to a misleading message with every test passing.
- **Walker cases:** `Record<number, V>`; the built-in `ReadonlyMap` and
  `ReadonlySet` as a `dict` (only a user type of those names is pinned); a
  TypeScript `enum` (`transform.test.ts` type-checks a string enum's
  generated code, but no walk case classifies one); an optional brand, such
  as `a?: DataType.u8`; an empty object type other than `defined`, such as
  `interface Empty {}`; and a property named `toString` that is not a method.
- **Emitter case:** a `literal` of more than 256 values, whose index is `u16`
  (Wire format 4.13 in [specs/wire-format.md](../specs/wire-format.md)). Only
  the value order is pinned; the `enum` width switch is covered.
- **`detect.ts`:** the cache in `nearestPackageName` is untested. A test would
  need `fs` mocking, and the function is not exported.

## Why deferred

The remaining cases and the diagnostic-message assertions are each best added
alongside the fix they pin, per the implementation order in
[README.md](README.md).

## How, briefly

- Add each remaining walker case to `test/walk.test.ts` (with
  `{ roblox, surge }` fixtures where needed) alongside its corresponding fix.
- Assert diagnostic messages and positions, not only counts.
- Add an `emit.test.ts`/`transform.test.ts` case alongside each emitter fix
  rather than trying to anticipate them here.
