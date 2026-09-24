# Type coverage across fbs, serio, Blink and Zap

2026-09-18 to 2026-09-24 · surge `86f729b` · rbxts-transformer-surge `c8481d3` ·
source reading at pinned commits; Lune 0.10.5 for the measured cells

## Abstract

This compares what surge and four other Roblox serializers can express, and
what each costs on the wire, type by type, to find the gaps surge had to close
to replace fbs and to stand beside Blink and Zap. It is read from each
library's source at a pinned commit, except for the cells the benchmark
harness has since measured, which are marked. surge now expresses every row
the other four do, except f8, f16, f24 and the 12-bit widths, Blink's and
Zap's event framing, and serio's common-value tables, each left out for a
reason stated below. Where surge writes more bytes than
Blink or Zap, the difference is a default count width, which a shape can now
narrow.

## Background

surge started as a replacement for fbs: the same `DataType` branding, so that
a call site migrates with an import change, and code generated at compile time
in place of fbs's runtime schema interpreter. A replacement has to express
what fbs expresses. serio is the other interpreter reached through a
Flamework macro, and Blink and Zap are the IDL compilers a Roblox developer
would weigh against both. Which types each can express, and at what cost in
bytes, decided the list of gaps surge closed: first the Roblox datatypes and
widths it lacked, then the `DataType` brands that let a type state a bound an
IDL states directly.

## Method

**Source reading.** Each library's facts come from its source at a pinned
commit, not from executing it:

| Library                                    | Version | Commit    | Kind                                                              |
| ------------------------------------------ | ------- | --------- | ----------------------------------------------------------------- |
| `@rbxts/flamework-binary-serializer` (fbs) | 0.7.0   | `a7af287` | Flamework macro; runtime schema interpreter                       |
| `@rbxts/serio` (serio, `R-unic/serio`)     | 1.2.7   | `1313e44` | Flamework macro; runtime schema interpreter                       |
| Blink (`1Axen/blink`)                      | 0.18.8  | `73695d1` | Luau IDL compiler (runs under Lune); networking layer included    |
| Zap (`red-blox/zap`)                       | 0.6.29  | `8cd17ab` | Rust IDL compiler; networking layer included; no standalone codec |

**Measured cells.** The benchmark harness
([../specs/benchmark-harness.md](../specs/benchmark-harness.md)) runs all
five libraries under Lune 0.10.5 and records their bytes in
[../benchmarks/size.md](../benchmarks/size.md). Its rows confirm Blink's and
Zap's u16 default for a string, an array and a map length, and measured the
`CFrame` cells listed under the matrix
([serialized-size-across-libraries.md](serialized-size-across-libraries.md)).

**surge's column** is executed: the transformer's walker tests classify each
type, and [../specs/wire-format.md](../specs/wire-format.md) states its bytes.
It describes rbxts-transformer-surge `c8481d3` and the surge commit that
publishes this paper, whose parent is `86f729b`. A Roblox datatype with its
own encoding is written into the buffer (Wire format 4.6 to 4.11); one without
routes to the blob channel by its `_nominal_*` brand (Transformer 4.1 in
[../specs/transformer.md](../specs/transformer.md)).

**Libraries not compared** were surveyed from each project's repository and
package listing in September 2026. A library earns a column by being one a
consumer would plausibly choose instead of surge, and by expressing enough of
the benchmark catalog for its cells to mean something.

## Results

### Coverage matrix

Byte costs are for the unpacked, unbounded form unless noted. "Side" means
the value travels in the side table (`blobs` / `outgoing_inst`) at zero
buffer bytes.

| Type                   | surge                                                                   | fbs                                     | serio                                              | Blink                                             | Zap                                          |
| ---------------------- | ----------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------- | ------------------------------------------------- | -------------------------------------------- |
| plain `number`         | f64                                                                     | f64                                     | **f32**                                            | n/a (IDL widths)                                  | n/a (IDL widths)                             |
| fixed widths           | u8..u32, i8..i32 (incl. 24), f32, f64                                   | same                                    | same plus u12/u24/i12/i24/f8/f16/f24 (software)    | same plus f16 (software)                          | same                                         |
| numeric ranges         | `Range<T, Min, Max>`: narrows; rejected by `writeChecks`                | none                                    | brand-range asserts, NaN rejected                  | validation only, no narrowing                     | asserts only (`write_checks`), no narrowing  |
| boolean                | 1 byte; 1 bit in `Packed`                                               | 1 byte; 1 bit in `Packed`               | 1 byte; 1 bit in `Packed`                          | 1 byte, never packed                              | **1 bit always** (per-scope mask)            |
| optional               | 1 byte; 1 bit in `Packed`                                               | 1 byte; 1 bit in `Packed`               | 1 byte; 1 bit in `Packed`                          | 1 byte                                            | 1 bit                                        |
| string                 | u32 len + bytes                                                         | u32 len + bytes                         | len width from `String<L>` (default u32)           | u8/u16/u32 by bound (default u16); exact: no len  | same as Blink; utf8 vs binary; exact: no len |
| array                  | u32 count                                                               | u32 count                               | `List<T, L>` (default u32)                         | u8/u16/u32 by bound (default u16); exact unrolled | same; exact unrolled                         |
| tuple                  | fixed inline; trailing rest u32                                         | fixed inline; rest u32 (written first)  | fixed inline; rest **broken** (u16 write/u32 read) | event tuples only                                 | n/a                                          |
| map                    | u32 count                                                               | u32 count                               | `HashMap<K, V, L>` (default u32)                   | u16 count, unvalidated                            | 1 presence bit + `count-1` at key width      |
| set                    | u32 count; 1 bit per literal member in `Packed`                         | u32 count                               | `HashSet<T, L>` (default u32)                      | **bit-packed flag set** (fixed members)           | as map, keys only                            |
| object / struct        | name-sorted fields, no header                                           | emit-order fields (unstable, issue #16) | emit-order fields (unverified)                     | declaration order                                 | declaration order                            |
| literal union          | u8/u16 index (canonical value order)                                    | u8/u16 index                            | u8/u16 index                                       | unit `enum`: u8                                   | unit `enum`: bits or index                   |
| single literal         | 0 bytes                                                                 | 0 bytes                                 | 0 bytes                                            | n/a                                               | 1 variant: 0 bytes                           |
| discriminated union    | u8/u16 tag; 1 bit if 2-way packed                                       | u8/u16 tag; 1 bit if 2-way packed       | same as fbs                                        | tagged `enum`: u8                                 | tagged `enum`: bits or index                 |
| other unions           | `typeIs` for primitives + 1 table                                       | Flamework guards, last match wins       | Flamework guards, last match wins                  | none                                              | `typeof` dispatch, one type per runtime type |
| recursive types        | named helpers, including unions                                         | none                                    | none (depth cap 32, untested)                      | not supported                                     | bounded only, via `write_X`/`read_X`         |
| `EnumItem`             | u8/u16 by name-sorted index                                             | u8 by `.Value`                          | u8 by `.Value`, throws >255                        | n/a                                               | n/a                                          |
| `Vector3`              | 3×f32; `Vector<X, Y, Z>` widths                                         | 3×f32                                   | `Vector<X, Y, Z>` widths; packed common table      | `vector<T>` widths                                | 3×f32; `vector(x, y, z)` widths              |
| `Vector2`              | 2×f32                                                                   | side                                    | side                                               | none                                              | 2×f32 (decodes as Vector3)                   |
| `Vector3int16`         | 3×i16                                                                   | side                                    | side                                               | none                                              | none                                         |
| `CFrame`               | 24 B axis-angle, `Transform` widths; `Quantized` 18 B; packed 1/13/25 B | 24 B axis-angle; packed aligned table   | **18 B quantized** (lossy, ~0.05); packed aligned  | 24 B Euler (`ToOrientation`)                      | 24 B axis-angle; `AlignedCFrame` 13 B        |
| `Color3`               | 3×u8                                                                    | 3×u8                                    | 3×u8                                               | 3×u8                                              | 3×u8                                         |
| `BrickColor`           | u16 `.Number`                                                           | side                                    | side                                               | u16 `.Number`                                     | u16 `.Number`                                |
| `ColorSequence`        | u8 count + 7 B/keypoint                                                 | same                                    | u8 count + u16 time + 3 B                          | none                                              | none                                         |
| `NumberSequence`       | u8 count + 12 B incl. Envelope                                          | same, Envelope dropped                  | u8 count + 3×u16 incl. Envelope (values in [0, 1]) | none                                              | none                                         |
| `UDim` / `UDim2`       | f32 + i32 per `UDim` (8 B / 16 B)                                       | side                                    | `ScaleOffset`/`ScaleOffset2`; packed common table  | none                                              | none                                         |
| `NumberRange` / `Rect` | 2×f32 / 4×f32                                                           | side                                    | side                                               | none                                              | none                                         |
| `DateTime`             | f64 millis                                                              | side                                    | side                                               | f64 seconds or millis                             | f64 seconds or millis                        |
| `buffer`               | u32 len + bytes                                                         | side                                    | side                                               | len + raw bytes; exact: no len                    | len + raw bytes; exact: no len               |
| `Instance`             | side                                                                    | side                                    | side                                               | side; `Instance(Class)` checked                   | side; `Instance.Class` checked               |
| `unknown` / `any`      | optional side                                                           | optional side                           | side                                               | side (not optional)                               | side (not optional)                          |
| functions, `null`      | rejected with a diagnostic                                              | side                                    | side                                               | n/a                                               | n/a                                          |
| `symbol`               | rejected with a diagnostic                                              | side                                    | side                                               | n/a                                               | n/a                                          |
| generics               | yes (keyed by type identity)                                            | yes                                     | yes                                                | struct/map/enum generics                          | none                                         |
| write-side validation  | lengths, counts and `Range` values (`writeChecks`)                      | none                                    | range and NaN on every number                      | `option WriteValidations`                         | `write_checks` (default on)                  |
| read-side checks       | bounds, counts and indexes (`checks`)                                   | none                                    | none                                               | bounds validated                                  | server always, client optional               |

### Cells the harness measured

- Both fbs's and serio's packed aligned tables hold 24 rotations built from
  `CFrame.Angles` and are looked up with exact `CFrame` equality
  (`table.find`), so a rotation built from unit axes almost never matches:
  3 of 50 did, on the benchmark's axis-aligned row. surge's own 1-byte form
  covers all 24 and is exact.
- Zap's `AlignedCFrame` reads that same `CFrame.Angles` table with the same
  exact equality, and asserts on a miss instead of falling back, so the
  benchmark's axis-aligned row has no Zap cell at all.
- Zap's boolean row is narrower than "1 bit always": it packs the booleans and
  optional presence of a struct into a per-scope mask, but an array of
  booleans is a byte per element. 1000 of them cost 1002 bytes, the same as
  Blink, and surge's 1004 differs only by its u32 count.
- Zap's untagged union needs parentheses, as in
  `(string.binary | f64 | boolean)`, and dispatches with `typeof`, as its row
  says.
- What the other 47 rotations then cost is the two libraries' general form:
  about 2e-7 for fbs's three f32 of axis × angle, and a lost rotation for
  serio's 6-byte quantized one, worst component 1.0, where the axis is the X
  axis, on which the scale it maps the Y component onto, `(1 - x²)^0.5`, is
  zero. On an arbitrary rotation that same form costs about 1e-4.

### Libraries considered and not compared

| Library                          | State at the survey                                                   | Why not compared                                                                                                                                                                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sera (`MadStudioRoblox/Sera`)    | 43 stars, Apache-2.0, last pushed 2025-03-25; no npm or Wally listing | Flat dictionaries of primitives only, so it has no cell on most of the catalog; its schema tables are the design fbs and serio already stand for, written by hand rather than read off a type; and a raw `.luau` file is a dependency shape this repository has no convention for |
| ByteBuf (`DarkOnGithub/ByteBuf`) | 0 stars, last pushed 2025-08-16; `@rbxts/bytebuf` 1.0.0, one release  | No adoption to speak of, and it describes itself as self-describing on npm and as schema-based on GitHub, which are opposite wire formats                                                                                                                                         |

Sera has a `LossyCFrame` and an `Angle8`, a second reference for a quantized
rotation beside serio's, and a delta serialization that nothing in the catalog
has. A networking library with its own serializer, such as ByteNet, is the
category Blink and Zap already stand for.

## Discussion

**What the gaps were.** The first tier was types surge had no encoding for:
seven Roblox datatypes, `buffer`, and the 24-bit widths. The second was
`DataType` surface, because Blink and Zap get their size advantage from a
bound declared in the IDL and a TypeScript type has nowhere to put a bound
without a helper type. It closed with `Length<T, L>` for counts,
`Vector<X, Y, Z>` and `Transform<X, Y, Z>` for component widths,
`Range<T, Min, Max>` for a number's range, a bit set for a `Set` of literal
values inside `Packed<T>`, and `Quantized<T>` for a `CFrame`'s rotation.
`Range` narrows as well as validates, which neither Blink nor Zap does, and
serio validates without narrowing.

**What surge left out, and why.** Each of these is a difference from another
library that surge keeps:

- A plain `number` is f64 in surge and fbs, and f32 in serio. A silently lossy
  default is the wrong trade for a replacement.
- surge sorts enum items by name; fbs and serio sort by `.Value`. Either is
  stable per `@rbxts/types` version, and surge is wire-compatible with
  neither library.
- surge's packed bits live in a leading region per object; fbs and serio write
  one bit stream ahead of the whole buffer. Per-object regions keep the
  generated code flat.
- No f16. Luau's `buffer` has no half-float call, so serio and Blink convert in
  software, with a branch for zero, subnormal, infinite and NaN values, on
  every read and write; Blink's own documentation calls its f16 slow. It would
  be the only width that needs a runtime helper, against a design of flat
  generated code with no branch per value, and what native code generation is
  worth on that code is in
  [file-directives-on-generated-code.md](file-directives-on-generated-code.md).
  It saves 2 bytes over f32 and keeps about 3 significant digits, where a
  scaled integer such as an `i16` of the value times 100 is exact in its range.
  No u12 or i12 either: a 12-bit width saves space only next to another, which
  is a `Packed<T>` layout question nothing has asked.
- No `AlignedCFrame`. `Packed<T>` already gives a `CFrame` a 1-, 13- or 25-byte
  form, which is Zap's 13-byte form plus a smaller case and a fallback. Zap's
  form asserts on a rotation its table misses, which is what leaves it with no
  cell on the axis-aligned row.
- Blink's and Zap's per-frame event batching belongs to a networking layer,
  not to the serializer.

**What surge did not chase.** Blink's f16 and serio's f8, f24 and 12-bit
widths beyond the two 24-bit ones; Zap's `unknown` as a union fallback; and
serio's common-value tables for vectors and `UDim2`, where a 64-entry lookup
per value is a speed cost for a rare byte saving, and serio's has an index
collision.

**What this does not show.** The other libraries' cells are read, not run,
except those measured under the matrix, and each library may have changed
since its pinned commit. The measured cells are one sample value per row, as
[serialized-size-across-libraries.md](serialized-size-across-libraries.md)
states. serio's "~0.05" is its own documentation's figure for its quantized
form; this survey measured neither that nor the precision of surge's
`Quantized<T>`.

## Conclusion

Read against four libraries at pinned commits, surge expresses every type the
others do except the ones it leaves out on purpose: the float and 12-bit
widths that need a software conversion or a bit layout, event framing, and
common-value tables. Its remaining
byte differences from Blink and Zap are count widths a shape can now choose,
and its one quantized form is opt-in.

## Data

- The four libraries' sources, at the commits in the Method's table.
- [../benchmarks/size.md](../benchmarks/size.md), and the rows it is made from
  under `tests/src/bench/`.
- surge's column: rbxts-transformer-surge `test/walk.test.ts`, and the
  specifications under [../specs/](../specs/).
- This survey was kept as `docs/future-work/type-coverage-parity.md` while its
  gaps were open, from surge `f5d8134` to `86f729b`.
