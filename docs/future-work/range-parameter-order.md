# Future work: `Range<Min, Max, W = number>`

Part of the [surge](../architecture.md) design.

## What

`DataType.Range` takes its bounds first and its width last, with `number` as
the default:

```ts
DataType.Range<0, 100>; // today: DataType.Range<number, 0, 100>
DataType.Range<0, 100, DataType.u16>; // today: DataType.Range<DataType.u16, 0, 100>
DataType.Range<0, 1, DataType.f32>; // today: DataType.Range<DataType.f32, 0, 1>
```

`number` chooses the narrowest whole-number width that holds the range, as
it does today in `Range`'s first place. A plain `number` outside a `Range` is
still `f64`. The width each form chooses, and the bytes, do not change (Wire
format 4.16 in [specs/wire-format.md](../specs/wire-format.md)).

## Why

- The bounds are what a reader is looking for, and the width is most often
  left to surge. Every other brand that wraps a value type takes it first,
  but for `Range` that type is always a number.
- `Range` then fixes its own value type, `number`, and its width becomes
  configuration, as `Vector`'s and `Transform`'s widths are. Rule 3 of the
  brand rules in [coding-standards.md](../coding-standards.md) covers it as it
  stands: such a brand takes configuration only and is never the outer brand
  of a composition, so `getSurgeBrand` in
  `rbxts-transformer-surge/src/detect.ts` needs no change to find the outer
  brand.

## Why deferred

It changes a documented spelling, so it lands before the first release.

## How, briefly

- `surge/src/data-type.ts` declares
  `Range<Min extends number, Max extends number, W extends Width | number = number>`
  as `number & { readonly _surge_range?: [Min, Max, W] }`.
- `walkRange` in `rbxts-transformer-surge/src/walk.ts` reads its arguments in
  the new order, and reads a `W` of `number` as it reads a `T` of `number`
  today. No width brand sits under a `Range` any more, so `getSurgeBrand`'s
  comment on one goes.
- Rule 3 names `Range` beside `Vector` and `Transform`, and rule 4's
  sentence on `Range` spells the new form. Wire format 4.1, 4.15, 4.16 and
  4.17, Runtime API 3.10 and 3.11, Transformer 4.1, 4.3, 4.14, 5.14, 7.2 and
  8,
  [data-types.md](../data-types.md),
  [errors-and-guarantees.md](../errors-and-guarantees.md) and the JSDoc of
  `writeChecks` in `surge/src/serializer.ts` spell the new form, as do the
  `Range` blocks of `walk.test.ts`, `detect.test.ts` and `transform.test.ts`,
  and `bytes.spec.ts`, `checks.spec.ts` and `numbers.spec.ts`.
