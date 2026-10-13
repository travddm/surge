# Future work: the rotation's width as `Transform`'s fourth parameter

Part of the [surge](../architecture.md) design.

## What

`DataType.Transform<X = f32, Y = X, Z = X, R extends f32 | i16 = f32>` sets a
`CFrame`'s position widths, as it does today, and with `R` the width of each
component of its rotation: `f32` writes the axis-angle of Wire format 4.8,
and `i16` the quantized form of Wire format 7.4
([specs/wire-format.md](../specs/wire-format.md)). `DataType.Quantized<T>`
is removed: `Quantized<CFrame>` becomes `Transform<f32, f32, f32, i16>`, and
`Quantized<Transform<i16>>` becomes `Transform<i16, i16, i16, i16>`. The
all-default brand writes what a bare `CFrame` writes, as rule 4 of the brand
rules asks. No bytes change.

## Why

A `CFrame` takes two brands today, and neither name says which part it
configures: `Transform` sets the position's widths and `Quantized` the
rotation's precision, and the two compose as `Quantized<Transform<i16>>`.
That composition is the only one a user writes between two brands other than
`Packed`, and `Quantized` is the only brand that applies to one Roblox type
and is named for a technique rather than for what it sets. One brand with
one parameter per part of the value is the shape `Vector<X, Y, Z>` already
has.

## Why deferred

It removes a brand, so it lands before the first release. `Quantized` landed
with the brand step and has one catalog row, so the cost of the change is
small now and grows with every consumer.

## How, briefly

- `surge/src/data-type.ts` and the fixture copy gain the fourth parameter,
  recorded in `_surge_transform` with the other three, and lose `Quantized`;
  `PARAMETERIZED_BRANDS` in `rbxts-transformer-surge/src/detect.ts` loses its
  row.
- `walkTransform` in `rbxts-transformer-surge/src/walk.ts` reads the fourth
  argument and sets the `cframe` field's `quantized` flag that `walkQuantized`
  sets today, so `field.ts` and the emitter are unchanged. Inside `Packed<T>`,
  a fourth argument other than the default is the diagnostic that `Quantized`
  reports there today.
- Wire format 7.4 restates the quantized rotation as the fourth parameter,
  and 4.8 and 8.6 name `Transform` alone. Transformer 4.1's two brand rows
  become one, 4.3 lists five brands, 4.15 is withdrawn, and 7.2 follows.
  [data-types.md](../data-types.md)'s Vector and CFrame widths section and
  [supported-types.md](../supported-types.md)'s `CFrame` row follow.
- `walk.test.ts`'s `Quantized<T>` block moves into the `Transform` block, and
  `bytes.spec.ts`, `roblox.spec.ts` and the catalog's quantized `CFrame` row
  spell the new form. The size table does not change, since the bytes do not.
- Open: whether `R` should admit a width other than `f32` and `i16`. Today's
  two forms are the two the code writes; a third is a wire-format decision of
  its own.
