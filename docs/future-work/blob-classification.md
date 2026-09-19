# Future work: blob classification of Instances and opaque types

Part of the [surge](../architecture.md) design.

## What

The correctness bug is fixed: `Instance` and its subclasses, `unknown`,
and every other Roblox datatype not already in the walker's scalar-kind
table or in `FIXED_DATATYPES` (`Vector2int16`, `Region3`, `TweenInfo`,
`Font`, `Ray`, `DateTime`, `buffer`, ...) now classify as `blob` instead of being walked structurally
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

Two items from the original review remain open:

- **Real encodings for the cheap datatypes**, per
  [type-coverage-parity.md](type-coverage-parity.md) Tier A. `Vector2`
  (2×f32) has landed, its own `ROBLOX_SCALAR_KINDS` entry alongside
  `Vector3`/`CFrame`/etc. The fixed-size types are rows of
  `FIXED_DATATYPES` (see Type Coverage in
  [transformer.md](../transformer.md)); item 1 of Tier A lists which have
  landed and which are open. The open ones round-trip
  correctly today via the side channel; this is a wire-size optimization,
  not a correctness fix.
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
`lune-test-runner.luau`, following its own "cast because Lune 0.10.5's type
definitions omit these constructors" pattern) round-tripping through the
blob side channel with an asserted zero-byte buffer. `roblox.spec.ts`
passes a Lune data-model `Part` through the blob channel as an `Instance`,
an optional `Part`, and an `unknown`.

## Why deferred

The two remaining items don't need the identity-based classification this
doc was blocked on; they're independent, smaller pieces of work now that
the identity check exists. [README.md](README.md) schedules the datatype
encodings with Tier A of [type-coverage-parity.md](type-coverage-parity.md),
after the byte-pinning fixtures in `bytes.spec.ts`, which have landed. The
empty-object case has no step; it waits on the `defined` decision below.

## How, briefly

- One datatype's real encoding per commit, each with a round-trip fixture
  and a byte-size assertion, per type-coverage-parity.md's own sequencing.
  Confirmed empirically (`@lune/roblox` 0.10.5, probed via a throwaway
  Lune script): `Vector3int16`, `UDim`, `UDim2`, `BrickColor`,
  `NumberRange`, and `Rect` are all available as globals the same way
  `Vector2`/`Vector3`/`CFrame`/`Color3` are, so each gets the same
  round-trip-fixture-plus-byte-size-assertion treatment. `DateTime` is
  not — `roblox.DateTime` is `nil` in that version — so its commit will
  need either a different fixture approach (Lune's own non-Roblox
  `@lune/datetime`, or a construction path this hasn't checked yet) or a
  documented gap in the Lune coverage instead of a matching fixture.
- Decide the `defined`-vs-`{}` distinction (declaration-origin check on the
  alias symbol, or leave `defined` as a documented exception) before adding
  the zero-byte empty-object encoding.
