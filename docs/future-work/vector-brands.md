# Future work: `Vector2D<X, Y>` and `Vector3D<X, Y, Z>`

Part of the [surge](../architecture.md) design.

## What

- `DataType.Vector<X, Y, Z>` is renamed `DataType.Vector3D<X, Y, Z>`:
  `Vector3D<DataType.i16>` where today's form is `Vector<DataType.i16>`. Its
  bytes do not change.
- `DataType.Vector2D<X, Y>` sets the widths of a `Vector2`'s components, as
  `Vector3D` does for a `Vector3`'s. `Y` defaults to `X`, and `X` to `DataType.f32`,
  so the all-default brand writes what a bare `Vector2` writes (Wire format 4.6
  in [specs/wire-format.md](../specs/wire-format.md)).
- `DataType.f64` is not a component width of `Vector2D`, `Vector3D` or
  `Transform`.
  A `Vector2`, a `Vector3` and a `CFrame` hold `f32` components, so an `f64`
  component writes 4 bytes more and keeps nothing `f32` does not.

```ts
interface Cursor {
	screen: DataType.Vector2D<DataType.i16>; // 4 bytes where a Vector2 is 8
	world: DataType.Vector3D<DataType.i16, DataType.u16>; // Z defaults to X
}
```

## Why

- **Names.** `Vector` does not say which vector, and a brand for `Vector2`
  beside it needs a name that does. `Vector2` and `Vector3` themselves cannot
  be brands: `@rbxts/types` declares both as globals, and a brand is not named
  after a global it would shadow in the namespace
  ([coding-standards.md](../coding-standards.md)). `Vector2D` and `Vector3D`
  name the type each configures without shadowing it.
- **`Vector2D`.** A `Vector2` is a screen, UI or 2D-world position: sent in
  volume and often bounded, where `i16` components halve it.
- **No `f64`.** A component width wider than what the value holds only adds
  bytes. Every width brand is a `number`, so the constraint cannot leave
  `DataType.f64` out, and the transformer reports it instead.

No other Roblox datatype takes a brand. The components of `UDim`, `UDim2`,
`NumberRange`, `Rect` and `NumberSequence` are written at the widths Roblox's
binary place format uses for them
([rbx-dom's binary format specification](https://dom.rojo.space/binary.html)):
a `UDim`'s `f32` `Scale` and `i32` `Offset`, and `f32` for the others. So
each default is exact, and an integer width could narrow only the parts that
are not fractions. A `Color3`, and a `ColorSequence` keypoint's color, stay 3×`u8`
(Wire format 4.9): exact for every color built from 8-bit channels, such as
`Color3.fromRGB`'s.

## Why deferred

The rename and the `f64` exclusion change a documented spelling and reject
a shape that compiles today, so they land before the first release.
`Vector2D` alone could land at any time, since a new brand changes no
existing byte (rule 4 of the brand rules), but it shares the rename's code.

## How, briefly

- `surge/src/data-type.ts` declares `Vector3D`, recorded in `_surge_vector3d`,
  and `Vector2D`, in `_surge_vector2d`, each width constrained by `Width`, as
  `Vector`'s are today. `PARAMETERIZED_BRANDS` in `rbxts-transformer-surge/src/detect.ts`
  names both brands.
- In `rbxts-transformer-surge/src/walk.ts`, `componentWidths` takes a count
  of components, and reports `DataType.f64` for all three brands, so one rule
  covers every brand that sets component widths.
  [transform-rotation.md](transform-rotation.md) reuses `componentWidths`.
  The `vector2` field gains the component widths `vector3` has.
- In `emit/`, a `vector2` is written and read through the component path a
  `vector3` takes, in place of `writeNum2` and `readVector2` at `f32`, and its
  sizes in `layout.ts` and its locals under `writeChecks` (Transformer 5.5)
  count its widths.
- Wire format 4.6, 4.7 and 7.1 to 7.3 name both brands. Transformer 4.1, 4.3,
  5.5, 5.14, 7.2 and 8, [specs/runtime-api.md](../specs/runtime-api.md)'s
  mention of `Vector`, and rule 3 of the brand rules in
  [coding-standards.md](../coding-standards.md) follow.
  [data-types.md](../data-types.md)'s example and its Vector and CFrame widths
  section, [supported-types.md](../supported-types.md)'s `Vector2`, `Vector3`
  row, and [errors-and-guarantees.md](../errors-and-guarantees.md)'s Two
  options table and Writing values section, follow.
- `walk.test.ts`'s `Vector` block covers both brands and `DataType.f64`,
  and its `Transform` block `DataType.f64`;
  `bytes.spec.ts` pins a `Vector2D`; `checks.spec.ts` and `roblox.spec.ts`
  cover its integer widths. Every other use of `DataType.Vector` in the code,
  its comments and its tests spells `Vector3D`. The JSDoc of `writeChecks` in
  `surge/src/serializer.ts` also names `Vector2D`. No byte of the size table
  changes.
