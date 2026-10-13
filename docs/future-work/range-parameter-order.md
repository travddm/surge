# Future work: `Range<Min, Max, T = number>`

Part of the [surge](../architecture.md) design.

## What

`DataType.Range` takes its bounds first and its value type last, with
`number` as the default: `Range<0, 100>` where today's form is
`Range<number, 0, 100>`, and `Range<0, 100, DataType.u16>` where it is
`Range<DataType.u16, 0, 100>`. The width each form chooses, and the bytes,
do not change (Wire format 4.16 in
[specs/wire-format.md](../specs/wire-format.md)).

## Why

The value type is noise in the common case: `number` asks surge to choose
the narrowest width, which is what a reader wants most of the time, and the
bounds are what the reader is looking for. Every other brand's first
parameter is the type it wraps, but for `Range` that type is almost always
`number`.

## Why deferred

It breaks rule 3 of the brand rules in
[coding-standards.md](../coding-standards.md), which puts the value type
first so that `getSurgeBrand` in `rbxts-transformer-surge/src/detect.ts` can
find the outermost brand of a re-aliased composition: it checks whether a
brand's first argument still carries the other brands' properties
(Transformer 4.3 in [specs/transformer.md](../specs/transformer.md)). With
`Range`'s value type last, that check needs each brand to say where its
inner type is. It changes a documented spelling, so it lands before the
first release, if at all; `Range` is new, and how often it is written is not
yet known.

## How, briefly

- `_surge_range?: [Min, Max, T]` in `surge/src/data-type.ts` and the fixture
  copy, with `T extends number = number`.
- Each row of `PARAMETERIZED_BRANDS` names the index of its inner type, 0
  for every brand but `Range`, and `getSurgeBrand` reads that index instead
  of `args[0]`. `walkRange` reads its arguments in the new order and treats
  a missing third as `number`.
- Rule 3 in [coding-standards.md](../coding-standards.md) gains the
  exception and the reason. Wire format 4.16 and 4.17, Runtime API 3.10 and
  3.11, Transformer 4.1, 4.3, 4.14 and 7.2, [data-types.md](../data-types.md)
  and [errors-and-guarantees.md](../errors-and-guarantees.md) spell the new
  form, as do the `Range` block of `walk.test.ts`, `bytes.spec.ts`,
  `checks.spec.ts` and `numbers.spec.ts`.
