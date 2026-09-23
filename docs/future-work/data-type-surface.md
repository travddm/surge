# Future work: the Tier B `DataType.*` surface

Part of the [surge](../architecture.md) design. Tier B of
[type-coverage-parity.md](type-coverage-parity.md) adds several brands that
land at different times. This decides their names, their type-parameter
convention, and their defaults in one place, so the ones that land later
match the ones that land first.

## What

Today `DataType` is ten width brands plus `Packed<T>`
(`@rbxts/surge`'s `src/data-type.ts`). Tier B adds bounds, per-component
widths, and ranges, which a TypeScript type has nowhere to put without a
helper type.

| Brand                | Applies to                                                  | Defaults                | Why this name                                                                                         |
| -------------------- | ----------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `Length<T, L>`       | `string`, array, `Map`/`Set`/`Record`, `buffer`, tuple rest | `L = u32`               | One brand for one concept: all five write one count today. See The container brand below.             |
| `Vector<X, Y, Z>`    | `Vector3`                                                   | `X = f32, Y = X, Z = X` | serio's name and its defaulting. No TypeScript global to shadow.                                      |
| `Transform<X, Y, Z>` | `CFrame` position                                           | `X = f32, Y = X, Z = X` | serio's name, and its parameters mean the same thing. See the note below.                             |
| `Range<Min, Max>`    | `number`                                                    | none                    | serio's concept, spelled as a brand. Narrows to the smallest width that fits, and validates on write. |
| `Quantized<T>`       | `CFrame` rotation                                           | none                    | serio's 18-byte form (~0.05 rad). Lossy, so opt-in only, per Deliberate non-gaps.                     |

`Transform<X, Y, Z>` sets the position's component widths, exactly as serio's
does. What it does not carry over is serio's rotation: surge writes an
axis-angle f32 triple where serio writes its 6-byte quantized one, so the same
brand costs 24 bytes here and 18 there. That difference is not the brand's —
surge's plain `CFrame` already differs from serio's plain `CFrame` the same
way — and `Quantized<T>` is how a consumer asks for serio's form on purpose.

Three Tier B items need no brand:

- A bit-packed set of a fixed member list (Blink's `set`) is
  `Packed<Set<"a" | "b" | ...>>`, a composition of what already exists.
- Opt-in write and read validation is a factory or compiler option, not a
  type: see [deserialize-hardening.md](deserialize-hardening.md).
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
3. The first parameter is the value type. Configuration follows it.
4. **Every parameter has a default, and a brand with all of its defaults
   encodes exactly what the unbranded type encodes today.** This is what
   keeps every pinned buffer in `bytes.spec.ts` green as each brand lands.
5. A brand applies to the type it wraps, not to that type's subtree.
   `Packed<T>` is the one exception and stays the only one.

## The container brand

`Length<T, L>` rather than serio's four (`String<L>`, `List<T, L>`,
`HashMap<K, V, L>`, `HashSet<T, L>`):

- surge's IR already treats the prefix as one concept. `str`, `array`,
  `dict`, `buffer`, and a tuple's `rest` all write one u32 count, and
  `dict`'s `source` (`map | set | record`) does not affect the encoding.
- Inside `namespace DataType`, `String`, `Map`, and `Set` shadow the
  TypeScript globals for the rest of the namespace body. serio's
  `HashMap`/`HashSet` are that collision worked around; one brand avoids it.
- A `Record` gets a bound for free, which serio cannot express.

The cost is that an fbs or serio migrant does not find `String<u16>` by name.
That is worth one brand instead of five.

`L` is either a width brand or a numeric literal. `Length<string[], u16>` is a
u16 count; `Length<string[], 8>` is the exact form Blink and Zap have, with no
prefix written at all. Both are types, and `isNumberLiteral()` separates them
in the walker, so one brand covers both forms.

Outermost only: `Length<string[][], u16>` bounds the outer array. Reaching an
inner one means branding the inner type. This is the deliberate difference
from `Packed<T>`, which does propagate — a propagating length has no way to
say different widths at different depths.

## The default is u32, and it is documented rather than assumed

Blink and Zap default an unbounded string, array, and map to u16, and
[benchmarks/size.md](../benchmarks/size.md) shows every byte they save against
surge is that prefix and nothing else. Matching them by default would close
the whole measured gap at once.

Either default is defensible, and the choice is close. What makes it safe
either way is that the default is stated to the consumer and overridable one
container at a time, which `Length<T, L>` is whichever way it falls. Given
that, u32 wins on two things that are not about bandwidth:

- Rule 4. u32 is what an unbranded container writes today, so every pinned
  buffer in `bytes.spec.ts` stays green and no existing wire format moves.
- A u16 default truncates a container above 65535 entries, and nothing
  detects it until write-side validation lands (a later Tier B item, and
  [deserialize-hardening.md](deserialize-hardening.md)). A u32 default has no
  matching failure: its cost is two bytes, paid visibly.

So the trade is two bytes per container against a silent ceiling, and a
consumer takes the two bytes back per container with `Length<T, u16>`.

**The default is therefore user documentation, not an implementation
detail.** `docs/usage.md` has to state what an unbranded string, array, map,
set, `Record`, `buffer`, and tuple rest each cost, and that `Length<T, L>` is
how to change it; see [documentation-gaps.md](documentation-gaps.md).

A project-wide default in `tsconfig.json` is rejected: two projects compiled
with different settings could not exchange bytes, and nothing in the type
would say so.

## Implementation notes

- `getDataTypeBrand` (the transformer's `detect.ts`) returns the alias name
  only. A parameterized brand also needs `aliasTypeArguments`, plus the
  brand-property fallback for a re-alias
  (`type Ids = DataType.Length<string[], u16>`), which carries its own
  `aliasSymbol`. `getPackedInnerType` already has both paths; they generalize.
- **Every brand's alias-identity check must run before any brand-property
  fallback.** `Length<Packed<T>, u16>` is
  `T & { _surge_packed?: [T] } & { _surge_length?: ... }`. `walk()` calls
  `getPackedInnerType` first; its alias check sees `Length` and misses, then
  its property fallback finds `_surge_packed` and returns `T`, dropping the
  length brand with no error. Today `Packed` is the only brand with a
  fallback, so this cannot happen; it appears with the second one. The other
  order, `Packed<Length<T, u16>>`, is safe: the alias check matches `Packed`,
  and the `Length<T, u16>` it recurses into carries no `_surge_packed`. Write
  the failing order's test first.
- The IR (`field.ts`): `str`, `array`, `dict`, `buffer`, and `tuple`'s `rest`
  each take an optional length width. Absent means u32, per rule 4.
- Exact-length semantics, which the note fixes because the emitter cannot.
  `buffer.writestring(b, pos, s, N)` writes N **bytes**, not characters, and
  `s.size()` is bytes. Measured under Lune 0.10.5: a value longer than N is
  truncated silently, and a shorter one raises `string length overflow`.
  Until write validation lands, that is the contract.
- `Range<Min, Max>` and an explicit width brand can disagree. The explicit
  width wins, and a range that does not fit it is a diagnostic rather than a
  silent widening.

## Order

Length-typed containers first: they are the whole of the measured size gap.
Then `Vector` and `Transform`, then `Range`, then `Quantized`.

`Length<T, L>`'s width form has landed, over all five counting kinds, with
`getSurgeBrand` resolving every brand by alias identity before any brand
property. What is left of this item is the exact-length form above. Nothing
in the checked-in catalog moved: `bytes.spec.ts` pins an unbranded and a
fully defaulted shape to the same bytes, and
[benchmarks/size.md](../benchmarks/size.md) regenerated unchanged.
