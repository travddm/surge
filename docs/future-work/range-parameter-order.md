# Future work: `Range<Min, Max, W = "auto">`

Part of the [surge](../architecture.md) design.

## What

`DataType.Range` takes its bounds first and its width last, as a string
literal ([literal-parameters.md](literal-parameters.md)), with `"auto"` as the
default:

```ts
DataType.Range<0, 100>; // today: DataType.Range<number, 0, 100>
DataType.Range<0, 100, "u16">; // today: DataType.Range<DataType.u16, 0, 100>
DataType.Range<0, 1, "f32">; // today: DataType.Range<DataType.f32, 0, 1>
```

`"auto"` chooses the narrowest whole-number width that holds the range, as
`number` does today. The width each form chooses, and the bytes, do not
change (Wire format 4.16 in [specs/wire-format.md](../specs/wire-format.md)).

## Why

- The bounds are what a reader is looking for, and the width is most often
  left to surge. Every other brand's first parameter is the type it wraps, but
  for `Range` that type is always a number.
- With its width a string, `Range` fixes its own value type, `number`, as
  `Vector3D` and `Transform` do. Rule 3 of the brand rules in
  [coding-standards.md](../coding-standards.md) then covers it as it stands:
  such a brand takes configuration only and is never the outer brand of a
  composition, so `getSurgeBrand` in `rbxts-transformer-surge/src/detect.ts`
  needs no change to find the outer brand. With its value type last instead,
  that function would need each brand to say where its inner type is.
- The default is a named value, not `never`, because the editor's hover shows
  it: `Range<0, 100, "auto">` where `never` would show
  `Range<0, 100, never>`.

## Why deferred

It changes a documented spelling, so it lands before the first release. It
lands after [literal-parameters.md](literal-parameters.md), whose rule its
width follows.

## How, briefly

- `surge/src/data-type.ts` and the fixture copy declare
  `Range<Min extends number, Max extends number, W extends RangeWidth | "auto" = "auto">`
  as `number & { readonly _surge_range?: [Min, Max, W] }`. `RangeWidth` is
  every width's name, `"f64"` included, and an alias the namespace does not
  export.
- `walkRange` in `rbxts-transformer-surge/src/walk.ts` reads its arguments in
  the new order and treats `"auto"` as it treats `number` today. No width brand
  sits under a `Range` any more, so `getSurgeBrand`'s comment on one goes.
- Rule 3 names `Range` beside `Vector3D` and `Transform`, and rule 4's
  sentence on `Range` spells the new form. Wire format 4.16 and 4.17, Runtime
  API 3.10 and 3.11, Transformer 4.1, 4.3, 4.14, 7.2 and 8,
  [data-types.md](../data-types.md),
  [errors-and-guarantees.md](../errors-and-guarantees.md) and the JSDoc of
  `writeChecks` in `surge/src/serializer.ts` spell the new form, as do the
  `Range` blocks of `walk.test.ts`, `detect.test.ts` and `transform.test.ts`,
  and `bytes.spec.ts`, `checks.spec.ts` and `numbers.spec.ts`.
