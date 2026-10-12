# Future work: export `DataType.Width`

Part of the [surge](../architecture.md) design.

## What

`DataType.Width`, the union of the ten number width brands that constrains
`Vector<X, Y, Z>` and `Transform<X, Y, Z>`, is exported, so that a consumer
can write a type over widths, such as `interface Sample<W extends
DataType.Width> { x: W; y: W }`, and instantiate it with one. A property
whose type is `DataType.Width` itself is a diagnostic: a union of widths has
one runtime type and no encoding.

## Why

The constraint names `Width` and an editor shows it, but a consumer cannot
refer to it, so a generic shape over widths has to spell the union out.

## Why deferred

It is small. What holds it is the transformer: `getDataTypeBrand` and
`getSurgeBrand` in `rbxts-transformer-surge/src/detect.ts` take any type
alias declared in `@rbxts/surge` as a brand, so an exported `Width` reaches
the walk as a brand it does not know. It then falls through to the union
rows of Transformer 4.1, and 4.4 rejects it as ten constituents of one
runtime type, with a message about guards and not about widths. The export
lands with a diagnostic that names the widths.

## How, briefly

- `export type Width` in `surge/src/data-type.ts` and the fixture copy.
- The walk reports a `Width` brand at a property as a type with no encoding,
  naming the ten widths; `walk.test.ts` pins it, and Transformer 7.2 in
  [specs/transformer.md](../specs/transformer.md) lists it.
- Runtime API 3.9 names it among what the package exports, and
  [data-types.md](../data-types.md)'s Number widths section gets one sentence.
