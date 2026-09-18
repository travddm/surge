# Future work: transformer unit test coverage

Part of the [surge](../architecture.md) design. Lives here rather than in
`rbxts-transformer-surge` because that repository keeps only a README (see
Repository layout in [architecture.md](../architecture.md)).

## What

Step 0 (the fixture harness) has landed: `test/harness.ts` exposes
`createFixtureProgram`/`loadDeclaration`/`walkDeclaration`/`printNodes`,
`test/fixtures/rbxts-surge/` is a hand-maintained stand-in for the real
`@rbxts/surge` (kept in sync by hand -- see Repository layout in
[architecture.md](../architecture.md) for why this can't be a real
cross-repo dependency), and `@rbxts/types`/`@rbxts/compiler-types` are
dev-installed so a `noLib`/`typeRoots` program can resolve `Instance`,
`Enum.*`, `Vector3`, and sequences. `emit.ts`, `detect.ts`, and `index.ts`
each have an initial test file now
(`test/emit.test.ts`/`test/detect.test.ts`/`test/transform.test.ts`), but
coverage is still far from complete:

- **`emit.ts`:** one printed-output snapshot per `Field` kind (write and
  read statements), plus dedicated cases for the read-order fix (a
  helper-object/blob field followed by a field whose read needs a
  statement), packed-boolean padding, and enum index width/table lookup.
  Still open: the invalid output for non-identifier names in
  [walker-emitter-robustness.md](walker-emitter-robustness.md) (not
  covered by any of the current per-kind fixtures).
- **`detect.ts`:** factory detection through a direct call, an
  alias/re-export, and rejection of a same-named local are covered, as are
  `DataType.*` brand detection and `Packed<T>` unwrapping. `nearestPackageName`
  caching is still untested (would need `fs` mocking).
- **`index.ts`:** one end-to-end test per case: `createBinarySerializer`'s
  IIFE and injected import, `createSerializer`'s function-only result,
  multiple call sites sharing one injected import, a same-named local left
  untouched, and a recursive discriminated union compiling to helper
  declarations instead of crashing the transform.
- **Diagnostics** are still asserted only as `length > 0`; message text and
  the node they point at are not (the new bare-`EnumItem` diagnostic
  follows the same existing convention).
- **Missing walker cases:** `Record<number, V>`, `ReadonlyMap`/
  `ReadonlySet`, tuple rest and optional elements, literal union width
  (the u8→u16 switch above 256 values — only the value *order* is pinned
  now), TypeScript `enum`s, optional brands, index signature plus
  properties, empty objects, function properties, `toString`-named
  symbols.

## Why deferred

The remaining walker cases and the diagnostic-message assertions are each
best added alongside the fix they pin, per the implementation order in
[README.md](README.md).

## How, briefly

- Add each remaining walker case to `test/walk.test.ts` (with `{ roblox,
surge }` fixtures where needed) alongside its corresponding fix.
- Assert diagnostic messages and positions, not only counts.
- Add an `emit.test.ts`/`transform.test.ts` case alongside each emitter fix
  (walker-emitter-robustness.md) rather than trying to anticipate them
  here.
