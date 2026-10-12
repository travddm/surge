# Future work: an `Exact<T, N>` brand for the exact form of `Length`

Part of the [surge](../architecture.md) design.

## What

`DataType.Exact<T, N extends number>` takes over the exact form of
`DataType.Length<T, L>`: no count is written, and both sides use exactly `N`
bytes or elements (Wire format 6.3, 6.6 and 6.7 in
[specs/wire-format.md](../specs/wire-format.md)). `Length<T, L>` keeps only
the count widths, so its constraint `L extends u8 | u16 | u24 | u32` is the
whole truth, and a number literal there is a diagnostic that names `Exact`.
The bytes of both forms do not change.

## Why

One brand carries two encodings today, and the constraint names only one of
them: a number literal satisfies `u8 | u16 | u24 | u32` because each brand
is `number` with an optional property, so the exact form is discoverable from
the prose alone. The two forms also differ in what they promise. The width
form writes a count and wraps or raises past it; the exact form writes
nothing, truncates or pads a value of another length, is rejected on a
`Map`, a `Set` or a `Record`, and is compared with `!==` or `>` under
`writeChecks` (Transformer 5.14 in
[specs/transformer.md](../specs/transformer.md)). A name of its own gives
each form its own sentence in every document and its own diagnostics.

## Why deferred

It renames a documented form, so it lands before the first release. The
branch that found it only moved the exact form to the front of `Length`'s
JSDoc.

## How, briefly

- `surge/src/data-type.ts` and the fixture copy in
  `rbxts-transformer-surge/test/fixtures/rbxts-surge/data-type.ts` declare
  `Exact<T, N extends number> = T & { readonly _surge_exact?: [T, N] }`, which
  follows the brand rules in [coding-standards.md](../coding-standards.md):
  the value type first, and `N` with no default, as `Length`'s `L` has none.
- `PARAMETERIZED_BRANDS` in `rbxts-transformer-surge/src/detect.ts` gains the
  row, and the walk's `Length` branch splits: `walkLength` parses a width only,
  and a new `walkExact` parses the literal and calls `withLength` with the
  number, so the `Field` tree and the emitter are unchanged.
- Wire format 6.1 to 6.8 name `Exact` where they say "a whole number
  literal"; Transformer 4.1, 4.3, 5.14, 5.18, 5.19, 5.22 and 7.2 follow, and
  Runtime API 3.10 and 3.11. [data-types.md](../data-types.md)'s Counts
  section becomes two, and [supported-types.md](../supported-types.md)'s
  sentence on `Length` names both.
- The tests that spell the exact form, in `walk.test.ts`, `bytes.spec.ts`,
  `checks.spec.ts` and `collections.spec.ts`, spell `Exact` instead, and
  `walk.test.ts` gains the diagnostic for a literal under `Length`.
