# Data types

`DataType` brands change how many bytes a value takes, without changing its
TypeScript type in any way the rest of the code sees:

```ts
import { DataType, createBinarySerializer } from "@rbxts/surge";

interface Snapshot {
	tick: DataType.u32; // 4 bytes instead of 8
	health: DataType.u8; // 1 byte
	name: DataType.Length<string, DataType.u8>; // a 1-byte count
	code: DataType.Length<string, 4>; // exactly 4 bytes, no count
	velocity: DataType.Vector<DataType.i16>; // 3 × 2 bytes
	flags: DataType.Packed<{ grounded: boolean; crouching: boolean; target?: Player }>;
}

export const snapshot = createBinarySerializer<Snapshot>();
```

A branded value is still a `number`, `string` or object to the code that
builds it. What each brand does to the bytes is
[specs/wire-format.md](specs/wire-format.md) sections 4 and 6 to 8.

## Number widths

| Brand                           | Bytes | Holds                                |
| ------------------------------- | ----- | ------------------------------------ |
| `DataType.f64`, plain `number`  | 8     | any `number`                         |
| `DataType.f32`                  | 4     | a single-precision float             |
| `DataType.u8` / `DataType.i8`   | 1     | 0 to 255 / -128 to 127               |
| `DataType.u16` / `DataType.i16` | 2     | 0 to 65535 / -32768 to 32767         |
| `DataType.u24` / `DataType.i24` | 3     | 0 to 16777215 / -8388608 to 8388607  |
| `DataType.u32` / `DataType.i32` | 4     | 0 to 4294967295 / the signed 32 bits |

An integer width truncates a fraction toward zero and wraps a value outside
its range, and nothing reports either. A `u8` given 300 reads back 44. Choose
a width that holds every value the field takes.

## Counts: `Length<T, L>`

A string, a buffer, an array, a tuple's rest, a `Map`, a `Set` and a
`Record` write a 4-byte count ahead of their contents. `Length<T, L>` changes
it:

- `DataType.Length<T, DataType.u8>`, `u16` or `u24` writes a narrower count.
  A count too large for it wraps, so 256 elements under a `u8` count read back
  as none. Set `writeChecks: true` on the factory to have `serialize` raise
  instead ([errors-and-guarantees.md](errors-and-guarantees.md)).
- `DataType.Length<T, 8>`, with a whole number, writes no count: both sides
  use exactly that many bytes or elements. A value of any other length is
  truncated, padded, or raises, depending on its element type, unless
  `writeChecks` is set, which makes it raise. An array of optional elements,
  or of a literal union that includes `undefined`, may be shorter: the missing
  elements read back as absent.

A `Map`, `Set` or `Record` takes a narrower count but not an exact one. A
tuple with no rest element takes neither, since it has no count. `Length`
applies to the container it wraps, not to containers inside it.

## Vector and CFrame widths

`DataType.Vector<X, Y, Z>` sets the width of each component of a `Vector3`,
and `DataType.Transform<X, Y, Z>` sets the widths of a `CFrame`'s position.
`Y` and `Z` default to `X`, and `X` to `f32`, so `Vector<DataType.i16>` is
three `i16`s. A `CFrame`'s rotation keeps its 12 bytes. An integer component
truncates and wraps as a number width does.

## Packing: `Packed<T>`

Inside `DataType.Packed<T>`, each `boolean` property, each optional
property's presence, and the tag of a two-variant tagged union become one bit
of the object's packed region instead of a byte. The region is rounded up to
whole bytes, so up to eight of them cost one byte.

A `CFrame` anywhere inside `Packed<T>` takes a header byte that can stand for
a rotation aligned to the axes and for a position of zero or one. It is 1 byte
when the header stands for both, 13 when it stands for one of the two, and 25,
one byte more than outside `Packed<T>`, when it stands for neither. A
`Transform` with a width other than the default is a build error inside
`Packed<T>`, since the packed form writes its position its own way.

Packing saves bytes and can cost speed: a packed shape reads its bits one
call at a time. [research/packed-against-unpacked.md](research/packed-against-unpacked.md)
measures the trade on two shapes. Pack a shape whose size matters more than
its encode and decode time.

## Combining brands

Brands nest: `Packed<{ list: Length<Array<DataType.u8>, DataType.u16> }>`
packs the object and narrows the list's count. A brand applies to the type it
wraps and to nothing that type contains, except `Packed<T>`, which covers
every object inside it. A brand on a type it cannot apply to, such as
`Length<number>`, is a build error.
