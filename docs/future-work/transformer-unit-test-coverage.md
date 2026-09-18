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
  read statements). This pins each kind's current output, including the
  known ordering bug in
  [read-order-side-effects.md](read-order-side-effects.md) (not exercised
  by these single-field snapshots, which don't have a second field for a
  read to desync against) and the invalid output for non-identifier names
  in [walker-emitter-robustness.md](walker-emitter-robustness.md) (not
  covered by any of the current per-kind fixtures). Neither has a
  regression test yet.
- **`detect.ts`:** factory detection through a direct call, an
  alias/re-export, and rejection of a same-named local are covered, as are
  `DataType.*` brand detection and `Packed<T>` unwrapping. `nearestPackageName`
  caching is still untested (would need `fs` mocking).
- **`index.ts`:** one end-to-end test per case: `createBinarySerializer`'s
  IIFE and injected import, `createSerializer`'s function-only result,
  multiple call sites sharing one injected import, and a same-named local
  left untouched. Helper scoping for a recursive type is not covered here
  (see [recursive-union-types.md](recursive-union-types.md) and
  [walk-type-identity.md](walk-type-identity.md) for where recursive-type
  tests land).
- **Diagnostics** are still asserted only as `length > 0`; message text and
  the node they point at are not.
- **Missing walker cases:** generic instantiations, recursive unions,
  `Record<number, V>`, `ReadonlyMap`/`ReadonlySet`, tuple rest and
  optional elements, literal unions (order and width), TypeScript `enum`s,
  optional brands, index signature plus properties, empty objects, function
  properties, `toString`-named symbols, discriminant selection with two
  candidates, two-program determinism.

## Why deferred

The remaining walker cases and the diagnostic-message assertions are each
best added alongside the fix they pin, per the implementation order in
[README.md](README.md).

## How, briefly

- Add each remaining walker case to `test/walk.test.ts` (with `{ roblox,
surge }` fixtures where needed) alongside its corresponding fix.
- Assert diagnostic messages and positions, not only counts.
- Add an `emit.test.ts`/`transform.test.ts` case alongside each emitter fix
  (read-order-side-effects.md, walker-emitter-robustness.md) rather than
  trying to anticipate them here.
