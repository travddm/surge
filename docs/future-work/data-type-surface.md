# Future work: the Tier B `DataType.*` surface

Part of the [surge](../architecture.md) design. Tier B of
[type-coverage-parity.md](type-coverage-parity.md) adds `DataType` brands.
This note decides their names, their type-parameter convention, and their
defaults in one place, so that the brands still to be built match the
existing ones, which [data-types.md](../data-types.md) documents.

## What

| Brand             | Applies to        | Defaults | Why this name                                                                                                               |
| ----------------- | ----------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Range<Min, Max>` | `number`          | none     | serio's concept, spelled as a brand. Narrows to the smallest width that fits, and validates on write.                       |
| `Quantized<T>`    | `CFrame` rotation | none     | serio's 18-byte form. Lossy, so opt-in only, per Deliberate non-gaps in [type-coverage-parity.md](type-coverage-parity.md). |

`Transform<X, Y, Z>` sets only a `CFrame`'s position widths, and leaves the
rotation an axis-angle f32 triple (Wire format 7.1 in
[specs/wire-format.md](../specs/wire-format.md)). serio writes a 6-byte
quantized rotation instead, and `Quantized<T>` is how a consumer asks for
that form on purpose. What it loses in precision is measured in
[serialized-size-across-libraries.md](../research/serialized-size-across-libraries.md).

Three Tier B items need no brand:

- A bit-packed set of a fixed member list (Blink's `set`) is
  `Packed<Set<"a" | "b" | ...>>`, a composition of what already exists.
- Opt-in validation is the factory's `checks` and `writeChecks` options, not
  a type. `writeChecks` rejects lengths and counts on `serialize` (Runtime
  API 3.10 in [specs/runtime-api.md](../specs/runtime-api.md)), and
  `Range<Min, Max>` adds a value's range to what it rejects.
- **`AlignedCFrame` is dropped.** `Packed<T>` already gives a `CFrame` the
  1-, 13-, or 25-byte form, which is Zap's 13-byte form plus a smaller case
  and a fallback. Zap asserts on a rotation its table misses, which is the
  defect that leaves it with no cell at all on the benchmark's axis-aligned
  row (the measurements under the matrix in
  [type-coverage-parity.md](type-coverage-parity.md)). Adopting that contract
  would be taking the worse of the two behaviors, and a brand that only moved
  the same encoding outside `Packed<T>` would buy nothing.

## The convention

Every brand follows these five rules. They exist so that a later brand does
not have to invent an answer.

1. A brand is `T & { readonly _surge_<name>?: ... }`. It erases to `T`, so an
   unbranded value still assigns to a branded field.
2. Parameters are types, never values. A width is one of the existing width
   brands; a count or a bound is a numeric literal type.
3. The first parameter is the value type. Configuration follows it. A brand
   that fixes its own value type, as `Vector<X, Y, Z>` and
   `Transform<X, Y, Z>` do, takes configuration only, and so is never the
   outer brand of a composition.
4. **Every parameter has a default, and a brand with all of its defaults
   encodes exactly what the unbranded type encodes.** This is what keeps
   every pinned buffer in `bytes.spec.ts` green as each brand lands.
5. A brand applies to the type it wraps, not to that type's subtree.
   `Packed<T>` is the one exception and stays the only one.

A default is part of the brand, never a project-wide setting in
`tsconfig.json`: two projects compiled with different settings could not
exchange bytes, and nothing in the type would say so. A brand is not named
after a TypeScript global such as `String`, `Map` or `Set`: declared inside
`namespace DataType`, it would shadow the global for the rest of the
namespace body.

## Why deferred

No measured gap requires `Range<Min, Max>`, `Quantized<T>` or the bit-packed
set. The size gap to Blink and Zap is count width alone, which `Length<T, L>`
covers, and serio's smaller `CFrame` is quantization, paid for in precision
([serialized-size-across-libraries.md](../research/serialized-size-across-libraries.md)).

## How, briefly

- A new parameterized brand is one row of `PARAMETERIZED_BRANDS` in the
  transformer's `detect.ts`. `getSurgeBrand` then resolves it by alias
  identity before any brand property, as Transformer 4.3 in
  [specs/transformer.md](../specs/transformer.md) states for the existing
  brands, and by its brand property for a re-alias. `walk.test.ts` pins both
  orders of a composition.
- `writeChecks` examines lengths and counts, not values. An integer width
  truncates and wraps a value outside it (Wire format 4.15), and writes a NaN
  or an infinity as 0, without raising (measured under Lune 0.10.5).
  `Range<Min, Max>` is what would reject them.
- `Range<Min, Max>` and an explicit width brand can disagree. The explicit
  width wins, and a range that does not fit it is a diagnostic rather than a
  silent widening.
- Order: `Range<Min, Max>`, then `Quantized<T>`. The bit-packed set depends
  on neither.
