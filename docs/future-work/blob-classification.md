# Future work: blob classification of Instances and opaque types

Part of the [surge](../architecture.md) design.

## What

The correctness bug is fixed: `Instance` and its subclasses, `unknown`,
and every other Roblox datatype not already in the walker's scalar-kind
table (`Vector2`, `UDim`, `UDim2`, `BrickColor`, `NumberRange`, `Rect`,
`Vector3int16`, `Region3`, `TweenInfo`, `Font`, `Ray`, `DateTime`, `buffer`,
...) now classify as `blob` instead of being walked structurally. The fix
is identity-based, not name-matching: `@rbxts/types` brands `Instance`
(and every subclass) and every datatype interface with its own uniquely
named `_nominal_<TypeName>: unique symbol` property (`isRobloxNominalType`
in `detect.ts`), and the walker routes any type carrying one, declared in
`@rbxts/types`, to `blob` before any structural check can reach its
declared properties (`walk.ts`). `ROBLOX_SCALAR_KINDS` (`Vector3`, `CFrame`,
`Color3`, `ColorSequence`, `NumberSequence`) was the one name-matching spot
this design already had; it's now gated on the same `@rbxts/types`
declaration-origin check, so a user-declared `interface Vector3 { foo:
string }` no longer misclassifies as the Roblox scalar.

The other silent misclassifications are fixed with a diagnostic (the
walker's existing `report()`/`WalkDiagnostic` mechanism, not the `tsc`-style
surfacing tracked in [walker-emitter-robustness.md](walker-emitter-robustness.md))
instead of a silent `blob`: function types (detected via
`checker.getSignaturesOfType`, covering both plain function-typed fields
and methods), `symbol`, `bigint`, `null`, template literal types, and a
type with both declared properties and an index signature. Each points the
caller at `unknown` as the explicit opt-in. A union where every constituent
resolves to `blob` (for example `BasePart | Model`, which share the
inherited `_nominal_Instance` brand) collapses to one `blob` instead of a
`guardedUnion`, which would otherwise hit `guardFor`'s missing `"blob"`
case — walker-emitter-robustness.md's gap, made reachable by this fix, so
narrowly closed here rather than left as a new regression.

Tests: `test/walk.test.ts` in the transformer repo covers `Instance`, an
`Instance` subclass, an `Instance`-subclass union, an uncovered datatype
(`Vector2`), `unknown`, the `Vector3`-name-collision case, and one
diagnostic fixture per silently-misclassified kind above.

Two items from the original review remain open:

- **Real encodings for the cheap datatypes**, per
  [type-coverage-parity.md](type-coverage-parity.md) Tier A: `Vector2`
  (2×f32), `Vector3int16` (3×i16), `UDim` (f32 + i32 or i16), `UDim2`
  (2×`UDim`), `BrickColor` (u16 `.Number`), `NumberRange` (2×f32), `Rect`
  (4×f32), `DateTime` (f64 `UnixTimestampMillis`), raw `buffer` (u32 len +
  bytes). They round-trip correctly today via the side channel; this is a
  wire-size optimization, not a correctness fix.
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

`tests/`'s own `coverage.spec.ts` now has an end-to-end fixture,
`roundTripsUnencodedDatatypeAsAnOpaqueBlob`: a real Lune `Vector2` (the
Lune runner didn't expose it as a global before this doc; added alongside
`CFrame`/`Vector3`/`Color3` in `lune-test-runner.luau`, following its own
"cast because Lune 0.10.5's type definitions omit these constructors"
pattern) round-trips through the blob side channel with an asserted
zero-byte buffer, confirmed against the real compiled transformer output
(`npm run tests:compile && npm run tests:test`), not just the transformer
repo's own unit tests. No `Instance` fixture: the Lune runner's
`Instance.new` shim only builds `BindableEvent`
([walker-emitter-robustness.md](walker-emitter-robustness.md) territory,
not this doc's), so no fixture can construct a real `Instance` there.

## Why deferred

The two remaining items don't need the identity-based classification this
doc was blocked on; they're independent, smaller pieces of work now that
the identity check exists.

## How, briefly

- One datatype's real encoding per commit, each with a round-trip fixture
  and a byte-size assertion, per type-coverage-parity.md's own sequencing.
- Decide the `defined`-vs-`{}` distinction (declaration-origin check on the
  alias symbol, or leave `defined` as a documented exception) before adding
  the zero-byte empty-object encoding.
