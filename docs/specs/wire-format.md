# Wire format specification

Status: current
Applies to: `@rbxts/surge` at commit `86f729b`, `rbxts-transformer-surge` at
commit `c8481d3` (no tagged release yet)

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
  `literalConst`, `object`, `array`, `tuple`, `dict`, `bitSet`, `optional`,
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
region and a `bitSet` (section 8) are rounded up to whole bytes.

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
another, and so does `DataType.Range<T, Min, Max>` (4.16).

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

**4.8** `cframe` outside a packed subtree is the position, then the rotation.
The position is 3×`f32`: `X`, `Y`, `Z`, unless `Transform<X, Y, Z>` sets their
widths (section 7). The rotation is an axis-angle, the unit axis scaled by the
angle, as 3×`f32`, unless `Quantized<T>` sets it (7.4). Without either brand,
a `cframe` is 24 bytes.

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

**4.12** `enum` is an index, at the index width, into the names of the items
its type admits, in name order. A whole enum, such as `Enum.KeyCode`, admits
every item. A union of some of its items, such as
`Enum.KeyCode.A | Enum.KeyCode.B`, admits only those, and is indexed from `0`
among them.

**4.13** `literal` is an index, at the index width, into its values in
canonical literal order.

**4.14** `literalConst` is zero bytes. The value is a constant of the type on
both sides.

**4.15** An integer width truncates a number toward zero and wraps it modulo
its range, as 7.3 states for a component. Nothing raises, with or without
`writeChecks` ([runtime-api.md](runtime-api.md) 3.11), except as 4.17 states
for a number under `DataType.Range<T, Min, Max>`.

**4.16** `DataType.Range<T, Min, Max>` writes a `num` at a width that `T`
chooses. With `T` a width brand, the width is that brand's. With `T`
`number`, it is the first width that holds every whole number from `Min` to
`Max`: of `u8`, `u16`, `u24` and `u32` when `Min` is not negative, of `i8`,
`i16`, `i24` and `i32` otherwise, and `f64` when none of the four does. The
range writes nothing of its own.

**4.17** With `writeChecks` ([runtime-api.md](runtime-api.md) 3.10), a `num`
under `DataType.Range<T, Min, Max>` raises before it is written when the value
is not both at least `Min` and at most `Max`, which a NaN never is. Unless `T`
is `DataType.f32` or `DataType.f64`, it also raises when the value is not a
whole number.

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

**5.7** `guardedUnion` is an index, at the index width, into its variants, then
the chosen variant's bytes. Variants are ordered by `Field` kind name in name
order. Two `literalConst` variants are ordered by canonical literal order, and
two `datatype` variants by the datatype's name in name order.

**5.8** `recursiveRef` writes exactly what the type it refers to writes.

## 6. Counts and `Length<T, L>`

**6.1** `str`, `buffer`, `array`, `dict` and a tuple's rest element write a
count. Its width is `u32` unless `DataType.Length<T, L>` sets it.

**6.2** With `L` a width — `u8`, `u16`, `u24` or `u32` — the count is written
at that width. `Length<T>` and `Length<T, u32>` produce the same bytes as `T`.

**6.3** With `L` a whole number literal, no count is written and both sides
use exactly `L` bytes (for `str` and `buffer`) or elements (for `array` and a
tuple's rest). Without `writeChecks` ([runtime-api.md](runtime-api.md) 3.10),
nothing checks the value's length: a longer value is truncated to `L`, and a
shorter `str` or `buffer` raises. A shorter `array` or tuple rest is in 6.6
and 6.7.

**6.4** A `dict` takes a width but not a whole number literal.

**6.5** `Length<T, L>` applies to the container it wraps, not to containers
nested inside it.

**6.6** In the exact form of 6.3, a shorter `array` or tuple rest writes each
missing element as `nil`. An `optional` element, or a `literal` element whose
last value in canonical literal order is `undefined`, writes `nil` as absent,
and the value reads back at its own length.

**6.7** Without `writeChecks`, in the exact form of 6.3, a missing element
that 6.6 does not cover raises or changes the value without raising:

- a `bool` is written as `false`;
- a `literal` is written as its last value in canonical literal order;
- a `literalConst` writes nothing and reads back as its constant;
- a `guardedUnion` is written as its last variant in the order of 5.7, which
  raises unless that variant is a `literalConst`;
- a `blob` appends nothing to `blobs`, so a `deserialize` given those `blobs`
  reads past the end of `inputBlobs` and raises
  ([runtime-api.md](runtime-api.md) 4.5);
- every other kind raises when its write reads the missing element. One whose
  write does not read it, such as an `object` whose properties are all
  `literalConst`, reads back as a present value.

Each element that does not raise and is not a `blob` reads back present, so
the value reads back at length `L`. With `writeChecks`, such a value raises
before anything is written ([runtime-api.md](runtime-api.md) 3.10).

**6.8** A count is written at its width modulo that width's range. Without
`writeChecks`, a count too large for a `u8`, `u16` or `u24` width therefore
wraps, and the read side reads the wrapped count: 256 elements under a `u8`
count read back as none. With `writeChecks`, such a count raises
([runtime-api.md](runtime-api.md) 3.10).

## 7. Per-component widths

**7.1** `DataType.Vector<X, Y, Z>` writes a `Vector3`'s components at the
given widths, in `X`, `Y`, `Z` order. `DataType.Transform<X, Y, Z>` does the
same for a `CFrame`'s position, and leaves the rotation as in 4.8.

**7.2** `Y` and `Z` default to `X`, and `X` to `f32`, so an all-default brand
produces the same bytes as the unbranded type.

**7.3** An integer width truncates a component toward zero and wraps it
modulo its range. Nothing raises.

**7.4** `DataType.Quantized<T>` writes a `cframe`'s rotation as 3×`i16` in
place of the 3×`f32` of 4.8. Each is a component of the axis-angle vector,
with an angle above π replaced by the angle minus 2π, multiplied by 32767/π
and rounded to the nearest integer, a half away from zero. The read side
multiplies each by π/32767 and rebuilds the rotation from that vector as 4.8
does. The position is as 4.8 and 7.1 state, so `Quantized<CFrame>` is 18
bytes.

## 8. `Packed<T>`

**8.1** Inside a packed subtree, a `bool` property, an `optional` property's
presence, and the tag of a two-variant `taggedUnion` property are bits in the
enclosing object's packed region rather than bytes. This applies only to
direct properties of an object; a `bool`, an `optional` or a two-variant
`taggedUnion` anywhere else in the subtree is encoded as outside it.

**8.2** An object in a packed subtree begins with its packed region: the bits of
8.4 and 8.5 for each of its properties, in name order, rounded up to whole
bytes. The bytes of its properties follow in name order.

**8.3** Bit `i` of a region is the bit of value `2^(i mod 8)` in byte
`floor(i / 8)`: least significant first. Bits past the last property are `0`.

**8.4** A packed `bool` is one bit, `1` for `true`, and writes no bytes. A
packed `optional` is a presence bit, `1` present. When present, its value's
bytes are the property's bytes in the order of 8.2. An `optional` `bool` is two
adjacent bits, presence then value, with the value bit `0` when absent, and
writes no bytes.

**8.5** A packed two-variant tag bit is `1` for the second variant in the
order of 5.6. A `taggedUnion` with more than two variants keeps its index.

**8.6** A `cframe` anywhere in a packed subtree uses the packed form, whether
or not it is a direct property:

- one header byte: bits 0–4 the rotation, `0`–`23` for an axis-aligned
  rotation and `31` for any other; bits 5–6 the position, `1` for
  `Vector3.zero`, `3` for `Vector3.one`, `0` for any other;
- then the position as 3×`f32`, unless the header gives it;
- then the rotation as in 4.8, unless the header gives it.

So a packed `cframe` is 1, 13 or 25 bytes. Neither `Transform<X, Y, Z>` nor
`Quantized<T>` applies inside a packed subtree.

**8.7** The rotation index is `xCode × 4 + rank`. The code of an axis-aligned
unit vector is `axis × 2 + negative`, where `axis` is `0` for X, `1` for Y and
`2` for Z, and `negative` is `1` when the vector points along the negative
axis. `xCode` is the code of the rotation's X vector. `rank` is the position,
from `0`, of the Y vector's code among the four codes not on the X vector's
axis, in ascending order. A vector is axis-aligned when both of its other
components are within `1e-6` of zero. A rotation is axis-aligned when its X
and Y vectors both are, and it is written as the exact rotation its index
names.

**8.8** A `Set` anywhere in a packed subtree whose key is a `literal` without
`undefined`, or a `literalConst` other than `undefined`, is a `bitSet`: one bit
per value the key admits, in canonical literal order, `1` when the set holds
that value. The bits are numbered as 8.3 numbers a region's, rounded up to
whole bytes, and bits past the last value are `0`. A `bitSet` writes no
count. Any other `Set` in a packed subtree is a `dict` (5.4).

## 9. The blob channel

**9.1** A `blob` writes no bytes. Its value is appended to the `blobs` array
in encounter order, and read back from `inputBlobs` in the same order.

**9.2** A blob inside a branch that writes only when taken — an `optional`'s
inner value, or one variant of a `taggedUnion` or `guardedUnion` — is appended
only when that branch is taken.

**9.3** `unknown` and `any` are `optional(blob)`: the `optional`'s presence,
then an appended blob when the value is not `undefined`. The presence is a
byte (5.5), or a bit where 8.1 applies. A `blob` has no presence of its own;
one inside another `optional`, such as `a?: Instance`, has that `optional`'s.

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

A test file named `*.spec.ts` is under `tests/src/tests/`; `bytes.spec.ts`
compares whole buffers against pinned bytes. `walk.ts` and a path starting
`emit/` are under `src/` of `rbxts-transformer-surge`, and `walk.test.ts` is
its `test/walk.test.ts`, cited by `describe` block. A path starting `src/` is
in `@rbxts/surge`.

| Statement          | Pinned by                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1, 4.1           | `bytes.spec.ts`: `pinsPrimitivesInNameOrder`, `pinsFloats`, `pinsFixedSizeDatatypes`                                                                                                                                                                                                                                                               |
| 3.2, 5.1           | `bytes.spec.ts`: `pinsPrimitivesInNameOrder`                                                                                                                                                                                                                                                                                                       |
| 3.3                | Source only: the emitter writes no header                                                                                                                                                                                                                                                                                                          |
| 4.2                | `bytes.spec.ts`: `pinsThe24BitWidths`; the sign extension on read: `numbers.spec.ts`: `roundTripsRandomIntegers`                                                                                                                                                                                                                                   |
| 4.3, 5.5           | `bytes.spec.ts`: `pinsPrimitivesInNameOrder`, `pinsAnOptional`                                                                                                                                                                                                                                                                                     |
| 4.4, 5.2, 5.3, 6.1 | `bytes.spec.ts`: `pinsContainers`, `pinsABuffer`                                                                                                                                                                                                                                                                                                   |
| 4.5                | `bytes.spec.ts`: `pinsABuffer`; the new buffer: `strings.spec.ts`: `roundTripsBuffers`                                                                                                                                                                                                                                                             |
| 4.6, 4.7           | `bytes.spec.ts`: `pinsFixedSizeDatatypes`                                                                                                                                                                                                                                                                                                          |
| 4.8                | The position: `bytes.spec.ts`: `pinsACFrameWithNoRotation`. The rotation: source only, `writeCFrame` in `emit/write.ts`; `roblox.spec.ts`: `roundTripsACFrameRotationWithinF32Precision` round-trips it                                                                                                                                            |
| 4.9                | The layout: `bytes.spec.ts`: `pinsFixedSizeDatatypes`. The `math.floor`: source only, `writeColor3` in `emit/write.ts`                                                                                                                                                                                                                             |
| 4.10               | `bytes.spec.ts`: `pinsVector3int16`, `pinsUDim`, `pinsUDim2`, `pinsBrickColor`, `pinsNumberRange`, `pinsRect`, `pinsDateTime`                                                                                                                                                                                                                      |
| 4.11               | `bytes.spec.ts`: `pinsSequences`                                                                                                                                                                                                                                                                                                                   |
| 4.12               | A whole enum: `bytes.spec.ts`: `pinsLiteralAndEnumIndexes`; `walk.test.ts`, `TypeWalker classification with fixture packages`. A union of some items: source only, `walkEnum` in `walk.ts` takes the members from the union's items                                                                                                                |
| 4.13               | `bytes.spec.ts`: `pinsLiteralAndEnumIndexes`; `walk.test.ts`, `TypeWalker wire-format determinism`                                                                                                                                                                                                                                                 |
| 4.14               | `bytes.spec.ts`: `pinsLiteralAndEnumIndexes`; `literals.spec.ts`: `writesNoBytesForASingleLiteral`                                                                                                                                                                                                                                                 |
| 4.15               | Source only: `writeNumberAt` in `emit/context.ts` passes the number unconverted to Luau's `buffer` writes and `bit32`. Under `DataType.Range`: `checks.spec.ts`: `wrapsANumberOutsideItsRangeWithoutWriteChecks`                                                                                                                                   |
| 4.16               | `bytes.spec.ts`: `pinsRangeWidths`; `numbers.spec.ts`: `roundTripsRangesAtTheirNarrowedWidths`; each width's edge: `walk.test.ts`, `TypeWalker Range<T, Min, Max>`                                                                                                                                                                                 |
| 4.17               | `checks.spec.ts`: `rejectsANumberItsRangeDoesNotAdmit`                                                                                                                                                                                                                                                                                             |
| 5.4                | A `Record`: `bytes.spec.ts`: `pinsContainers`. A `Set`: source only, `writeDict` in `emit/write.ts` writes the key alone, and `readDict` in `emit/read.ts` sets it to `true`; `collections.spec.ts`: `roundTripsDictionaries` round-trips one                                                                                                      |
| 5.6                | `bytes.spec.ts`: `pinsATaggedUnion`; the choice of tag: `walk.test.ts`, `TypeWalker wire-format determinism`                                                                                                                                                                                                                                       |
| 5.7                | `bytes.spec.ts`: `pinsAGuardedUnion`; the `literalConst` and `datatype` order: `walk.test.ts`, `TypeWalker wire-format determinism` and `TypeWalker classification with fixture packages`. The `u16` index: source only, `writeGuardedUnion` in `emit/write.ts`                                                                                    |
| 5.8                | Source only: `ensureHelper` in `emit/index.ts` builds the helper from the write functions an inlined field uses; `recursion.spec.ts` round-trips recursive shapes                                                                                                                                                                                  |
| 6.2                | `bytes.spec.ts`: `pinsBoundedContainers`, `pinsDefaultedLengthAsUnbranded`                                                                                                                                                                                                                                                                         |
| 6.3                | `bytes.spec.ts`: `pinsExactLengthContainers`. Truncation and a shorter `str` or `buffer`: source only, `writeStr`, `writeBuffer`, `writeArray` and `writeTuple` in `emit/write.ts` write exactly `L`                                                                                                                                               |
| 6.4                | `walk.test.ts`, `TypeWalker Length<T, L>`                                                                                                                                                                                                                                                                                                          |
| 6.5                | `bytes.spec.ts`: `pinsBoundedContainers`                                                                                                                                                                                                                                                                                                           |
| 6.6                | An `optional`: `collections.spec.ts`: `padsAShortExactArrayOfOptionalsInsteadOfRaising`. A `literal`: source only, `literalIndexExpr` in `emit/write.ts` maps `nil` to the last index                                                                                                                                                              |
| 6.7                | Source only: `writeBool`, `literalIndexExpr` and `writeGuardedUnion` in `emit/write.ts`; `pushBlob` in `src/blobs.ts` appends nothing for `nil`. With `writeChecks`: `checks.spec.ts`: `rejectsAnExactLengthValueOfAnyOtherLength`                                                                                                                 |
| 6.8                | `checks.spec.ts`: `wrapsACountPastItsWidthWithoutWriteChecks`, `rejectsACountPastItsWidth`                                                                                                                                                                                                                                                         |
| 7.1, 7.2           | `bytes.spec.ts`: `pinsPerComponentWidths`, `pinsThatDefaultedComponentWidthsMoveNoBytes`                                                                                                                                                                                                                                                           |
| 7.3                | Source only: `writeNumberAt` in `emit/context.ts` passes the component unconverted to Luau's `buffer` writes and `bit32`                                                                                                                                                                                                                           |
| 7.4                | `bytes.spec.ts`: `pinsAQuantizedRotation`; `roblox.spec.ts`: `roundTripsAQuantizedRotationWithinItsStep`                                                                                                                                                                                                                                           |
| 8.1–8.4            | `bytes.spec.ts`: `pinsPackedBooleans`, `pinsPackedOptionals`, `pinsAPackedTagBit`                                                                                                                                                                                                                                                                  |
| 8.5                | `bytes.spec.ts`: `pinsAPackedTagBit`                                                                                                                                                                                                                                                                                                               |
| 8.6, 8.7           | `bytes.spec.ts`: `pinsAPackedCFrame`; `packed.spec.ts`: `packsEachAxisAlignedRotationIntoItsOwnHeaderByte`, `writesOnlyThePartsOfACFrameThatTheHeaderDoesNotGive`, `doesNotSnapARotationThatIsOnlyNearlyAxisAligned`. The rest of the rotation index: source only, `rotationIndex` in `src/cframe.ts`                                              |
| 8.8                | `bytes.spec.ts`: `pinsABitSet`; `packed.spec.ts`: `roundTripsRandomBitSets`; which sets: `walk.test.ts`, `TypeWalker bit sets inside Packed<T>`                                                                                                                                                                                                    |
| 9.1                | `roblox.spec.ts`: `passesUnknownAndInstanceValuesThroughTheBlobChannel`, `keepsLaterBlobsInPlaceWhenAnUnknownIsUndefined`, `writesNoBlobForAnAbsentOptionalBlob`                                                                                                                                                                                   |
| 9.2                | The `optional` branch: `roblox.spec.ts`: `writesNoBlobForAnAbsentOptionalBlob`. The union branches: source only, `writeTaggedUnion` and `writeGuardedUnion` in `emit/write.ts` write each variant inside its branch                                                                                                                                |
| 9.3                | Outside `Packed<T>`: `roblox.spec.ts`: `passesUnknownAndInstanceValuesThroughTheBlobChannel`, `keepsLaterBlobsInPlaceWhenAnUnknownIsUndefined`; `walk.test.ts`, `TypeWalker classification with fixture packages`. The presence bit: source only, `walk.ts` gives `unknown` the `packed` flag, and `packedBits` in `emit/layout.ts` makes it a bit |
| 9.4                | An `array`: `roblox.spec.ts`: `keepsLaterBlobsInPlaceWhenAnUnknownIsUndefined`. A tuple's rest and a `dict`: source only, `writeTuple` and `writeDict` in `emit/write.ts`                                                                                                                                                                          |
| 10.1               | `walk.test.ts`, `TypeWalker wire-format determinism`: literal, numeric-literal and `guardedUnion` order are each sorted canonically, independent of unrelated earlier declarations                                                                                                                                                                 |
| 10.2               | Source only: `writeDict` in `emit/write.ts` iterates the value with no sort                                                                                                                                                                                                                                                                        |

## Changes

- `86f729b` / `c8481d3`: adds 4.16 and 4.17 (`DataType.Range<T, Min, Max>`),
  7.4 (`DataType.Quantized<T>`) and 8.8 (a `bitSet`); 2, 3.2, 4.1, 4.8, 4.15 and
  8.6 follow them.
- `be5d3e6` / `04cda66`: adds 4.15 (an integer width truncates and wraps a
  number, as 7.3 states for a component).
- `fec89a8` / `e402a49`: 6.3 and 6.7 state what `writeChecks`
  changes, and 6.7 is no longer a known defect but the unchecked behavior;
  adds 6.8 (a count too large for its width wraps).
- `a597b56` / `9fc05be`: 6.7 names the future-work document that tracks it.
- `aff15c3` / `b8ace27`: corrected against the code: 4.8 (24 bytes only without
  `Transform`), 4.12 (a union of some items indexes those items), 5.7 (index
  width; `datatype` order), 6.3 (a shorter `array` or tuple rest moves to the
  new 6.6 and 6.7), 8.1 (a two-variant `taggedUnion` elsewhere), 8.2 and 8.4
  (bits per property; where a packed `optional`'s value goes), 8.7 (codes and
  `rank` order defined), 9.3 (presence bit inside `Packed<T>`); Conformance
  rows corrected.
- `378ef30` / `058495f`: first version, from Type coverage in the former
  `docs/transformer.md`.
