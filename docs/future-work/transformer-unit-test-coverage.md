# Future work: transformer unit test coverage

Part of the [surge](../architecture.md) design. Lives here rather than in
`rbxts-transformer-surge` because that repository keeps only a README (see
Repository layout in [architecture.md](../architecture.md)).

## What

`rbxts-transformer-surge/test/walk.test.ts` holds eight tests, all for
`TypeWalker`. The rest of the transformer has none:

- **`emit.ts` (1,500 lines, the largest file in either repo): zero
  tests.** Nothing checks the TypeScript the emitter produces, so the
  ordering bug in [read-order-side-effects.md](read-order-side-effects.md)
  and the invalid output for non-identifier names in
  [walker-emitter-robustness.md](walker-emitter-robustness.md) had nowhere
  to fail. A printed-output snapshot per `Field` kind (via
  `ts.createPrinter`, as the review's probes did) is cheap and would pin
  statement order, helper generation, and import tracking.
- **`detect.ts`: zero tests.** Factory detection through aliases and
  re-exports, rejection of a same-named local, `nearestPackageName`
  caching, and `DataType` brand detection are all untested. The design
  says these were confirmed by a spike that has since been deleted.
- **`index.ts`: zero tests.** No end-to-end test runs the transformer
  factory over a source file and prints the result: IIFE shape,
  `createSerializer` vs `createBinarySerializer` result, the injected
  import, multiple call sites in one file, helper scoping.
- **Brands are untestable in the current harness.** `loadDeclaration`
  builds a program with no `@rbxts/surge` package, so `DataType.*` and
  `Packed<T>` cannot appear in a fixture. The review probed them by adding
  `surge/src/data-type.ts` to the program (its nearest `package.json` is
  `@rbxts/surge`); a checked-in fixture package under `test/fixtures/`
  would do the same reproducibly.
- **Roblox types are untestable in the current harness.** No `@rbxts/types`
  in the program, so `Instance`, `Enum.*`, `Vector3`, and sequences cannot
  be walked in a test. A `noLib` program with `typeRoots` pointing at a
  checked-in or dev-installed `@rbxts/types` fixes that.
- **Diagnostics** are asserted only as `length > 0`; message text and the
  node they point at are not.
- **Missing walker cases:** generic instantiations, recursive unions,
  `Record<number, V>`, `ReadonlyMap`/`ReadonlySet`, tuple rest and
  optional elements, literal unions (order and width), TypeScript `enum`s,
  optional brands, index signature plus properties, empty objects, function
  properties, `toString`-named symbols, discriminant selection with two
  candidates, two-program determinism.

## Why deferred

Building the fixture packages (`@rbxts/surge` stub, `@rbxts/types`) is a
harness change that should precede the individual tests, and most tests
are best added alongside the fix they pin.

## How, briefly

- `test/harness.ts`: `createFixtureProgram(files, { roblox, surge })`
  wrapping today's `loadDeclaration`, with the two fixture packages.
- `test/emit.test.ts`: per-kind printed snapshots of write and read
  statements, plus statement-order assertions.
- `test/detect.test.ts` and `test/transform.test.ts` for the two untested
  modules.
- Assert diagnostic messages and positions, not only counts.
