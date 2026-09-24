# Future work: types the walk mishandles

Part of the [surge](../architecture.md) design.

## What

Three kinds of type reach the transformer's walk and come out wrong. Each is
a known defect in [specs/transformer.md](../specs/transformer.md), and each
was reproduced by running the walk and the transform on a fixture:

- **`void`, `undefined` and `never`** (4.8) walk to `blob` with no
  diagnostic, because they have no properties. A plain `blob` has no presence
  byte, so a property holding `undefined` pushes nothing, and `deserialize`
  reads every later blob one position early, then raises past the end of
  `inputBlobs`.
- **A cycle through arrays or tuples alone** (4.11), such as
  `type Nest = Nest[]` or `type Tree = [number, Tree[]]`, recurses until the
  stack overflows, and the transformer throws.
- **A union of tuples of different lengths** (4.12) is classified as a
  `taggedUnion` on `length`. The walk then walks each tuple's inherited
  `Array` methods and reports dozens of diagnostics about function types,
  none of which names the actual problem.

## Why deferred

The specification review found them after the code had landed. Each is a
transformer change with its own tests. The cycle and the tuple union fail the
build rather than produce wrong bytes; `void`, `undefined` and `never` build,
and an `undefined` one makes `deserialize` raise.

## How, briefly

- **`void`, `undefined`, `never`.** `undefined` and `void` alone can be a
  `literalConst` of `undefined`, which writes nothing and is correct on both
  sides. `never` is a diagnostic. `{}`, `object` and `defined` stay `blob` by
  design; whether an empty object type should encode as zero bytes instead is
  [blob-classification.md](blob-classification.md).
- **Cycles through arrays and tuples.** `walkArrayOrTuple` records nothing in
  `inProgress`; only `tryWalkObject` and `walkUnion` do. Either extend the
  recursion helpers to array and tuple types, which makes these shapes work,
  or record them in progress and report a diagnostic, which makes them fail
  cleanly. The helper route needs `ensureHelper` to handle an array field.
- **Tuple unions.** In `classifyUnion`, leave tuple and array types out of the
  constituents that can carry a discriminant, so the union reaches the
  `guardedUnion` path and its "two or more table-shaped constituents"
  diagnostic.
- Pin each with a `walk.test.ts` case, then remove the known-defect
  statement it closes from the specification.
