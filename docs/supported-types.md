# Supported types

Every type a serializer's type argument reaches is either written into the
bytes, passed through in the `blobs` array, or rejected when the project
builds.

```ts
interface Example {
	id: DataType.u32; // 4 bytes
	name: string; // a 4-byte count, then the string's bytes
	spawn?: CFrame; // 1 presence byte, then 24 bytes when present
	model: Model; // no bytes: passed through in `blobs`
	callback: () => void; // error TS surge: a function type can't be encoded
}
```

The exact bytes of every kind are in
[specs/wire-format.md](specs/wire-format.md), and the full classification,
in the order the transformer applies it, is
[specs/transformer.md](specs/transformer.md) 4.1.

## Written into the bytes

| Type                                                                             | Written as                                                                                        |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `number`                                                                         | 8 bytes, a double. A `DataType` width or `Range` chooses another ([data-types.md](data-types.md)) |
| `boolean`                                                                        | 1 byte, or 1 bit inside `DataType.Packed<T>`                                                      |
| `string`, `buffer`                                                               | a 4-byte count of bytes, then the bytes                                                           |
| a union of literals, such as `"idle" \| "running"` or `1 \| 2 \| 3`              | an index into the values: 1 byte for up to 256 values, 2 beyond                                   |
| one literal, such as `kind: "move"`, and `undefined` or `void`                   | nothing: both sides know the value                                                                |
| an enum item type, such as `Enum.Material`, or a union of one enum's items       | an index into the items the type admits: 1 byte for up to 256, 2 beyond                           |
| `T \| undefined`, or an optional property                                        | 1 presence byte, then `T` when present; 1 bit inside `Packed<T>`                                  |
| an interface or object type                                                      | its properties, sorted by name                                                                    |
| `T[]`, `ReadonlyArray<T>`                                                        | a 4-byte count, then each element                                                                 |
| a tuple, with its rest element last if it has one                                | each fixed element, then a 4-byte count and each rest element                                     |
| `Map<K, V>`, `ReadonlyMap<K, V>`, `Record<string, V>`, `{ [k: string]: V }`      | a 4-byte count, then each key and value                                                           |
| `Set<K>`, `ReadonlySet<K>`                                                       | a 4-byte count, then each key; 1 bit per value inside `Packed<T>` when `K` is literal values      |
| `Record<"a" \| "b", V>`                                                          | an object with the properties `a` and `b`                                                         |
| a union of object types that share a literal tag, such as `kind`                 | an index into the variants, then the variant's other properties                                   |
| any other union the code can tell apart at run time (below)                      | a 1-byte index into the variants, 2 beyond 256, then the variant                                  |
| a type that refers to itself, such as a tree node                                | the same bytes as the structure, through a helper function                                        |
| `Vector2`, `Vector3`                                                             | 2 or 3 floats of 4 bytes; `DataType.Vector` chooses a `Vector3`'s widths                          |
| `CFrame`                                                                         | 24 bytes: position and rotation. 18 with `DataType.Quantized`; 1, 13 or 25 inside `Packed<T>`     |
| `Color3`                                                                         | 3 bytes, one per channel from 0 to 1; a channel outside that range is not representable           |
| `ColorSequence`, `NumberSequence`                                                | a 1-byte keypoint count, then each keypoint                                                       |
| `Vector3int16`, `UDim`, `UDim2`, `BrickColor`, `NumberRange`, `Rect`, `DateTime` | a fixed number of bytes each ([specs/wire-format.md](specs/wire-format.md) 4.10)                  |

`DataType.Length` changes the 4-byte count of a string, buffer, array, tuple
rest or dictionary ([data-types.md](data-types.md)).

A dictionary's key can be any supported type, including a `Vector3`, an enum
item or an object. The order of its entries in the bytes is Luau's iteration
order ([errors-and-guarantees.md](errors-and-guarantees.md)).

## Passed through in `blobs`

These are not written into the bytes. `serialize` puts each value in the
`blobs` array, in the order it meets them, and `deserialize` takes them back
from the array it is given:

- `Instance` and its subclasses;
- every other Roblox type with no row above, such as `Vector2int16`,
  `Region3` or `TweenInfo`;
- `{}`, `object` and `defined`, whose values have no properties to walk;
- `unknown` and `any`, which also write 1 presence byte, so that an
  `undefined` value keeps later blobs in their place;
- a union whose members are all of these.

`serialize` returns a `blobs` array for a type that can hold one of these,
and for the few others that its result type cannot classify, where the array
is always empty ([specs/runtime-api.md](specs/runtime-api.md) 3.12). Any
other type's result has no `blobs`.

A `RemoteEvent` carries an `Instance` in `blobs` as it carries any argument.
A `DataStore` cannot, so a type saved there should hold none of these.

## Rejected when the project builds

The build fails with `error TS surge:` at the property or call that holds one
of these, and the call is left as it was:

- a function, `symbol`, `bigint`, `null`, `never`, or a template literal type
  such as `` `id-${string}` ``;
- a type that depends on a type parameter, such as `T` in a call inside a
  generic function. Call the factory where the type is concrete;
- a type with both declared properties and an index signature;
- `EnumItem` with no specific enum, and a union of items from two enums;
- a tuple whose rest element is not last;
- a union the generated code cannot tell apart at run time, listed below;
- a misused `DataType` brand, such as `Length` on a type that has no count.

## Unions the code can tell apart

`serialize` checks each member of a union at run time, so the members must
differ in a way Luau can see:

- literal values, such as `1 | 2 | "auto"`, compare by value;
- `string`, `number`, `boolean`, `buffer`, each Roblox type, and one enum's
  items each have their own type tag;
- at most one member may be a table: an object, array, tuple, map or set.
  Two objects need a shared literal tag property, which makes the union a
  tagged union instead;
- no member may be passed through in `blobs` next to one that is not. Type
  the whole property as `unknown` to pass it all through.

The rules, with the diagnostic each one reports, are
[specs/transformer.md](specs/transformer.md) 4.4 and 7.2.
