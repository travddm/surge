# Future work: string literals for a brand's widths and forms

Part of the [surge](../architecture.md) design.

## What

A brand's configuration parameters are literal types. A width or a form is a
string literal type, and a count or a bound is a number literal type, as it
is today. A `DataType` member is a type a value can have, such as
`DataType.u32` or `DataType.Packed<T>`. `DataType.Width` stays the one
exception, as a union that names no single width.

This change states the rule and respells `Length`'s count width:

```ts
DataType.Length<string[], "u8">; // today: DataType.Length<string[], DataType.u8>
DataType.Length<string, 8>; // unchanged, until exact-length-brand.md moves it to Exact
```

The other brands with a width parameter are respelled in their own changes:
`Vector3D` and `Vector2D` in [vector-brands.md](vector-brands.md),
`Transform` in [transform-rotation.md](transform-rotation.md), and `Range` in
[range-parameter-order.md](range-parameter-order.md). A property's width stays
a brand: `tick: DataType.u32`. No byte changes.

## Why

- **TypeScript checks the constraint.** Each width brand is `number` with an
  optional property, so any number type satisfies a constraint over them.
  TypeScript accepts `Length<string[], DataType.f32>`,
  `Length<string[], number>` and `Vector<DataType.i16, 7>` today, and only
  the transformer rejects them, when the project builds. No string literal is
  assignable to another, so once a parameter admits only string literals, each
  of these is an error in the editor, and completion in the parameter offers
  only the values its constraint admits. `Length`'s parameter admits only
  them once [exact-length-brand.md](exact-length-brand.md) lands, and
  `Vector3D`'s once [vector-brands.md](vector-brands.md) does.
- **One rule separates the two.** A type a value can have is a `DataType`
  member, and what configures a brand is a literal.
- **Shorter.** `Vector3D<"i16">`, where today's form is
  `Vector<DataType.i16>`.

What it costs:

- A width has two spellings, by position: `DataType.i16` as a property's type
  and `"i16"` as a parameter. Once a parameter admits only string literals,
  the editor rejects the other spelling, and the error names the constraint's
  alias, such as `CountWidth`, rather than the strings it admits.
- A literal shows nothing on hover, so each brand's JSDoc states what each of
  its values writes.
- A generic type that uses one width both as a property's type and as a
  parameter needs a map from the name to the brand, which this change does not
  add.

## Why deferred

It respells a documented brand, so it lands before the first release. It
lands first among the API changes before that release
([README.md](README.md)), since the brands the others change spell their
parameters by its rule.

## How, briefly

- `surge/src/data-type.ts` declares `Length<T, L extends CountWidth | number>`,
  where `CountWidth` is `"u8" | "u16" | "u24" | "u32"`, an alias the namespace
  does not export. TypeScript 5.5.3 emits such an alias into the declaration
  file. `| number` keeps the exact form until
  [exact-length-brand.md](exact-length-brand.md) moves it. `Length`'s JSDoc
  states what each width writes.
- `walkLength` in `rbxts-transformer-surge/src/walk.ts` reads a string
  literal width or a number literal, and any other `L` is a diagnostic, whose
  text names the string widths where it names `DataType.u8` and the other
  brands today.
- Rule 2 of the brand rules in [coding-standards.md](../coding-standards.md)
  states the rule above and why. Wire format 6.2, Transformer 4.1, 4.3, 4.11,
  7.2 and 8, and Runtime API 3.10 spell the string widths, as do
  [data-types.md](../data-types.md)'s opening sample, Counts section, paragraph
  on `DataType.Width` and Combining brands section, and
  [getting-started.md](../getting-started.md)'s sample.
- `walk.test.ts`, `detect.test.ts`, `transform.test.ts`, `bytes.spec.ts`,
  `checks.spec.ts`, `collections.spec.ts`, `recursion.spec.ts` and
  `strings.spec.ts` spell the string widths, as do a comment in `detect.ts`
  and one in `walk.ts`. No
  emitted code changes, so neither the size table nor the code-size table
  does.
- Open: exporting the unions of widths and forms, for a generic type that
  passes one through, and a `DataType.Num<W>` that maps a width's name to its
  brand. Each is additive, so each waits for a user who needs it. Until then
  such a type spells the union itself.
