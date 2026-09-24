# Future work: types the walk mishandles

Part of the [surge](../architecture.md) design.

## What

Five kinds of type reach the transformer's walk and come out wrong. Each is a
known defect in [specs/transformer.md](../specs/transformer.md), and each was
reproduced by running the walk and the transform on a fixture:

- **A type parameter** (4.8, 4.9). `createBinarySerializer<T>()` inside a
  generic function transforms with no diagnostic. An unconstrained `T` walks
  to `blob`, so the value passes through the blob channel unencoded. A `T`
  constrained to an object type walks as the constraint, so the generated
  code writes the constraint's properties and silently drops every other
  property of the type the function is called with. This one loses data.
- **`void`, `undefined` and `never`** (4.8) walk to `blob` with no
  diagnostic, because they have no properties. A plain `blob` has no presence
  byte, so a property holding `undefined` pushes nothing, and `deserialize`
  reads every later blob one position early, then raises past the end of
  `inputBlobs`.
- **A user type named `Map`, `ReadonlyMap`, `Set` or `ReadonlySet`** (4.10)
  matches the `dict` row by name. With no type arguments, the walk passes
  `undefined` on as the key type and the transformer throws a `TypeError`,
  so the build fails with a stack trace instead of a diagnostic.
- **A cycle through arrays or tuples alone** (4.11), such as
  `type Nest = Nest[]` or `type Tree = [number, Tree[]]`, recurses until the
  stack overflows, and the transformer throws.
- **A union of tuples of different lengths** (4.12) is classified as a
  `taggedUnion` on `length`. The walk then walks each tuple's inherited
  `Array` methods and reports dozens of diagnostics about function types,
  none of which names the actual problem.

## Why deferred

The specification review found them after the code had landed. Each is a
transformer change with its own tests, and all but the type parameter fail
the build rather than produce wrong bytes. The constrained type parameter is
the exception and should go first.

## How, briefly

- **Type parameters.** Report a diagnostic when the type argument, or any
  type the walk reaches, has `TypeFlags.TypeParameter`: a serializer is
  generated for one concrete type, so a call site inside a generic function
  cannot have one. This covers 4.9 and the type-parameter half of 4.8.
- **`void`, `undefined`, `never`.** `undefined` and `void` alone can be a
  `literalConst` of `undefined`, which writes nothing and is correct on both
  sides. `never` is a diagnostic. `{}`, `object` and `defined` stay `blob` by
  design; whether an empty object type should encode as zero bytes instead is
  [blob-classification.md](blob-classification.md).
- **`Map` and `Set` by name.** Gate `isMapType` and `isSetType` in the
  transformer's `src/walk.ts` on the declaration coming from
  `@rbxts/compiler-types`, which declares all four, the way the scalar table
  gates on `isFromTypesPackage`. `isFromPackage` in `src/detect.ts` already
  does the check. A user type of the same name then walks as an object.
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
