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
  statement), packed-boolean padding, enum index width/table lookup,
  non-identifier property names, the `typeIs` guard of each datatype,
  enum, and recursive-object union variant, and the block splitting for
  the local-register limit (object and tuple).
- **`detect.ts`:** factory detection through a direct call, an
  alias/re-export, and rejection of a same-named local are covered, as are
  `DataType.*` brand detection and `Packed<T>` unwrapping (direct and
  re-aliased). `nearestPackageName`
  caching is still untested (would need `fs` mocking; the function is not
  exported).
- **`index.ts`:** one end-to-end test per case: `createBinarySerializer`'s
  IIFE and injected import, `createSerializer`'s function-only result,
  multiple call sites sharing one injected import, a same-named local left
  untouched, a recursive discriminated union compiling to helper
  declarations instead of crashing the transform, a walk diagnostic
  surfacing as a `ts.Diagnostic` at the offending property, a factory call
  without a type argument, and a user declaration named after an injected
  import. `transform.test.ts` also type-checks the transformed file in a
  second program, as roblox-ts does before it emits: one case per shape
  whose generated code used to fail that check, and one shape that holds
  every common kind. The stub `@rbxts/surge` declares the runtime exports
  for this (`test/fixtures/rbxts-surge/runtime.ts`).
- **Diagnostics** from before the union, tuple, and position work are
  still asserted only as `length > 0` (nine assertions in `walk.test.ts`,
  none on message text or the node), so one of those can regress to a
  misleading message with every test passing. The newer cases assert the
  message text, and one asserts the node.
- **Missing walker cases:** `Record<number, V>`, `ReadonlyMap`/
  `ReadonlySet`, literal union width
  (the u8→u16 switch above 256 values — only the value _order_ is pinned
  now; the enum width switch is covered), TypeScript `enum`s, optional
  brands (no `DataType.u8`-style brand appears in `test/` at all), empty
  objects, and a non-function property named `toString`. Covered since
  [blob-classification.md](blob-classification.md) landed: index signature
  plus properties, function properties, and a `toString` method. Covered
  since the walker and emitter robustness fixes landed: tuple rest
  (trailing, leading, middle) and optional elements, numeric and quoted
  property names, and the accepted and rejected union shapes.

## Why deferred

The remaining walker cases and the diagnostic-message assertions are each
best added alongside the fix they pin, per the implementation order in
[README.md](README.md).

## How, briefly

- Add each remaining walker case to `test/walk.test.ts` (with `{ roblox,
surge }` fixtures where needed) alongside its corresponding fix.
- Assert diagnostic messages and positions, not only counts.
- Add an `emit.test.ts`/`transform.test.ts` case alongside each emitter
  fix rather than trying to anticipate them here.
