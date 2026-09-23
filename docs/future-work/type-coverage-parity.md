# Future work: type coverage parity with fbs, serio, Blink, and Zap

Part of the [surge](../architecture.md) design. Compares what each library
can express and what it costs on the wire, and lists the gaps surge should
close to reach full coverage. Library facts come from reading each
project's source at a pinned commit (September 2026), not from executing it,
except for the cells the benchmark harness has since measured: the `CFrame`
ones recorded under the matrix, and Blink's and Zap's string, array, and map
lengths, whose u16 defaults the size table confirms row by row:

| Library                                    | Version | Commit    | Kind                                                              |
| ------------------------------------------ | ------- | --------- | ----------------------------------------------------------------- |
| `@rbxts/flamework-binary-serializer` (fbs) | 0.7.0   | `a7af287` | Flamework macro; runtime schema interpreter                       |
| `@rbxts/serio` (serio, `R-unic/serio`)     | 1.2.7   | `1313e44` | Flamework macro; runtime schema interpreter                       |
| Blink (`1Axen/blink`)                      | 0.18.8  | `73695d1` | Luau IDL compiler (runs under Lune); networking layer included    |
| Zap (`red-blox/zap`)                       | 0.6.29  | `8cd17ab` | Rust IDL compiler; networking layer included; no standalone codec |

surge's own column comes from the walker probes recorded in the sibling
documents (executed). surge used to walk every Roblox datatype's declared
properties as an object. The identity-based `_nominal_*` brand fix in
[blob-classification.md](blob-classification.md) has landed, so a datatype
without its own encoding now routes to `side`. Real per-datatype encodings
(the rest of Tier A below) are still open.

## Coverage matrix

Byte costs are for the unpacked, unbounded form unless noted. "Side" means
the value travels in the side table (`blobs` / `outgoing_inst`) at zero
buffer bytes.

| Type                   | surge                                                 | fbs                                     | serio                                              | Blink                                             | Zap                                          |
| ---------------------- | ----------------------------------------------------- | --------------------------------------- | -------------------------------------------------- | ------------------------------------------------- | -------------------------------------------- |
| plain `number`         | f64                                                   | f64                                     | **f32**                                            | n/a (IDL widths)                                  | n/a (IDL widths)                             |
| fixed widths           | u8..u32, i8..i32 (incl. 24), f32, f64                 | same                                    | same plus u12/u24/i12/i24/f8/f16/f24 (software)    | same plus f16 (software)                          | same                                         |
| numeric ranges         | none                                                  | none                                    | brand-range asserts, NaN rejected                  | validation only, no narrowing                     | asserts only (`write_checks`), no narrowing  |
| boolean                | 1 byte; 1 bit in `Packed`                             | 1 byte; 1 bit in `Packed`               | 1 byte; 1 bit in `Packed`                          | 1 byte, never packed                              | **1 bit always** (per-scope mask)            |
| optional               | 1 byte; 1 bit in `Packed`                             | 1 byte; 1 bit in `Packed`               | 1 byte; 1 bit in `Packed`                          | 1 byte                                            | 1 bit                                        |
| string                 | u32 len + bytes                                       | u32 len + bytes                         | len width from `String<L>` (default u32)           | u8/u16/u32 by bound (default u16); exact: no len  | same as Blink; utf8 vs binary; exact: no len |
| array                  | u32 count                                             | u32 count                               | `List<T, L>` (default u32)                         | u8/u16/u32 by bound (default u16); exact unrolled | same; exact unrolled                         |
| tuple                  | fixed inline; trailing rest u32                       | fixed inline; rest u32 (written first)  | fixed inline; rest **broken** (u16 write/u32 read) | event tuples only                                 | n/a                                          |
| map                    | u32 count                                             | u32 count                               | `HashMap<K, V, L>` (default u32)                   | u16 count, unvalidated                            | 1 presence bit + `count-1` at key width      |
| set                    | u32 count                                             | u32 count                               | `HashSet<T, L>` (default u32)                      | **bit-packed flag set** (fixed members)           | as map, keys only                            |
| object / struct        | name-sorted fields, no header                         | emit-order fields (unstable, issue #16) | emit-order fields (unverified)                     | declaration order                                 | declaration order                            |
| literal union          | u8/u16 index (canonical value order)                  | u8/u16 index                            | u8/u16 index                                       | unit `enum`: u8                                   | unit `enum`: bits or index                   |
| single literal         | 0 bytes                                               | 0 bytes                                 | 0 bytes                                            | n/a                                               | 1 variant: 0 bytes                           |
| discriminated union    | u8/u16 tag; 1 bit if 2-way packed                     | u8/u16 tag; 1 bit if 2-way packed       | same as fbs                                        | tagged `enum`: u8                                 | tagged `enum`: bits or index                 |
| other unions           | `typeIs` for primitives + 1 table                     | Flamework guards, last match wins       | Flamework guards, last match wins                  | none                                              | `typeof` dispatch, one type per runtime type |
| recursive types        | named helpers, including unions                       | none                                    | none (depth cap 32, untested)                      | not supported                                     | bounded only, via `write_X`/`read_X`         |
| `EnumItem`             | u8/u16 by name-sorted index                           | u8 by `.Value`                          | u8 by `.Value`, throws >255                        | n/a                                               | n/a                                          |
| `Vector3`              | 3×f32; `Vector<X, Y, Z>` widths                       | 3×f32                                   | `Vector<X, Y, Z>` widths; packed common table      | `vector<T>` widths                                | 3×f32; `vector(x, y, z)` widths              |
| `Vector2`              | 2×f32                                                 | side                                    | side                                               | none                                              | 2×f32 (decodes as Vector3)                   |
| `Vector3int16`         | 3×i16                                                 | side                                    | side                                               | none                                              | none                                         |
| `CFrame`               | 24 B axis-angle, `Transform` widths; packed 1/13/25 B | 24 B axis-angle; packed aligned table   | **18 B quantized** (lossy, ~0.05); packed aligned  | 24 B Euler (`ToOrientation`)                      | 24 B axis-angle; `AlignedCFrame` 13 B        |
| `Color3`               | 3×u8                                                  | 3×u8                                    | 3×u8                                               | 3×u8                                              | 3×u8                                         |
| `BrickColor`           | u16 `.Number`                                         | side                                    | side                                               | u16 `.Number`                                     | u16 `.Number`                                |
| `ColorSequence`        | u8 count + 7 B/keypoint                               | same                                    | u8 count + u16 time + 3 B                          | none                                              | none                                         |
| `NumberSequence`       | u8 count + 12 B incl. Envelope                        | same, Envelope dropped                  | u8 count + 3×u16 incl. Envelope (values in [0, 1]) | none                                              | none                                         |
| `UDim` / `UDim2`       | f32 + i32 per `UDim` (8 B / 16 B)                     | side                                    | `ScaleOffset`/`ScaleOffset2`; packed common table  | none                                              | none                                         |
| `NumberRange` / `Rect` | 2×f32 / 4×f32                                         | side                                    | side                                               | none                                              | none                                         |
| `DateTime`             | f64 millis                                            | side                                    | side                                               | f64 seconds or millis                             | f64 seconds or millis                        |
| `buffer`               | u32 len + bytes                                       | side                                    | side                                               | len + raw bytes; exact: no len                    | len + raw bytes; exact: no len               |
| `Instance`             | side                                                  | side                                    | side                                               | side; `Instance(Class)` checked                   | side; `Instance.Class` checked               |
| `unknown` / `any`      | optional side                                         | optional side                           | side                                               | side (not optional)                               | side (not optional)                          |
| functions, `null`      | rejected with a diagnostic                            | side                                    | side                                               | n/a                                               | n/a                                          |
| `symbol`               | rejected with a diagnostic                            | side                                    | side                                               | n/a                                               | n/a                                          |
| generics               | yes (keyed by type identity)                          | yes                                     | yes                                                | struct/map/enum generics                          | none                                         |
| write-side validation  | none                                                  | none                                    | range and NaN on every number                      | `option WriteValidations`                         | `write_checks` (default on)                  |
| read-side checks       | none                                                  | none                                    | none                                               | bounds validated                                  | server always, client optional               |

Some cells have since been measured rather than read, by the
harness in [benchmark-tooling.md](benchmark-tooling.md):

- Both libraries' packed aligned tables hold 24 rotations built from
  `CFrame.Angles` and are looked up with exact `CFrame` equality
  (`table.find`), so a rotation built from unit axes almost never matches:
  3 of 50 did, measured over the benchmark's axis-aligned row. surge's
  own 1-byte form covers all 24 and is exact.
- Zap's `AlignedCFrame` reads that same `CFrame.Angles` table with the same
  exact equality, and asserts on a miss instead of falling back, so the
  benchmark's axis-aligned row has no Zap cell at all.
- Zap's boolean row is narrower than "1 bit always": it packs the booleans
  and optional presence of a struct into a per-scope mask, but an array of
  booleans is a byte per element -- 1000 of them cost 1002 bytes, the same
  as surge and Blink.
- Zap's untagged union needs parentheses -- `(string.binary | f64 |
boolean)` -- and dispatches with `typeof`, as the row says.
- What the other 47 rotations then cost is the two libraries' general form:
  about 2e-7 for fbs's three f32 of axis × angle, and a lost rotation for
  serio's 6-byte quantized one — worst component 1.0 — where the axis is
  the X axis, on which the scale it maps the Y component onto,
  `(1 - x²)^0.5`, is zero. On an arbitrary rotation that same form costs
  about 1e-4.

## Deliberate non-gaps

These differences are design choices, not bugs, and should stay:

- Plain `number` is f64 in surge and fbs; serio defaults to f32. Keep f64:
  a silently lossy default is the wrong trade for a drop-in target.
- surge sorts enum members by name; fbs and serio sort by `.Value`. Either
  is stable per `@rbxts/types` version; surge is not wire-compatible with
  either library and does not need to be.
- surge's packed bits live in a leading region per object; fbs and serio
  write one bit stream as a prefix of the whole buffer. Per-object regions
  are what keep the generated code flat, which is the design's point.
- No f16. Luau's `buffer` has no half-float call, so every library that
  has one (serio, Blink) converts in software, with a branch for zero,
  subnormal, infinite, and `NaN` values, on every read and write; Blink's
  own documentation calls its f16 slow. That is the opposite of this
  design's point, which is flat generated code with no per-value
  branching, and it would be the only numeric width that needs a runtime
  helper in `@rbxts/surge`. Half of that is a design argument and half is
  what the branching costs; native code generation touches only the second
  half, and it is measured at two percent on the generated code (see What
  native changed in
  [generated-code-performance.md](generated-code-performance.md)). It saves
  2 bytes over `DataType.f32` and keeps about 3 significant digits. A value
  that can accept that loss is better served by a scaled integer
  (`DataType.i16` of the value times 100), which is exact in its range and
  costs one multiplication. No u12/i12
  either: a 12-bit width only saves space next to another 12-bit value,
  which is a `Packed<T>` layout question, and nothing has asked for it.
- Blink and Zap batch events per frame and frame each with an id byte.
  That is [networking.md](networking.md), not the serializer.

## Gaps to close

**Tier A: walker and emitter work on the existing type surface.** These
were TypeScript types fbs or serio already handle and surge mishandled or
dropped.

1. Every Roblox datatype that surge's column above marks `side`. fbs and
   serio both use the `_nominal_*` brand key `@rbxts/types` puts on every
   datatype to route them to the side table. surge now does the same as
   the fallback; what remains is real encodings for the cheap ones.
   `Vector2` (2×f32) has landed as its own kind. Each fixed-size type
   below is one row of the table-driven `datatype` kind (`FIXED_DATATYPES`
   in the transformer's `datatypes.ts`).
    - Landed: `Vector3int16` (3×i16).
    - Landed: `UDim` (f32 scale + i32 offset).
    - Landed: `UDim2` (2 x UDim: f32 + i32 for X, then for Y).
    - Landed: `BrickColor` (u16 `.Number`).
    - Landed: `NumberRange` (2 x f32: Min, Max).
    - Landed: `Rect` (4 x f32: Min.X, Min.Y, Max.X, Max.Y).
    - Landed: `DateTime` (f64 `UnixTimestampMillis`). Lune 0.10.5 has no
      `DateTime`, so its fixtures use a stand-in global in the Lune runner
      and do not cover it as a union member.
    - Landed: raw `buffer` (u32 len + bytes), as its own `buffer` kind: it
      is variable length, so it is not a table row.
2. ~~`Instance` and subclasses to the side table.~~ Landed with the
   nominal-brand fallback in item 1.
3. ~~`Packed<T>` for `optional` presence bits, 2-way tagged-union tags,
   and the packed `CFrame`.~~ All landed; see `Packed<T>` in
   [transformer.md](../transformer.md). A `Packed` union at the root, or
   anywhere that is not a direct property of an object, has no packed
   region to hold its tag bit, so its tag stays a byte.
4. ~~`NumberSequence` Envelope.~~ Landed: one more f32 per keypoint. fbs
   drops the envelope; serio keeps it.
5. ~~Recursive unions, generic instantiations, enum width, literal-union
   order.~~ All landed; see [README.md](README.md).
6. ~~Wider and narrower numeric widths from serio.~~ `DataType.u24`/`i24`
   (3 bytes) have landed. f16 and u12/i12 are decided against; see
   Deliberate non-gaps.

**Tier B: new `DataType.*` surface, needed before the IDL features can
exist in a type-driven design.** Blink and Zap get their size advantage
from bounds declared in the IDL; a TypeScript type has nowhere to put a
bound without a helper type.

1. ~~Length-typed containers.~~ **Landed**, as one brand,
   `DataType.Length<T, L>`, over all five kinds that write a count — `string`,
   array, `Map`/`Set`/`Record`, `buffer`, and a tuple's rest element — rather
   than serio's four; [data-type-surface.md](data-type-surface.md) records
   why, and `Length<T, L>` in [transformer.md](../transformer.md) describes
   it. `L` is a width, defaulting to `u32` so nothing moves until a shape
   asks, or a whole number literal for the exact form Blink and Zap have,
   which writes no count at all. A `Map`, `Set`, or `Record` takes the width
   form only. This was the single biggest bandwidth lever: every unbounded
   string, array, map, and set cost 4 bytes of prefix against 2 in Blink and
   Zap by default.
2. ~~Per-component widths for `Vector3` and `CFrame`.~~ **Landed**, as
   `DataType.Vector<X, Y, Z>` over a `Vector3`'s three components and
   `DataType.Transform<X, Y, Z>` over a `CFrame`'s position, serio's two
   names for the same two things (`vector<T>` in Blink and Zap). The
   rotation keeps its f32 axis-angle triple and the packed `CFrame` takes
   no widths at all; `Vector<X, Y, Z>` and `Transform<X, Y, Z>` in
   [transformer.md](../transformer.md) describes both. Zap's
   `AlignedCFrame` (u8 index + position, 13 bytes) was decided against in
   [data-type-surface.md](data-type-surface.md): `Packed<T>` already has
   that form, plus a 1-byte case and a fallback where Zap asserts.
3. A bit-packed set of a fixed member list (Blink's `set`), expressible as
   `Packed<Set<"a" | "b" | ...>>` with one bit per member.
4. Numeric ranges as a brand (`DataType.Range<Min, Max>`): validation on
   write, and narrowing to the smallest width that fits (which neither
   Blink nor Zap does; serio validates but does not narrow).
5. Opt-in write-side validation. The read-side half has landed as the
   factory's `checks` option (What `deserialize` does with bad input in
   [serde.md](../serde.md)); what is left is checking a value on the way
   in, which is the same option's other half and is what `Range<Min, Max>`
   above needs. Every other library has at least one of the two.
6. A quantized rotation option for `CFrame` (serio's 18-byte form, with
   its documented ~0.05 error) for shapes that can accept it.

**Tier C: not worth chasing.** Blink's f16 and serio's f8/f24/12-bit
widths beyond what Tier A lists; Blink and Zap event framing; Zap's
`unknown`-as-union-fallback; serio's common-value tables for vectors and
`UDim2` (a 64-entry table lookup per value is a speed cost for a rare
byte saving, and serio's has an index collision bug).

## Why deferred

Tier A has landed; its list above is kept as the record of what each
item became. Tier B is API design that should be decided once, with the benchmark harness in
[benchmark-tooling.md](benchmark-tooling.md) available to show what each
bound actually saves; it is a separate, later step for that reason. That
decision is now [data-type-surface.md](data-type-surface.md); the items below
are what it applies to.

## How, briefly

- A new fixed-size datatype is one row of `FIXED_DATATYPES` in the
  transformer's `datatypes.ts`, with a round-trip fixture in
  `roblox.spec.ts` and a pin in `bytes.spec.ts`. The transformer's tests
  run over every row.
- The design note is [data-type-surface.md](data-type-surface.md): it decides
  every Tier B brand's name, type-parameter convention, and defaults at once,
  so the ones that land later match the ones that land first. Then
  length-typed containers first, since they dominate the size comparison,
  then vectors and `AlignedCFrame`, then ranges.
