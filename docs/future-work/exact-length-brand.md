# Future work: an `Exact<T, N>` brand for the exact form of `Length`

Part of the [surge](../architecture.md) design.

## What

`DataType.Exact<T, N extends number>` takes over the exact form of
`DataType.Length<T, L>`: no count is written, and both sides use exactly `N`
bytes or elements (Wire format 6.3, 6.6 and 6.7 in
[specs/wire-format.md](../specs/wire-format.md)). `Length<T, L>` keeps only
the count widths, `DataType.u8` to `DataType.u32`, and the transformer reports
a number literal there, naming `Exact`. A width brand is a `number`, so
TypeScript accepts a number literal under the constraint, and only the build
rejects it. The bytes of both forms do not change.

## Why

One brand carries two encodings, and one parameter takes both: `Length`'s
`L` is a count width or a whole number literal. The two forms differ in what
they promise. The width form writes a count and wraps or raises past it; the
exact form writes nothing, truncates or pads a value of another length, is
rejected on a `Map`, a `Set` or a `Record`, and is compared with `!==` or `>`
under `writeChecks` (Transformer 5.14 in
[specs/transformer.md](../specs/transformer.md)). A name of its own gives
each form its own sentence in every document and its own diagnostics.

## Why deferred

It renames a documented form, so it lands before the first release.

## How, briefly

- `surge/src/data-type.ts` declares
  `Exact<T, N extends number> = T & { readonly _surge_exact?: [T, N] }`, which
  follows the brand rules in [coding-standards.md](../coding-standards.md):
  the value type first, and `N` with no default, as `Length`'s `L` has none.
- `PARAMETERIZED_BRANDS` in `rbxts-transformer-surge/src/detect.ts` gains the
  row, and the walk's `Length` branch splits: `walkLength` parses a width only,
  and a new `walkExact` parses the literal and calls `withLength` with the
  number, so the `Field` tree and the emitter are unchanged.
- Wire format 6.1 to 6.8 name `Exact` where they say "a whole number
  literal"; Transformer 4.1, 4.3, 5.14, 5.19, 5.20, 5.21, 5.22, 7.2 and 8
  follow, and Runtime API 3.10 and 3.11, `Length`'s JSDoc in
  `surge/src/data-type.ts`, which documents the exact form today, and the
  JSDoc of `writeChecks` in `surge/src/serializer.ts`. [data-types.md](../data-types.md)'s opening
  sample and its Counts section, which becomes two,
  [errors-and-guarantees.md](../errors-and-guarantees.md)'s Two options table
  and Writing values section, and
  [supported-types.md](../supported-types.md)'s sentence on `Length` name
  both.
- The tests that spell the exact form, in `walk.test.ts`, `transform.test.ts`,
  `bytes.spec.ts`, `checks.spec.ts` and `collections.spec.ts`, spell `Exact` instead, and
  `walk.test.ts` gains the diagnostic for a number literal under `Length`.
