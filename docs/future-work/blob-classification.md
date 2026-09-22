# Future work: blob classification of Instances and opaque types

Part of the [surge](../architecture.md) design.

## What

The correctness bug is fixed: `Instance` and its subclasses, `unknown`,
and every other Roblox datatype not already in the walker's scalar-kind
table or in `FIXED_DATATYPES` (`Vector2int16`, `Region3`, `TweenInfo`,
`Font`, `Ray`, ...) now classify as `blob` instead of being walked
structurally
(`unknown` and `any` as `optional(blob)`, because they can hold
`undefined`; see Blob / passthrough channel in
[transformer.md](../transformer.md)). The fix
is identity-based, not name-matching: `@rbxts/types` brands `Instance`
(and every subclass) and every datatype interface with its own uniquely
named `_nominal_<TypeName>: unique symbol` property (`isRobloxNominalType`
in `detect.ts`), and the walker routes any type carrying one, declared in
`@rbxts/types`, to `blob` before any structural check can reach its
declared properties (`walk.ts`). `ROBLOX_SCALAR_KINDS` (`Vector2`,
`Vector3`, `CFrame`, `Color3`, `ColorSequence`, `NumberSequence`) was the
one name-matching spot this design already had; it's now gated on the same
`@rbxts/types` declaration-origin check, so a user-declared `interface
Vector3 { foo: string }` no longer misclassifies as the Roblox scalar.

The other silent misclassifications are fixed with a diagnostic (the
walker's `report()`/`WalkDiagnostic` mechanism, surfaced as a
`ts.Diagnostic`; see Transformer Design §8 in
[transformer.md](../transformer.md)) instead of a silent `blob`: function types (detected via
`checker.getSignaturesOfType`, covering both plain function-typed fields
and methods), `symbol`, `bigint`, `null`, template literal types, and a
type with both declared properties and an index signature. Each points the
caller at `unknown` as the explicit opt-in. A union where every constituent
resolves to `blob` (for example `BasePart | Model`, which share the
inherited `_nominal_Instance` brand) collapses to one `blob` instead of a
`guardedUnion`. A `blob` next to any other variant (`Instance | string`)
is rejected with a diagnostic, because an opaque value has no runtime type
for the write side to check.

Tests: `test/walk.test.ts` in the transformer repo covers `Instance`, an
`Instance` subclass, an `Instance`-subclass union, an uncovered datatype
(`Vector2`), `unknown`, the `Vector3`-name-collision case, and one
diagnostic fixture per silently-misclassified kind above.

One item from the original review remains open (the other, real
encodings for the cheap datatypes, has landed):

- ~~**Real encodings for the cheap datatypes**~~, per
  [type-coverage-parity.md](type-coverage-parity.md) Tier A. Landed:
  `Vector2` has its own kind, the fixed-size types are rows of
  `FIXED_DATATYPES`, and `buffer` has its own kind (see Type Coverage in
  [transformer.md](../transformer.md)).
- **An empty object type (`{}`, `interface Empty {}`) still classifies as
  `blob`** instead of a zero-byte object. Deferred, not merely unimplemented:
  `@rbxts/compiler-types` declares `type defined = {}`, so a bare structural
  check can't tell "the user meant an empty object" from "the user meant
  `defined`, i.e. any non-nil value" — and encoding the latter as a
  zero-byte object would deserialize a `defined` field holding a primitive
  (`5`, `"str"`) back as `{}`, silently discarding it. Needs a way to
  distinguish the two (for example gating on `aliasSymbol.name === "defined"`
  declared in `@rbxts/compiler-types`, mirroring the `@rbxts/types`
  declaration-origin checks above) before it's safe to implement.

`tests/`'s own `coverage.spec.ts` now has two end-to-end fixtures.
`roundTripsVector2` round-trips a real Lune `Vector2` through the new
`vector2` scalar kind with an asserted 8-byte (2×f32) buffer, confirmed
against the real compiled transformer output (`npm run tests:compile &&
npm run tests:test`), not just the transformer repo's own unit tests.
`roundTripsUnencodedDatatypeAsAnOpaqueBlob` covers the still-unencoded case
with a real Lune `Vector2int16` (`Vector3int16` until that type got its
own encoding; the Lune runner didn't expose either type
as a global before this doc; added alongside `CFrame`/`Vector3`/`Color3` in
the Lune runner's fake-Instance shim, following its own "cast because Lune
0.10.5's type definitions omit these constructors" pattern) round-tripping through the
blob side channel with an asserted zero-byte buffer. `roblox.spec.ts`
passes a Lune data-model `Part` through the blob channel as an `Instance`,
an optional `Part`, and an `unknown`.

## Why deferred

The empty-object case doesn't need the identity-based classification this
doc was blocked on. It has no step in [README.md](README.md); it waits on
the `defined` decision below.

## How, briefly

- Decide the `defined`-vs-`{}` distinction (declaration-origin check on the
  alias symbol, or leave `defined` as a documented exception) before adding
  the zero-byte empty-object encoding.
