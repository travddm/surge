# Future work: the rotation's form as `Transform`'s last argument

Part of the [surge](../architecture.md) design.

## What

`DataType.Transform` sets a `CFrame`'s position widths, as it does today,
and with its last argument the form of its rotation:

| Form                    | Rotation bytes | Written as                                               | Round trip                      |
| ----------------------- | -------------- | -------------------------------------------------------- | ------------------------------- |
| `"Matrix"`, the default | 36             | the nine rotation components of `GetComponents`, 9×`f32` | exact                           |
| `"AxisAngle"`           | 12             | the axis-angle of today's Wire format 4.8, 3×`f32`       | within about 2e-7 per component |
| `"Quantized"`           | 6              | the axis-angle as 3×`i16`, today's Wire format 7.4       | within about 1e-4 radians       |

The widths come first, and the first form ends them:

```ts
DataType.Transform; // f32 position, "Matrix": 48 bytes, what a bare CFrame writes
DataType.Transform<"AxisAngle">; // today's 24-byte CFrame
DataType.Transform<DataType.i16>; // i16 position, "Matrix": 42 bytes
DataType.Transform<DataType.i16, "Quantized">; // today's Quantized<Transform<i16>>: 12 bytes
DataType.Transform<DataType.i16, DataType.i32, "AxisAngle">; // Z defaults to X, as today
```

`DataType.Quantized<T>` is removed. A bare `CFrame` writes the `"Matrix"`
form, as rule 4 of the brand rules asks of the all-default brand, so it is
48 bytes where it is 24 today.

Inside `Packed<T>`, the form sets how a rotation that is not axis-aligned is
written (rotation code 31 of Wire format 8.6), and a width other than the
default stays a diagnostic. A packed `CFrame` is 1, 13, 37 or 49 bytes with
`"Matrix"`, 1, 13 or 25 with `"AxisAngle"` as today, and 1, 7, 13 or 19 with
`"Quantized"`.

`f64` is not a component width of `Transform`, as
[vector-brands.md](vector-brands.md) states for every brand that sets
component widths.

## Why

- **Exact by default.** A `CFrame` holds twelve `f32`s, so the twelve numbers
  `GetComponents` returns, written as `f32` and read into one `CFrame.new`,
  should give back the `CFrame` that was written. The axis-angle form gives back one
  within about 2e-7 per component, and `==` against the original can fail. A
  plain `number` is `f64` for the same reason: a silently lossy default is
  the wrong trade
  ([research/type-coverage-across-libraries.md](../research/type-coverage-across-libraries.md)).
  Roblox's binary place format writes a `CFrame` the same way: an ID for each
  of the 24 axis-aligned rotations, and nine `f32`s for any other
  ([rbx-dom's binary format specification](https://dom.rojo.space/binary.html)).
- **Probably faster.** Flamework 2 writes this form, and encodes and decodes
  the `CFrame` array faster than surge
  ([research/enum-and-cframe-rows.md](../research/enum-and-cframe-rows.md)).
  surge's own write from `GetComponents` measured slower in the same paper,
  but it turned the matrix into an axis-angle in Luau, which this form does
  not. Neither run measures surge's code in this form.
- **One brand for one value.** Today a `CFrame` takes two brands, and neither
  name says which part it configures: `Transform` sets the position's widths
  and `Quantized` the rotation's precision, composed as
  `Quantized<Transform<i16>>`. That composition is the only one a user writes
  between two brands other than `Packed`, and `Quantized` is the only brand
  named for a technique rather than for what it sets.
- **Short where it matters.** With `"Matrix"` the default, `"AxisAngle"` is
  the opt-out a shape that counts bytes writes, so it is
  `Transform<"AxisAngle">`, not `Transform<f32, f32, f32, "AxisAngle">`.
- **String literals, not `DataType` members.** A string literal is never
  assignable to a width brand, so the declaration's constraints reject a
  width after a form, a second form, and an unknown one in the editor. The
  width brands are each assignable to the others, so no constraint can do the
  same for them. A `DataType.Quantized` form would also read as the brand it
  replaces.

Rejected: a quaternion, 4×`f32`, 28 bytes with the position. It removes the
trigonometry from the read, but it is no more exact than the axis-angle, and
its write needs the conversion from the matrix in Luau that measured slower.
`"Matrix"` is exact and converts nothing; `"AxisAngle"` is smaller.

## Why deferred

It removes a brand, changes a documented spelling, and changes the bytes of
every unbranded `CFrame` and of a packed one's rotation that is not
axis-aligned, so it lands before the first release. It waits on one check
that only Roblox can run: the round-trip suite runs under Lune, whose
`CFrame` is its own implementation.

## How, briefly

- First, in Studio: a `CFrame` written as the twelve `f32`s of
  `GetComponents` and read with `CFrame.new` of the twelve compares `==` to
  the original, for random rotations, the 24 axis-aligned ones, and rotations
  built with `CFrame.Angles`, `CFrame.lookAt` and `CFrame.fromMatrix`. If it
  does not, the default is decided again before anything else here lands.
- `surge/src/data-type.ts` and the fixture copy declare the forms and
  `Transform`, and lose `Quantized`; `PARAMETERIZED_BRANDS` in
  `rbxts-transformer-surge/src/detect.ts` loses its row. This declaration
  type-checked with TypeScript 5.5.3, on the five spellings above,
  `Transform<i16, i32, u8, "Quantized">`, and four misuses that each failed:

    ```ts
    export type Rotation = "AxisAngle" | "Quantized" | "Matrix";
    export type Transform<
    	X extends Width | Rotation = f32,
    	Y extends (X extends Rotation ? never : Width | Rotation) = X extends Rotation ? never : X,
    	Z extends ([X | Y] extends [Width] ? Width | Rotation : never) = [X | Y] extends [Width] ? X : never,
    	R extends ([X | Y | Z] extends [Width] ? Rotation : never) = [X | Y | Z] extends [Width] ? "Matrix" : never,
    > = CFrame & { readonly _surge_transform?: [X, Y, Z, R] };
    ```

- `walkTransform` in `rbxts-transformer-surge/src/walk.ts` reads the
  arguments in order: widths up to the first string literal, which is the
  form, and `never` after it. The `cframe` field's `quantized` flag becomes a
  `rotation` of the three forms, and `walkQuantized` is removed.
- `writeCFrame` in `emit/write.ts` takes the twelve numbers from one
  `GetComponents` call for `"Matrix"`, and `readCFrame` in `emit/read.ts`
  reads twelve numbers into one `CFrame.new`. Transformer 5.5 counts the
  twelve locals the write declares, where it counts five today, so fewer
  `CFrame`s share a run. `cframeBytes` and the rotation constants in
  `emit/constants.ts` follow.
- `writePackedCFrame` and `readPackedCFrame` in `surge/src/cframe.ts` write
  and read rotation code 31 in the field's form, which the generated call
  passes; whether that is an argument or one function per form is measured.
  `PACKED_CFRAME_MAX_BYTES` and the `readChecks` bound of Transformer 5.12
  follow the form. The 1e-6 snap of Wire format 8.7 stays: a rotation that
  close to axis-aligned comes back as the aligned one even under
  `"Matrix"`, and [data-types.md](../data-types.md)'s Packing section says
  so.
- Wire format 4.8 states the `"Matrix"` form and its components' order, 7.4
  the three forms, and 8.6 the packed sizes and the form inside a packed
  subtree. Transformer 4.1's two brand rows become one, 4.3 drops
  `Quantized`, 4.15 is withdrawn, and 5.5, 5.12, 5.27, 7.2 and 8 follow. Rule
  2 of the brand rules in [coding-standards.md](../coding-standards.md) admits
  a string literal type for a choice among named forms, and rule 3 spells the
  new `Transform`. [specs/runtime-api.md](../specs/runtime-api.md)'s mention
  of `Transform`, [data-types.md](../data-types.md)'s Vector and CFrame widths
  and Packing sections, [supported-types.md](../supported-types.md)'s `CFrame`
  row, [schema-fingerprint.md](schema-fingerprint.md)'s list of flags, and
  the `CFrame` note of
  [generated-code-performance.md](generated-code-performance.md) follow.
- `walk.test.ts`'s `Quantized<T>` block moves into the `Transform` block,
  with each spelling and each misuse. `bytes.spec.ts` pins each form and the
  packed sizes, and `roblox.spec.ts` round-trips each, the `"Matrix"` form
  by `==`. In the catalog, surge's `CFrame` rows write `"Matrix"`, the
  quantized row spells `Transform<"Quantized">`, and a surge cell keeps
  today's `"AxisAngle"` form measured, which
  [specs/benchmark-harness.md](../specs/benchmark-harness.md) records. The
  hand-written codec writes surge's bytes (Benchmark harness 4.5), so it
  writes `"Matrix"` too. `mise run bench:size`, `bench:code` and a full
  `bench:speed` re-record the tables, and a paper under
  [research/](../research/README.md) records what the new default costs and
  saves on the `CFrame` rows.
