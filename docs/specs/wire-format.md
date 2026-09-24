# Wire format specification

Status: current
Applies to: `@rbxts/surge` at commit `7fc35db`, `rbxts-transformer-surge` at
commit `05b267b` (no tagged release yet)

## 1. Scope

This specifies the bytes a serializer writes for a value, per `Field` kind:
scalars, composites, counts and the brands that change them, `Packed<T>`,
the blob channel, and which bytes are deterministic. Which TypeScript type
walks to which `Field` kind, and which types are rejected, is classification,
and is specified in [transformer.md](transformer.md). What `serialize` and
`deserialize` return is in [runtime-api.md](runtime-api.md).

## 2. Terms

- **`Field` kind**: the intermediate form the transformer walks a type to —
  `num`, `bool`, `str`, `buffer`, `vector2`, `vector3`, `cframe`, `color3`,
  `datatype`, `colorSequence`, `numberSequence`, `enum`, `literal`,
  `literalConst`, `object`, `array`, `tuple`, `dict`, `optional`,
  `taggedUnion`, `guardedUnion`, `blob`, `recursiveRef`.
- **Count**: a number written ahead of a container's contents, saying how many
  bytes or elements follow.
- **Index width**: `u8` when the list indexed has 256 entries or fewer, `u16`
  otherwise.
- **Name order**: ascending by JavaScript's `<` on strings, which compares
  UTF-16 code units.
- **Canonical literal order**: booleans, then numbers, then strings, then
  `undefined`; within one type, ascending by JavaScript's `<`, so `false`
  before `true`.
- **Packed subtree**: the type under a `DataType.Packed<T>`, including every
  type nested in it.
- **Encounter order**: the order in which a serializer reaches values while
  writing, which the read side reproduces.

## 3. General

**3.1** Every multi-byte number is little-endian, as Luau's `buffer` library
writes it.

**3.2** A value's bytes are its fields' bytes concatenated in the order this
specification gives, with no padding and no alignment, except that a packed
region (section 8) is rounded up to whole bytes.

**3.3** The bytes identify neither the shape nor a version. Reading them
requires a deserializer generated for the same type.

## 4. Scalars

**4.1** `num` writes one number at its width:

| Width         | Bytes | Written as                  |
| ------------- | ----- | --------------------------- |
| `f64`         | 8     | IEEE 754 double             |
| `f32`         | 4     | IEEE 754 single             |
| `u8` / `i8`   | 1     | unsigned / two's complement |
| `u16` / `i16` | 2     | unsigned / two's complement |
| `u24` / `i24` | 3     | see 4.2                     |
| `u32` / `i32` | 4     | unsigned / two's complement |

A plain `number` is `f64`. A width brand (`DataType.u8` and the rest) selects
another.

**4.2** A `u24` or `i24` is a `u16` holding the low 16 bits followed by a `u8`
holding the high 8. An `i24` is stored in two's complement and sign-extended
on read.

**4.3** `bool` outside a packed subtree is 1 byte: `1` for `true`, `0` for
`false`.

**4.4** `str` is a count of the string's length in bytes, then those bytes.

**4.5** `buffer` is a count of its length in bytes, then those bytes. The read
side returns a new buffer, not a view of the input.

**4.6** `vector2` is 2×`f32`: `X`, `Y`.

**4.7** `vector3` is 3×`f32`: `X`, `Y`, `Z`, unless `Vector<X, Y, Z>` sets their
widths (section 7).

**4.8** `cframe` outside a packed subtree is 24 bytes: the position as 3×`f32`
(`X`, `Y`, `Z`, unless `Transform<X, Y, Z>` sets their widths), then the
rotation as an axis-angle, the unit axis scaled by the angle, as 3×`f32`.

**4.9** `color3` is 3×`u8`: `R`, `G`, `B`, each written as
`math.floor(channel × 255)`. Nothing clamps a channel, so a channel outside
`[0, 1]` is outside what this encoding represents.

**4.10** `datatype` writes a Roblox datatype's numbers at fixed offsets and
rebuilds it on read:

| Type           | Bytes | Layout                                                              |
| -------------- | ----- | ------------------------------------------------------------------- |
| `Vector3int16` | 6     | 3×`i16`: `X`, `Y`, `Z`                                              |
| `UDim`         | 8     | `f32` `Scale`, `i32` `Offset`                                       |
| `UDim2`        | 16    | two `UDim`s: `X`, then `Y`                                          |
| `BrickColor`   | 2     | `u16` `Number`                                                      |
| `NumberRange`  | 8     | 2×`f32`: `Min`, `Max`                                               |
| `Rect`         | 16    | 4×`f32`: `Min.X`, `Min.Y`, `Max.X`, `Max.Y`                         |
| `DateTime`     | 8     | `f64` `UnixTimestampMillis`, rebuilt with `fromUnixTimestampMillis` |

**4.11** `colorSequence` and `numberSequence` are a `u8` keypoint count, then
each keypoint: an `f32` time and 3×`u8` color for a `ColorSequence`; an `f32`
time, `f32` value and `f32` envelope for a `NumberSequence`.

**4.12** `enum` is an index, at the index width, into the enum's member names
in name order.

**4.13** `literal` is an index, at the index width, into its values in
canonical literal order.

**4.14** `literalConst` is zero bytes. The value is a constant of the type on
both sides.

## 5. Composites

**5.1** `object` is its properties' bytes in name order. It writes nothing of
its own, except the packed region of 8.2 when it is in a packed subtree.

**5.2** `array` is a count of its elements, then each element.

**5.3** `tuple` is its fixed elements in order, then, if it has a rest
element, a count and each rest element.

**5.4** `dict` is a count of its entries, then each entry: the key, then the
value. A `Set` writes the key alone and reads each back as `true`. The count
is written ahead of the entries.

**5.5** `optional` outside a packed subtree, or not a direct property of an
object in one, is a presence byte — `1` present, `0` absent — then the inner
value's bytes when present.

**5.6** `taggedUnion` is an index, at the index width, into its variants in
canonical literal order of their tag values, then the chosen variant's
properties as an `object`, without the tag property, which the read side
restores from the index. Where two properties could each serve as the tag,
the first in name order is the tag.

**5.7** `guardedUnion` is a 1-byte index into its variants, then the chosen
variant's bytes. Variants are ordered by `Field` kind name, and two
`literalConst` variants by canonical literal order.

**5.8** `recursiveRef` writes exactly what the type it refers to writes.

## 6. Counts and `Length<T, L>`

**6.1** `str`, `buffer`, `array`, `dict` and a tuple's rest element write a
count. Its width is `u32` unless `DataType.Length<T, L>` sets it.

**6.2** With `L` a width — `u8`, `u16`, `u24` or `u32` — the count is written
at that width. `Length<T>` and `Length<T, u32>` produce the same bytes as `T`.

**6.3** With `L` a whole number literal, no count is written and both sides
use exactly `L` bytes (for `str` and `buffer`) or elements (for `array` and a
tuple's rest). A longer value is truncated to `L`. A shorter value raises
where writing its missing part touches it — except an array or tuple rest
whose element is `optional`, whose missing elements are written as absent and
which reads back at its own length.

**6.4** A `dict` takes a width but not a whole number literal.

**6.5** `Length<T, L>` applies to the container it wraps, not to containers
nested inside it.

## 7. Per-component widths

**7.1** `DataType.Vector<X, Y, Z>` writes a `Vector3`'s components at the
given widths, in `X`, `Y`, `Z` order. `DataType.Transform<X, Y, Z>` does the
same for a `CFrame`'s position, and leaves the rotation as in 4.8.

**7.2** `Y` and `Z` default to `X`, and `X` to `f32`, so an all-default brand
produces the same bytes as the unbranded type.

**7.3** An integer width truncates a component toward zero and wraps it
modulo its range. Nothing raises.

## 8. `Packed<T>`

**8.1** Inside a packed subtree, a `bool` property, an `optional` property's
presence, and the tag of a two-variant `taggedUnion` property are bits in the
enclosing object's packed region rather than bytes. This applies only to
direct properties of an object; a `bool` or `optional` anywhere else in the
subtree is encoded as outside it.

**8.2** An object in a packed subtree begins with its packed region: one bit
per packed property in name order, rounded up to whole bytes. Its other
properties follow in name order.

**8.3** Bit `i` of a region is the bit of value `2^(i mod 8)` in byte
`floor(i / 8)`: least significant first. Bits past the last property are `0`.

**8.4** A packed `bool` is `1` for `true`. A packed `optional` is a presence
bit, `1` present, followed by its value's bytes when present and not a
`bool`. An `optional` `bool` is two adjacent bits, presence then value.

**8.5** A packed two-variant tag bit is `1` for the second variant in the
order of 5.6. A `taggedUnion` with more than two variants keeps its index.

**8.6** A `cframe` anywhere in a packed subtree uses the packed form, whether
or not it is a direct property:

- one header byte: bits 0–4 the rotation, `0`–`23` for an axis-aligned
  rotation and `31` for any other; bits 5–6 the position, `1` for
  `Vector3.zero`, `3` for `Vector3.one`, `0` for any other;
- then the position as 3×`f32`, unless the header gives it;
- then the rotation as in 4.8, unless the header gives it.

So a packed `cframe` is 1, 13 or 25 bytes. `Transform<X, Y, Z>` does not
apply inside a packed subtree.

**8.7** The rotation index is `xCode × 4 + rank`, where `xCode` is
`axis × 2 + negative` for the direction of the rotation's X vector (6 codes),
and `rank` is which of the 4 directions perpendicular to that axis its Y
vector takes. A vector is axis-aligned when both of its other components are
within `1e-6` of zero, and an axis-aligned rotation is written as the exact
rotation its index names.

## 9. The blob channel

**9.1** A `blob` writes no bytes. Its value is appended to the `blobs` array
in encounter order, and read back from `inputBlobs` in the same order.

**9.2** A blob inside a branch that writes only when taken — an `optional`'s
inner value, or one variant of a `taggedUnion` or `guardedUnion` — is appended
only when that branch is taken.

**9.3** `unknown` and `any` are `optional(blob)`: a presence byte, then an
appended blob when the value is not `undefined`. Every other `blob` has no
presence byte.

**9.4** A blob inside an `array`, a tuple's rest, or a `dict` is appended once
per element or entry, in the order the elements or entries are written.

## 10. Determinism

**10.1** The bytes of a value depend only on the value and the type, not on
the file the type is declared in, other files in the program, or the order
in which the compiler created types.

**10.2** The same value serialized twice by the same build produces the same
bytes, unless the value contains a `dict`. A `dict`'s entries are written in
Luau's table iteration order, which is unspecified, so two equal values
containing one may produce different bytes. Both still deserialize to equal
values.

## 11. Conformance

`bytes.spec.ts` below is `tests/src/tests/bytes.spec.ts`, which compares whole
buffers against pinned bytes.

| Statement              | Pinned by                                                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1, 4.1               | `bytes.spec.ts`: `pinsPrimitivesInNameOrder`, `pinsFloats`, `pinsFixedSizeDatatypes`                                                                                             |
| 3.2, 5.1               | `bytes.spec.ts`: `pinsPrimitivesInNameOrder`                                                                                                                                     |
| 3.3                    | Source only: the emitter writes no header                                                                                                                                        |
| 4.2                    | `bytes.spec.ts`: `pinsThe24BitWidths`                                                                                                                                            |
| 4.3, 5.5               | `bytes.spec.ts`: `pinsPrimitivesInNameOrder`, `pinsAnOptional`                                                                                                                   |
| 4.4, 4.5, 5.2–5.4, 6.1 | `bytes.spec.ts`: `pinsContainers`, `pinsABuffer`                                                                                                                                 |
| 4.6–4.9                | `bytes.spec.ts`: `pinsFixedSizeDatatypes`, `pinsACFrameWithNoRotation`                                                                                                           |
| 4.10                   | `bytes.spec.ts`: `pinsVector3int16`, `pinsUDim`, `pinsUDim2`, `pinsBrickColor`, `pinsNumberRange`, `pinsRect`, `pinsDateTime`                                                    |
| 4.11                   | `bytes.spec.ts`: `pinsSequences`                                                                                                                                                 |
| 4.12, 4.13             | `bytes.spec.ts`: `pinsLiteralAndEnumIndexes`                                                                                                                                     |
| 4.14                   | Source only: `literalConst` in `rbxts-transformer-surge` `src/emit/write.ts` writes nothing                                                                                      |
| 5.6                    | `bytes.spec.ts`: `pinsATaggedUnion`                                                                                                                                              |
| 5.7                    | `bytes.spec.ts`: `pinsAGuardedUnion`                                                                                                                                             |
| 5.8                    | `tests/src/tests/recursion.spec.ts`                                                                                                                                              |
| 6.2                    | `bytes.spec.ts`: `pinsBoundedContainers`, `pinsDefaultedLengthAsUnbranded`                                                                                                       |
| 6.3                    | `bytes.spec.ts`: `pinsExactLengthContainers`                                                                                                                                     |
| 6.4                    | Source only: the walker's diagnostic for an exact `Length` on a `dict`                                                                                                           |
| 6.5                    | `bytes.spec.ts`: `pinsBoundedContainers`                                                                                                                                         |
| 7.1–7.3                | `bytes.spec.ts`: `pinsPerComponentWidths`, `pinsThatDefaultedComponentWidthsMoveNoBytes`                                                                                         |
| 8.1–8.4                | `bytes.spec.ts`: `pinsPackedBooleans`, `pinsPackedOptionals`                                                                                                                     |
| 8.5                    | `bytes.spec.ts`: `pinsAPackedTagBit`                                                                                                                                             |
| 8.6, 8.7               | `bytes.spec.ts`: `pinsAPackedCFrame`; the rotation index in `src/cframe.ts`                                                                                                      |
| 9.1–9.4                | `tests/src/tests/roblox.spec.ts`: `passesUnknownAndInstanceValuesThroughTheBlobChannel`, `keepsLaterBlobsInPlaceWhenAnUnknownIsUndefined`, `writesNoBlobForAnAbsentOptionalBlob` |
| 10.1                   | `rbxts-transformer-surge` `test/walk.test.ts`: literal, numeric-literal and `guardedUnion` order are each sorted canonically, independent of unrelated earlier declarations      |
| 10.2                   | Source only: `dict` iterates its value with no sort                                                                                                                              |

## Changes

- `7fc35db` / `05b267b`: first version, from Type coverage in the former
  `docs/transformer.md`.
