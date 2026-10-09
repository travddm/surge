# Transformer specification

Status: current
Applies to: commit `ca5e2ba` (no tagged release yet)

## 1. Scope

This specifies `rbxts-transformer-surge`: which calls it transforms, which
TypeScript types it accepts and what each becomes, what it emits, and what it
reports when it cannot encode a type. The bytes the emitted code writes are
in [wire-format.md](wire-format.md). The runtime functions the emitted code
calls, and what `deserialize` does with bad input, are in
[runtime-api.md](runtime-api.md).

## 2. Terms

- **Factory**, **call site**, **generated code**: as in
  [runtime-api.md](runtime-api.md).
- **Walk**: the transformer's pass from a type argument to a `Field` tree.
- **`Field` kind**, **packed subtree**, **packed region**: as in
  [wire-format.md](wire-format.md).
- **Table-shaped**: an `object`, `array`, `tuple` or `dict`, all of which are
  a Luau table at run time and cannot be told apart by `typeIs(value, "table")`.
- **Opaque**: a type that walks to `blob`.
- **Reservation**: the inline code that advances a serializer's write or read
  cursor by a number of bytes. On the write side it grows the scratch buffer
  when the write cursor passes the capacity.
- **Diagnostic**: an error the transformer reports through the TypeScript
  program instead of emitting code.

## 3. Detection

**3.1** A call is a call site when its callee resolves, following import
aliases, to the declaration of `createCodec`, `createSerializer`,
`createDeserializer` or `createCursorCodec` in `@rbxts/surge`. A declaration of the same name that
does not resolve to one of those is not transformed.

**3.2** A call site must have exactly one explicit type argument. The type is
never inferred from the call's contextual type.

**3.3** A call site may pass one options argument. It must be an object
literal whose properties, if it has any, are `readChecks` and `writeChecks`,
each written as an identifier with the literal `true` or `false`: a quoted key,
a shorthand property and a spread are rejected. `createSerializer` takes only
`writeChecks`, `createDeserializer` only `readChecks`, and `createCodec` and
`createCursorCodec` both.

**3.4** Each call site is transformed independently of every other: two call
sites for one type generate two serializers, and write the same bytes.

## 4. Classification

**4.1** The walk classifies a type by the first row of this table that
matches it. An optional property's type is its declared type with `undefined`
added. In the union rows, `undefined` is set aside: a union that includes it
and matches the `taggedUnion`, all-opaque or `guardedUnion` row is `optional`
of that kind. The rows that name a Roblox type or an enum item match only a
declaration in `@rbxts/types`, and a user type with the same name falls
through to a later row. The `Map` and `Set` rows match only the built-in
declarations (4.10).

| TypeScript type                                                                                                                                  | `Field` kind                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| a type that depends on a type parameter, such as `T`, `keyof T` or `T["a"]`                                                                      | a diagnostic (4.9)                                                |
| `DataType.Packed<T>`                                                                                                                             | `T`'s kind, with `T` walked as a packed subtree                   |
| `DataType.Length<T, L>`                                                                                                                          | `T`'s kind, with the count `L` sets                               |
| `DataType.Vector<X, Y, Z>`, `DataType.Transform<X, Y, Z>`                                                                                        | `vector3` with component widths, `cframe` with position widths    |
| `DataType.Range<T, Min, Max>`                                                                                                                    | `num` with a range (4.14)                                         |
| `DataType.Quantized<T>`                                                                                                                          | `cframe` with a quantized rotation (4.15)                         |
| a `DataType` width brand: `f32`, `f64`, `u8`, `u16`, `u24`, `u32`, `i8`, `i16`, `i24`, `i32`                                                     | `num(width)`                                                      |
| `boolean`                                                                                                                                        | `bool`                                                            |
| `boolean \| undefined`, including an optional `boolean` property                                                                                 | `optional(bool)`                                                  |
| a union of literal values, which may include `undefined`, including an optional property whose type is one literal value                         | `literal`                                                         |
| one item of an enum, `Enum.X.Y`, which may include `undefined`                                                                                   | `literalConst` of that item, or `optional` of it with `undefined` |
| a whole enum, or a union of two or more items of one enum, which may include `undefined`                                                         | `enum`, or `optional(enum)` with `undefined`                      |
| `T \| undefined` with one `T`, including an optional property                                                                                    | `optional` of `T`'s kind                                          |
| a union of object types sharing one property whose type is a different literal value in each, where no constituent is a tuple or an array (4.12) | `taggedUnion`                                                     |
| a union whose constituents are all opaque                                                                                                        | `blob`                                                            |
| any other union, subject to 4.4                                                                                                                  | `guardedUnion`                                                    |
| `unknown`, `any`                                                                                                                                 | `optional(blob)`                                                  |
| `undefined`, `void`                                                                                                                              | `literalConst` of `undefined` (4.8)                               |
| `never`                                                                                                                                          | a diagnostic (4.8)                                                |
| one literal value, such as `"a"`, `1` or `true`, in any position                                                                                 | `literalConst`                                                    |
| `string`                                                                                                                                         | `str`                                                             |
| `number`                                                                                                                                         | `num(f64)`                                                        |
| `buffer`                                                                                                                                         | `buffer`                                                          |
| `Vector2`, `Vector3`, `CFrame`, `Color3`                                                                                                         | `vector2`, `vector3`, `cframe`, `color3`                          |
| `ColorSequence`, `NumberSequence`                                                                                                                | `colorSequence`, `numberSequence`                                 |
| `Vector3int16`, `UDim`, `UDim2`, `BrickColor`, `NumberRange`, `Rect`, `DateTime`                                                                 | `datatype`                                                        |
| `Instance` and its subclasses, and every other `@rbxts/types` type with a `_nominal_` brand property, such as `Vector2int16`                     | `blob`                                                            |
| a template literal type, `symbol`, `bigint`, `null`, a function or constructor type                                                              | a diagnostic (7.2)                                                |
| `T[]`, `ReadonlyArray<T>`                                                                                                                        | `array`                                                           |
| a tuple whose rest element, if it has one, is last                                                                                               | `tuple`                                                           |
| `Map<K, V>`, `ReadonlyMap<K, V>`                                                                                                                 | `dict` with a key and a value                                     |
| `Set<V>`, `ReadonlySet<V>` in a packed subtree, with `V` walking to a `literal` or `literalConst` that is not `undefined` (4.16)                 | `bitSet`                                                          |
| `Set<V>`, `ReadonlySet<V>`                                                                                                                       | `dict` with a key only                                            |
| a type with both declared properties and an index signature                                                                                      | a diagnostic (7.2)                                                |
| an interface or object type with declared properties                                                                                             | `object`                                                          |
| `Record<string, V>`, `Record<number, V>`, an index-signature type                                                                                | `dict` with a key and a value                                     |
| a type with no properties and no index signature: `{}`, `object` or `defined`                                                                    | `blob`                                                            |

A type with no properties is a `blob` and not zero bytes: TypeScript admits
any value but `undefined` into it, a number or a string included, and zero
bytes would read that value back as an empty table.

**4.2** An object type, a union, an array or a tuple that reappears on its own
walk path is a `recursiveRef` to its first occurrence.

**4.3** `DataType.Packed<T>`, `DataType.Length<T, L>`, `DataType.Vector<X, Y, Z>`,
`DataType.Transform<X, Y, Z>`, `DataType.Range<T, Min, Max>` and
`DataType.Quantized<T>` are recognized both by alias identity and, for a
re-aliased brand, by their brand property. Alias identity is tried for all six
brands before any brand property, and a width brand's property is tried after
theirs, because `Range<T, Min, Max>` over a width brand carries both. In a
composition of brands, the walk resolves the outermost brand and then walks
its inner type, which resolves the next.

**4.4** A union is a `guardedUnion` only if the write side can tell every
constituent that is not opaque apart at run time: at most one constituent is
table-shaped, and no two constituents other than literal values share a
runtime type. A literal value and one enum item are guarded by `===`, a
primitive by its
`typeIs` tag, a Roblox datatype by its own type name, the items of one enum
by `"EnumItem"`, and a table-shaped or recursive constituent by `"table"`. The
items of one enum in a union are one `enum` constituent, whether the union
names the enum or some of its items, and one item alone is a `literalConst`
of that item. Where a union holds more than one enum,
each is also guarded by its `EnumType`, as
`typeIs(value, "EnumItem") && value.EnumType === Enum.<name>`. The opaque
constituents of a union are one `blob` variant, which has no guard and is the
last variant, so the write takes it when no guard passes (5.25). A union whose
constituents are all opaque is a `blob` (4.1).

**4.5** Each generic instantiation is walked on its own: `Box<number>` and
`Box<string>` are two types, whatever declaration they share.

**4.6** A `Record` whose key is a finite union of literals is an `object` with
one property per key, not a `dict`.

**4.7** A `dict`'s key may be of any kind the walk produces, including a
`bool`, `enum`, `object`, `buffer`, Roblox datatype, `literalConst` or
`literal` key, and the generated code type-checks whatever the key's kind.

**4.8** `undefined` and `void` walk to a `literalConst` of `undefined`, which
writes nothing and reads back as `undefined`. `never` is a diagnostic (7.2).

**4.9** A type that depends on a type parameter is a diagnostic (7.2), because a
serializer is generated for one concrete type. This covers a type parameter
with or without a constraint, which is not walked as its constraint, and a
type that reaches one, such as `{ v: T }` inside a generic function.

**4.10** The `Map` and `Set` rows of 4.1 match `Map`, `ReadonlyMap`, `Set` and
`ReadonlySet` only as `@rbxts/compiler-types` declares them, or as
TypeScript's own lib does in a program compiled without it. A user type with
one of those names is walked as any other type.

**4.11** A cycle with no object type and no union on it, such as
`type Nest = Nest[]` or `type Tree = [number, Tree[]]`, is a `recursiveRef`
by 4.2, and its helper's body is the array or tuple (5.2).

**4.12** A tuple or an array is never a `taggedUnion` constituent: its
`length` is not a discriminant. A union of two or more of them has two or
more table-shaped constituents and is a diagnostic (4.4, 7.2).

**4.13** A `Record` whose key is a `DataType` width brand, such as
`Record<DataType.u8, V>`, is a `dict` whose key is written at that width.

**4.14** `DataType.Range<T, Min, Max>` walks to a `num` at the width of Wire
format 4.16, carrying `Min` and `Max` for 5.14. `T` must be `number` or a
width brand, and `Min` and `Max` number literals, with `Min` not greater than
`Max`. A width brand `T` must hold both. Unless `T` is `DataType.f32` or
`DataType.f64`, both must be whole numbers.

**4.15** `DataType.Quantized<T>` walks `T`, which must walk to a `cframe`
outside a packed subtree, and quantizes that `cframe`'s rotation (Wire format
7.4). `T` may be a `DataType.Transform<X, Y, Z>`.

**4.16** In a packed subtree, a `Set` or `ReadonlySet` whose key walks to a
`literal` without `undefined`, or to a `literalConst` other than `undefined`
or an enum item, is a `bitSet` of those values (Wire format 8.8). Any other `Set`, and every
`Set` outside a packed subtree, is a `dict`. `Set<boolean>` is a `dict`,
because `boolean` walks to `bool`; `Set<true>` is a `bitSet`.

## 5. Emission

**5.1** A call site is replaced by generated code for its type: a
`serialize` function, a `deserialize` function, or both, according to the
factory. Both are generated from the same `Field` tree, and `deserialize`
reads fields in the order `serialize` writes them.

**5.2** Each function is one flat body with no run-time dispatch on `Field`
kind. Nested objects, arrays and tuples are inlined. A recursive type is the
one exception: it compiles to a named helper function for each side the
factory returns, declared in the closure the serializer is generated into,
and called at the type's first occurrence and at each `recursiveRef`.

**5.3** Each generated serializer owns its scratch buffer, its capacity and
its write and read cursors, declared in the closure it is generated into.
The runtime package owns none of them. A factory that returns one function
declares only that side's state, and a side that reserves no bytes declares
none: a shape of only `blob` fields declares no state at all. A `serialize`
sized exactly (5.20) declares its buffer and write cursor in itself instead. A
`deserialize` that reaches no recursion helper (5.2) declares its input
buffer and read cursor in itself, and under `readChecks: true` the input's
length (5.10) as well. A cursor codec's `write` declares the scratch
buffer, its capacity and the write cursor from the cursor's buffer, that
buffer's length and the cursor's offset, and its `read` the read state from
the cursor's buffer and offset, as locals where the shape reaches no
recursion helper and into the closure's otherwise; each stores them back into
the cursor, with the blob list's count starting at the cursor's list's length
and the blob index at the cursor's. A cursor codec's `write` is never sized
exactly (5.20), and its `size` is the constant of 5.20's size where that size
reads nothing of the value. A recursion helper's write function takes the write
cursor as a parameter and returns it past what it wrote, and its caller sets
its own cursor from what it returns; the scratch buffer and its capacity stay
in the closure.

**5.4** Every write-side reservation is emitted inline. Outside 5.20, it calls
`grow` only when the write cursor passes the capacity, and a top-level
`serialize` whose shape reserves bytes returns the result of one call to
`finishWrite`. One whose
shape reserves none, such as a shape of only `blob` fields, returns
`buffer.create(0)` and calls no `finishWrite`.

**5.5** A run of consecutive fixed-size properties of one object shares one
reservation. A fixed-size property is a `num`, `vector2`, `vector3`,
`color3`, `datatype`, `enum`, `literal`, `literalConst` or `bitSet`, a `bool`
outside the packed region, a `cframe` outside a packed subtree, an `object`
that has no packed region, is not emitted as a recursion helper (5.2), and has
only fixed-size properties, or a tuple with no rest whose elements are all
fixed-size. Such an object's properties, and such a tuple's elements, take
their bytes from the run; the tuple binds nothing there, and is read into one
table constructor. A run ends before its properties would declare more than 31 locals
in the Luau roblox-ts compiles, counted on the side, and under the check
option, that declares more. A property declares one; a `cframe` five, and a
quantized one six; an `enum`, a `literal`, a `num` with a range, a `vector2`,
a `vector3`, a `color3`, and a `datatype` of more than one component two
(5.26); and a `bitSet` two, and one more for each of its bytes. A nested object declares
what its properties declare, at any depth, and a tuple what its elements
declare. A tuple's consecutive fixed-size elements share a reservation, as an
object's properties do.

**5.6** A `dict`'s count is reserved before its entries, the entries are
counted as they are written, and the count is written back once known. A
variable-length count (5.28) is reserved at one byte. Where the count needs a
long form, the write reserves the bytes that form adds at the end of the
entries, moves the entries along by them, and writes the count where they
started. Every other count is written before its contents, from the size of
the value.

**5.7** A count-driven read loop is emitted as `for (const i of $range(1, count))`,
which roblox-ts lowers to a Luau numeric `for`.

**5.8** The emitter counts the locals each generated function declares, and
counts a local declared in a loop or a branch as live to the end of the
function. Past 120, it wraps an object's properties, or a tuple's fixed
elements, in blocks. A block ends before the next property or element would
take it past 32 locals, and one that counts more than 32 on its own gets a
block to itself. Such an object is built on the read side by assignment
rather than with one table constructor. The limits of native code generation
are not handled: a module past its instruction limit runs the functions past
it interpreted, and Studio names each one
([research/native-code-limits.md](../research/native-code-limits.md)).

**5.9** A blob is stored in the list `serialize` returns at the index a
count of the blobs stored so far gives, and the count moves past it. A blob
that is `nil` is neither stored nor counted, so the list has no hole; an
optional's presence test is that test for the blob it holds. A blob is read
from the list `deserialize` was given at an index, after the two checks of
Runtime API 4.5 and 4.6. Both are emitted inline, and call nothing of the
package. The list and its count, and the read side's list and index, are
declared only where the body writes or reads a blob, including
from inside a recursion helper: in `serialize` and `deserialize` themselves
where the shape reaches no recursion helper (5.2), and in the closure
otherwise, where each call resets them. Where the shape reaches no recursion
helper, `serialize` creates the list with `new Array(length)`, which compiles
to `table.create(length)`, at the most blobs its value appends: one for each
`blob`, each optional that holds one counted as present, and an `array`'s
count times its element's, read through the locals the size bound (5.20).
Where that length would need a loop, or a union, a tuple or a `dict` holds
a blob, it creates the list empty.

**5.10** Read-side checks are emitted only at a call site that sets
`readChecks: true`: one `buffer.len` per `deserialize`, a bound after every
read-side reservation, a bound before the count of a `str` or a `buffer` is
read (5.19), and a bound on the count an `array`, a `dict` or a
tuple's rest element reads back. That bound is the count times the element's
minimum size against the bytes left, or a fixed cap where the element reads
no bytes. A `str` or `buffer` length is bounded by the reservation it sizes.
A sequence's `u8` keypoint count gets no count bound, and each keypoint's
reservation is bounded. An `enum` index is bounded by the number of items its
type admits.

**5.11** Blob pushes inside a branch that writes only when taken are emitted
inside that branch, so encounter order is the same on both sides.

**5.12** A `cframe` in a packed subtree is read by `readPackedCFrame` rather
than by a reservation. Under `readChecks: true` it is bounded before that call, in
two steps: its header byte, then the size the header gives. A header whose
rotation code is from 24 to 30 is rejected.

**5.13** A `createSerializer` or `createDeserializer` call site emits only the
side it returns, recursion helpers included, so its generated code refers to
no state its closure does not declare (5.3).

**5.14** Write-side checks are emitted only at a call site that sets
`writeChecks: true`: a comparison of each exact-form value's length with its
`N` before it is written, which is `>` for an `array` or tuple rest whose
element is `optional` or a `literal` that includes `undefined`, and `!==`
otherwise, and a comparison of each count with
the largest its `u8`, `u16` or `u24` width holds. A `dict`'s count is compared
once the entries are written, before it is written back. A `u32` count is not
compared. A `num` under `DataType.Range<T, Min, Max>` is compared with `Min`
and `Max` as `!(n >= Min && n <= Max)`, which a NaN fails, and, unless `T` is
a float width, with its whole part, before it is written (Wire format 4.17).

**5.15** The value a generated `deserialize` returns is asserted as the call
site's type argument, so it types as that argument, literal properties
included, and is assignable wherever the caller's own type is.

**5.16** A generated `serialize` returns, and a generated `deserialize` takes
as its one parameter, the `Serialized<T>` `@rbxts/surge` declares for the
call site (Runtime API 3.6): the buffer alone where that is `buffer`, and
otherwise a table of `buffer` and `blobs`. It is read from the type of
`serialize`'s result, or, at a `createDeserializer` call site, of the
parameter of `deserialize`'s first call signature. `serialize`'s `blobs` is
the blob channel's list if the body writes a blob, and a new empty array if
it does not. `deserialize` reads `blobs` only if the body reads a blob, and
names
its parameter `_input` if it reads neither bytes nor `blobs`. Under
`readChecks: true`, `deserialize`'s parameter is `unknown` instead (5.17).

**5.17** Under `readChecks: true`, a generated `deserialize` takes `unknown`
and, before the body runs, rejects an input that is not of the shape the
declared `Serialized<T>` names (Runtime API 3.14 and 4.11): anything but a
buffer where that is `buffer`, and otherwise anything but a table whose
`buffer` is a buffer and whose `blobs` is a table. For the table it declares
two locals, for its `buffer` and its `blobs`, ahead of the body, which count
toward 5.8.

**5.18** An `array` whose element is fixed-size (5.5), reserves at least one
byte, and declares no more than 31 locals by the rule of 5.5 reserves all of
its elements at once, after its count and before its loop, and each element
takes its bytes from that reservation in turn. Under `readChecks: true`, that
reservation's bound (5.10) replaces one per element. A tuple's rest element
reserves each element on its own.

**5.19** A `str` or a `buffer` that writes a count takes the value's length once
and reserves the count and the bytes at once; the bytes a variable-length
count takes (5.28) are bound to a local from the length. The read side reads
the count, then moves the read cursor past the count and the bytes in one
step. The exact form, which writes no count, reserves its bytes alone.

**5.20** A `serialize` whose shape can be sized from its value before it is
written creates its result at that size and writes into it. The size is one
sum of at most 32 terms, or, past that, sums of 32 terms added in pairs: Luau
holds a register for each level of a nested addition, and a function has 255. Its buffer and
write cursor are locals of `serialize`, no reservation checks the capacity or
calls `grow`, and it returns that buffer and calls no `finishWrite`. Such a
shape is built only of the fixed-size kinds of 5.5, `str`, `buffer`, `blob`,
`optional`, an `object` that is not emitted as a recursion helper, a
`guardedUnion`, and a `taggedUnion` whose tag is not a bit of a packed region,
whose variants are such shapes, an `array` whose element is of a constant
size or, outside the exact form, such a union, such an `object` or such an
`array`, and a
tuple whose rest
element, if it has one, is of a constant size. An element of a constant size
is fixed-size, or is such a shape whose size reads nothing of its value, such
as an `object` that holds a `blob` and fixed-size properties: a `blob` is not
fixed-size, so the object is not either. Such an `array` is sized by its count
times that size. Each count adds the bytes it takes: its width's, or, for a
variable-length count, what 5.28 computes from it. An `array` of unions, of
objects whose size varies, or of arrays, is sized by a loop over its elements
ahead of the result, which iterates them as the write does. The bytes every
element writes, such as a union's index, are
added once for all of them, ahead of the loop, which adds only what varies. A union
adds its index and the size of the variant its write picks, chosen by the
write's own tests in the write's order: a tag's comparisons or a guarded
union's guards. A size that compares a `taggedUnion`'s tag more than once
reads it into a local once: one of the locals below outside a loop or a
branch, and a local declared ahead of the comparisons inside one. Outside a
loop or a branch and past the 32 locals below, it reads the tag for each
comparison. An `array` of any other element whose size varies, and a `dict`,
keep the scratch buffer: a loop measured slower than it on an array of
strings, twice, and on a `dict`, then as no change
([research/exact-sizing-with-loops.md](../research/exact-sizing-with-loops.md)
and
[research/string-and-dict-loops-again.md](../research/string-and-dict-loops-again.md)),
and faster on an array of objects that hold a string
([research/object-array-loop-sizing.md](../research/object-array-loop-sizing.md))
and on an array of arrays
([research/array-of-arrays-loop.md](../research/array-of-arrays-loop.md)).
Ahead of the result, the size binds to locals what the write binds outside a
loop or a branch: an object's value (5.23), an `array`'s value, and its
length where its count is variable-length, a tuple's value, a `str`'s or a
`buffer`'s value and its length (5.19), and a `taggedUnion`'s
tag that it compares more than once, until those locals number 32. It reads
the value through them, and the write reads the same locals instead of
binding its own. The write takes again an `array`'s length that the
size did not bind, and a tuple's. What the size reads inside a loop or a branch, such as an
optional's or a union's bytes, or past the 32 locals, the write reads again,
and the size's loops visit each element, and the write visits it again.

**5.21** A read of an `array`, a tuple, or a sequence's keypoints creates its
table with `new Array(size)`, which roblox-ts compiles to `table.create(size)`,
and stores each element at its index, except a tuple inside a run of 5.5,
which is one table constructor. The size is the count an `array` reads
back or the count of its exact form, the keypoint count a sequence reads back,
and the number of fixed elements for a tuple, whose rest elements are stored
past them. An
element read back as absent leaves its index empty, and the elements after it
keep their indexes. Under `readChecks: true`, the count's bound (5.10) comes
before the table is created.

**5.22** An element that the write side reads at an index, in the exact form
of an `array` or in a tuple's rest, is cast to the element's type, so the
generated code type-checks under a consumer's `noUncheckedIndexedAccess`.

**5.23** An `object` of more than one property, written outside a run of 5.5,
whose value is not a local, reads its value once into a local and writes
its properties from that local. A property of a nested object is then one
property read from its object's local, not a read of the whole path from the
value `serialize` was given.

**5.24** A `Packed<T>` region is read with one reservation of its bytes. Each
of its first 32 bytes is then read into a local once, and each bit is
`bit32.btest` of its byte and the bit's mask. A byte past the first 32 is read
in place for each of its bits. The read calls no function of the package.

**5.25** A union's write tests its variants once, in their order: a
`taggedUnion` reads its tag into a local once, or reads the local the size
of 5.20 bound for it, and compares it with each variant's tag value, and a
`guardedUnion` evaluates each variant's guard. The branch a test selects
writes the variant's index, unless the enclosing object's packed region holds
the tag, and then the variant. The index shares
the reservation of the fixed-size properties that start a `taggedUnion`'s
variant, or of a `guardedUnion`'s variant of a fixed size, when the run of 5.5
holds them within its bound, and reserves on its own otherwise. The last
variant is written when no test passes, as the size of 5.20 takes it.

**5.26** A `vector2`, a `vector3`, a `color3`, and a `datatype` of more than
one component each read more than one property of their value. When the value
is not a local, the write reads it into a local once and reads each property
from that local, inside a run of 5.5 as outside one, and 5.5 counts that
local. A component reached through two properties, such as a `UDim2`'s
`X.Scale`, reads the first of them from that local.

**5.27** A `cframe` outside a packed subtree is read into one `CFrame` from
its position and a unit quaternion, which the read computes from the
axis-angle of Wire format 4.8: the quaternion's vector part is the axis-angle
scaled by `sin(angle / 2) / angle`, or by `0.5` at an angle of at most
`1e-6`, and its scalar part is `cos(angle / 2)`.

**5.28** A variable-length count (Wire format 6.9) is written and read with
its one-byte form inline. The write compares the count with 254, writes one
byte below it, and calls `writeLongCount` otherwise. The read reads one byte
and, at 254 or more, calls `readLongCount` for the count and the position
after it; under `readChecks: true`, it bounds the long form before the call.
Where a reservation or a size needs the bytes the count takes, they are a
conditional expression of the count. The count of an `array` or a tuple's
rest is bound to a local first where it is not one, since the write reads it
more than once.

## 6. Injected imports

**6.1** The transformer adds one import of `@rbxts/surge/out/abi`, the
package's helper module (Runtime API 5.1), to each file where a transformed
call site uses an export, with every name aliased to a `__surge_`
prefix. A user declaration that does not use the prefix cannot collide with
or shadow an import. The buffers, cursors and input length of 5.3 carry the
same prefix.

**6.2** The imports are named imports, which roblox-ts compiles to one local
each.

**6.3** A file's leading comments move onto the injected import, so a `--!`
directive stays ahead of the first line of code and a file header keeps its
order.

**6.4** The import names only the exports that the sides the factory returns
use. A `createDeserializer` call site imports no write-side export.

**6.5** The generated code refers to globals such as `buffer`, `Vector3`,
`CFrame`, `typeIs`, `Enum` and `$range` by their own names, with no prefix.
A user declaration of one of those names in a scope that encloses a call site
shadows the global in that call site's generated code.

## 7. Diagnostics

**7.1** A diagnostic is a TypeScript diagnostic of category `Error` whose code
is the string `" surge"`, with a leading space, so roblox-ts prints it as
`error TS surge: …`. A type the walk cannot see into, such as `{}`, `object`,
`defined` or an `Instance`, is a `blob` by 4.1 rather than a diagnostic.

**7.2** The walk reports a diagnostic for:

- a type that depends on a type parameter (4.9);
- `never` (4.8);
- a template literal type, `symbol`, `bigint`, `null`, or a function or
  constructor type;
- a type with both declared properties and an index signature;
- a bare `EnumItem`, with no specific enum;
- a tuple whose rest element is not last;
- a union the write side cannot guard (4.4): a constituent of a kind no guard
  covers, two or more table-shaped constituents with no discriminant, or two
  or more constituents other than literal values with the same runtime type;
- a `Length<T, L>` whose `T` writes no count, a `bitSet` included, whose `L`
  is not `u8`, `u16`, `u24`, `u32` or a whole number that is not negative,
  whose `T` is a tuple with no rest element, or whose exact form is applied to
  a `dict`;
- a `Vector<X, Y, Z>` or `Transform<X, Y, Z>` component width that is not a
  `DataType` number width;
- a `Transform<X, Y, Z>` with a width other than the default inside a packed
  subtree;
- a `Range<T, Min, Max>` that breaks 4.14;
- a `Quantized<T>` whose `T` is not a `CFrame`, or that is inside a packed
  subtree.

A union with a constituent that reports one of these reports that diagnostic
alone, and none of its own for the union.

**7.3** The entry point reports a diagnostic for a call site that breaks 3.2
or 3.3, and for one whose body writes or reads a blob where the
`Serialized<T>` `@rbxts/surge` declares is `buffer` (5.16).

**7.4** A walk diagnostic points at the declaration of the property whose
type the walk was in, when that declaration is in the file being transformed.
Otherwise it points at the nearest enclosing property declared in that file,
or at the call site where there is none. An entry-point diagnostic points at
the call site, the options argument, the offending property or its value.

**7.5** A call site with a diagnostic is left untransformed. The transformer
throws only on a broken internal invariant.

## 8. Conformance

`walk`, `emit`, `transform` and `detect` below are the `test/*.test.ts` files
of `rbxts-transformer-surge`, cited by `describe` block. Source paths are in
`rbxts-transformer-surge` unless they name `@rbxts/surge`.

| Statement | Pinned by                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1       | `detect`: `resolveFactoryName`; `tests/src/tests/factories.spec.ts`: `transformsAFactoryImportedUnderAnotherName`; `createCursorCodec`: `transform`: a cursor codec's generated code passes the type check, and takes its state from the cursor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3.2, 3.3  | `transform`: `transform diagnostics`, `transform readChecks option`, `transform writeChecks option`. Source only for more than one argument, options that are not an object literal, and a quoted or shorthand option: `readOptions` in `src/index.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 3.4       | `tests/src/tests/factories.spec.ts`: `writesTheSameBytesFromTwoCallSitesForOneType`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 4.1       | `walk`: `TypeWalker classification`, `TypeWalker classification with fixture packages`, `TypeWalker blob classification`, `TypeWalker tuples`, `TypeWalker union guards`, `TypeWalker wire-format determinism`, and the brand blocks under 4.3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 4.2       | `walk`: `TypeWalker recursion through unions`, `TypeWalker union guards` (a recursive object type); `test/golden.test.mjs`: the recursion-helper checks; `walk`: `TypeWalker recursion through arrays and tuples`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 4.3       | `detect`: `getDataTypeBrand / getSurgeBrand`; `walk`: `TypeWalker Packed<T>`, `TypeWalker Length<T, L>`, `TypeWalker Vector<X, Y, Z> and Transform<X, Y, Z>`, `TypeWalker Range<T, Min, Max>`, `TypeWalker Quantized<T>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 4.4       | `walk`: `TypeWalker union guards`, `TypeWalker wire-format determinism` (two literal values of one runtime type), `TypeWalker classification with fixture packages` (a union of `Instance` subclasses is a `blob`, and an enum next to another type is one `enum` variant); `tests/src/tests/bytes.spec.ts`: `pinsAnEnumNextToAnotherType`; `emit`: `Emitter union guards`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 4.5       | `walk`: `TypeWalker generic instantiation identity`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 4.6       | `walk`: `TypeWalker classification` (a finite key union walks as a fixed-property object)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 4.7       | `transform`: `transform generated code` (a dictionary keyed by each kind); `tests/src/tests/collections.spec.ts`: `roundTripsDictionariesKeyedByWhatARecordCannotType`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 4.8       | `walk`: `TypeWalker undefined, void and never`; `tests/src/tests/roblox.spec.ts`: `writesNothingForUndefinedAndVoidProperties`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 4.9       | `walk`: `TypeWalker type parameters`; `transform`: `transform diagnostics` (a call site inside a generic function)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 4.10      | `walk`: `TypeWalker Map and Set by declaration`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 4.11      | `walk`: `TypeWalker recursion through arrays and tuples`; `transform`: `transform generated code` (an array of itself, a tuple holding an array of itself); `tests/src/tests/recursion.spec.ts`: `roundTripsRecursionThroughArraysAndTuplesAlone`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 4.12      | `walk`: `TypeWalker unions of tuples`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 4.13      | `walk`: `TypeWalker Record keys`; `tests/src/tests/collections.spec.ts`: `roundTripsDictionariesKeyedByWhatARecordCannotType`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 4.14      | `walk`: `TypeWalker Range<T, Min, Max>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 4.15      | `walk`: `TypeWalker Quantized<T>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 4.16      | `walk`: `TypeWalker bit sets inside Packed<T>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 5.1       | `emit`: `Emitter read-order for side-effecting fields`; every round trip under `tests/src/tests/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 5.2       | `emit`: `Emitter per-kind write/read snapshots`; `test/golden.test.mjs`: a non-recursive shape never calls a helper. Source only for the closure the helpers are declared in: `buildReplacement` in `src/index.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 5.3       | `emit`: `Emitter read-side checks` (the read state), `Emitter read state`; `test/golden.test.mjs`: a deserialize that reaches no recursion helper holds its input and cursor in locals, a recursion helper's write takes the write cursor and returns it; `transform`: `transform injected imports` (the scratch buffer). Source only for the state a side with no bytes omits: `writeStateDecls` and `readStateDecls` in `src/emit/context.ts`; a cursor codec: `transform`: a cursor codec's generated code passes the type check, and takes its state from the cursor, `test/golden.test.mjs`: a cursor codec writes into the caller's buffer and gives its state back, `tests/src/tests/cursor.spec.ts`                                                                                                                                                                                                                                                                                                                                                                       |
| 5.4       | `emit`: `Emitter per-kind write/read snapshots` (the inline reservation); `transform`: `transform (end-to-end)` (the `finishWrite` import). Source only for the `buffer.create(0)` return: `finishWriteExpression` in `src/emit/context.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 5.5       | `emit`: `Emitter shared reservations`, `Emitter local-register ceiling` (the bound on a run's locals, and each kind's count against what the emitter declares), and `Emitter bit sets` for a `bitSet`; `tests/src/tests/coverage.spec.ts`: `roundTripsRunsOfCFramesNextToBoundStrings`; `test/golden.test.mjs`: consecutive fixed-size fields share one reservation, and a nested object of fixed-size fields shares the reservation around it; `tests/src/tests/bytes.spec.ts`: `pinsANestedObjectInNameOrder`; `tests/src/tests/basic.spec.ts`: `roundTripsANestedObjectOfFixedSizeFields`; tuples: `emit`: `Emitter element reservations` (a tuple's fixed-size elements share a reservation), `test/golden.test.mjs`: a tuple of fixed-size elements shares the reservation around it, and is read into one table, `tests/src/tests/collections.spec.ts`: `roundTripsTuplesOfFixedSizeElementsInARunAndInAnArray`                                                                                                                                                             |
| 5.6       | `tests/src/tests/bytes.spec.ts`: `pinsContainers` (each count ahead of its contents). The `dict` count written back, and widened to a long form: `tests/src/tests/bytes.spec.ts`: `pinsTheLongFormsOfACount`; `tests/src/tests/counts.spec.ts`: `roundTripsEachKindAtTheEdgesOfTheLongForms`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 5.7       | `test/golden.test.mjs`: a count-driven read is a numeric for loop                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 5.8       | `emit`: `Emitter local-register ceiling`; `transform`: `transform generated code` (runs through nested objects, past the local budget); `tests/src/tests/coverage.spec.ts`: `roundTripsAnObjectWiderThanTheLocalRegisterLimit`, `roundTripsNestedObjectsWiderThanTheLocalRegisterLimit`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 5.9       | `transform`: `transform (end-to-end)` (no blob field, a blob field, and a blob reachable only through a recursion helper); `test/golden.test.mjs`: a shape with no blob field pays nothing for the blob side channel, and a blob list is created at the most blobs its value appends; `tests/src/tests/roblox.spec.ts`: `roundTripsARecursiveTypeThatHoldsABlobOnEachCall`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 5.10      | `emit`: `Emitter read-side checks`; `test/golden.test.mjs`: the two `readChecks` checks; `tests/src/tests/checks.spec.ts`: `rejectsAnEnumIndexPastItsItems`, `rejectsAStringCutInItsCountOrItsBytes`. Source only for the sequence keypoint count: `readSequence` in `src/emit/read.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 5.11      | `tests/src/tests/roblox.spec.ts`: `keepsLaterBlobsInPlaceWhenAnUnknownIsUndefined`, `writesNoBlobForAnAbsentOptionalBlob`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 5.12      | `emit`: `Emitter read-side checks` (a packed CFrame); `tests/src/tests/checks.spec.ts`: `rejectsATruncatedPackedCFrame`, `rejectsAPackedRotationCodeThatNamesNoRotation`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 5.13      | `transform`: `transform generated code` (the single-sided factories on a recursive type); `tests/src/tests/factories.spec.ts`: `roundTripsARecursiveTypeThroughASeparateSerializerAndDeserializer`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 5.14      | `emit`: `Emitter write-side checks`; `transform`: `transform writeChecks option`; `tests/src/tests/checks.spec.ts`: `rejectsAnExactLengthValueOfAnyOtherLength`, `letsAnExactArrayOfOptionalsBeShorterButNotLonger`, `rejectsACountPastItsWidth`, `rejectsANumberItsRangeDoesNotAdmit`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 5.15      | `transform`: `transform generated code` (a deserialize result with each of seven shapes is assignable to its type argument)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 5.16      | `transform`: `transform (end-to-end)` (the declared result has a blobs array exactly when the walk finds a blob, an array the shape never fills, the declared table at a `createDeserializer` call site, and a `deserialize` that reads nothing), `transform generated code` (a caller of a result with no blob and with one, and separate factories); `test/golden.test.mjs`: a shape with no blob field returns the buffer alone, and `deserialize` takes what `serialize` returned                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 5.17      | `transform`: `transform readChecks option` (`deserialize` takes `unknown`, the table each factory requires for a blob or a declared table it never fills, and a caller passing `unknown`, with a blob and without, type-checks); `test/golden.test.mjs`: a serializer with `readChecks` carries them; `tests/src/tests/checks.spec.ts`: `rejectsAnythingButABufferForAShapeWithNoBlob`, `rejectsAnythingButItsTableForAShapeWithABlob`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 5.18      | `emit`: `Emitter element reservations`; `test/golden.test.mjs`: an array of fixed-size elements reserves them all once, ahead of its loop; `tests/src/tests/checks.spec.ts`: `rejectsATruncatedExactLengthArray`; `tests/src/tests/coverage.spec.ts`: `roundTripsAnArrayOfObjectsWiderThanTheLocalRegisterLimit`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 5.19      | `emit`: `Emitter counted bytes`; `test/golden.test.mjs`: a string reserves its count and its bytes at once; `tests/src/tests/checks.spec.ts`: `rejectsAStringCutInItsCountOrItsBytes`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 5.20      | `emit`: `Emitter exact sizing`; `transform`: `transform generated code` (a shape written exactly passes the type check), `transform (end-to-end)` (a shape with no blob field); `test/golden.test.mjs`: a shape sized exactly creates its result at that size and checks no capacity, a union is sized by the variant its write picks, an array of unions, objects or arrays is sized by a loop, and an array of anything else that varies is not, an array of objects that hold a blob is sized by its count, and a size binds the locals its write reads, ahead of the result, and a size that compares a tag more than once reads it once; `transform`: `transform generated code` (a shape sized by loops over unions passes the type check under `noUnusedLocals`); `tests/src/tests/coverage.spec.ts`: `roundTripsAnObjectWhoseSizeHasHundredsOfTerms`; `tests/src/tests/roblox.spec.ts`: `roundTripsAnArrayOfObjectsThatHoldABlob`; `tests/src/tests/strings.spec.ts`: `roundTripsAnArrayOfObjectsThatHoldAString`; every round trip and byte pin under `tests/src/tests/` |
| 5.21      | `emit`: `Emitter read tables`; `test/golden.test.mjs`: a read creates its table at its size and stores each element at its index, and a tuple of fixed-size elements shares the reservation around it, and is read into one table; `tests/src/tests/collections.spec.ts`: `keepsAnAbsentTupleElementInItsPlace`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 5.22      | `emit`: `Emitter exact arrays`; `transform`: `transform generated code` (an array, an exact array and a tuple's rest under `noUncheckedIndexedAccess`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 5.23      | `emit`: `Emitter nested object values`; `test/golden.test.mjs`: a nested object reads its value once, not once per property                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 5.24      | `emit`: `Emitter packed region`, `Emitter packed tag bit`; `test/golden.test.mjs`: a packed region is written and read inline, with no per-bit helper; every round trip in `tests/src/tests/packed.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 5.25      | `emit`: `Emitter union writes`, `Emitter packed tag bit`, `Emitter exact sizing` (the write reads the tag the size bound); `test/golden.test.mjs`: a union is sized by the variant its write picks, with the write's own tests, and a size that compares a tag more than once reads it once; every round trip in `tests/src/tests/unions.spec.ts` and `tests/src/tests/bytes.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 5.26      | `emit`: `Emitter datatype values`, `Emitter local-register ceiling` (runLocals counts at least what one more `vector2`, `vector3`, `color3` or datatype declares), and the snapshots of `Emitter shared reservations` and `Emitter exact sizing`; `test/golden.test.mjs`: a datatype reads its value once, not once per component, inside a run; every round trip in `tests/src/tests/bytes.spec.ts`, `tests/src/tests/roblox.spec.ts` and `tests/src/tests/coverage.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 5.27      | `emit`: `Emitter cframe reads`; `test/golden.test.mjs`: an unpacked CFrame is read into one constructor from a quaternion; `tests/src/tests/roblox.spec.ts`: `roundTripsACFrameRotationWithinF32Precision`, `roundTripsAQuantizedRotationWithinItsStep`; `tests/src/tests/bytes.spec.ts`: `pinsACFrameWithNoRotation`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 5.28      | `emit`: `Emitter count widths` (a variable-length count with no branded width, and a four-byte one at `u32`), `Emitter counted bytes`, `Emitter element reservations` (the long form's bound under `readChecks`); `transform`: `transform (end-to-end)` (the two imports); `tests/src/tests/counts.spec.ts`: `roundTripsEachKindAtTheEdgesOfTheLongForms`; `tests/src/tests/checks.spec.ts`: `rejectsAStringCutInItsCountOrItsBytes`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 6.1, 6.2  | `transform`: `transform injected imports`, and in `transform (end-to-end)` the single shared import and the same-named local function; `tests/src/tests/coverage.spec.ts`: `leavesAUserDeclarationNamedAfterAnInjectedImportAlone`; `test/golden.test.mjs`: generated code imports its helpers from the package's abi module                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 6.3       | `test/golden.test.mjs`: a file directive survives the transformer's injected imports; `transform`: `transform generated code` (the three directive tests)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 6.4       | `transform`: `transform injected imports` (a `createDeserializer` call site)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 6.5       | Source only: `src/emit/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 7.1       | `transform`: `transform diagnostics` (the category). Source only for the code string: `report` in `src/index.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 7.2       | `walk`: `TypeWalker blob classification`, `TypeWalker bare EnumItem`, `TypeWalker classification with fixture packages`, `TypeWalker tuples`, `TypeWalker classification`, `TypeWalker union guards`, the brand blocks under 4.3, and `TypeWalker bit sets inside Packed<T>`. Source only for a constituent of a kind no guard covers: `classifyUnion` in `src/walk.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 7.3       | `transform`: `transform diagnostics`, `transform readChecks option`. Source only: the cases listed under 3.2 and 3.3, and a missed blob, `buildReplacement` in `src/index.ts`, which no type in either package reaches                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 7.4       | `walk`: `TypeWalker diagnostic position`; `transform`: `transform diagnostics`, `transform readChecks option` (the positions). Source only for a property declared in another file: `nodeForProperty` in `src/walk.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 7.5       | `transform`: `transform diagnostics`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Changes

- `ca5e2ba`: adds 5.28 (a variable-length count, Wire format 6.9). 5.6
  widens a `dict`'s count where it needs a long form, 5.19 binds the bytes a
  `str`'s or a `buffer`'s count takes, and 5.20 adds each count's bytes and
  binds an `array`'s length where its count is variable-length.
- `067d228`: withdraws 5.28 (a `cframe` written from `GetComponents`); 5.5
  counts five locals for a `cframe` again, and 5.8 has no exception.
- `28a5b03`: withdraws 5.27 (an `enum`'s write by the item's `Value`), so
  the `cframe` read is 5.27, and adds 5.28 (a `cframe` written from one
  `GetComponents` call). 5.5 counts four locals for a `cframe`, and 5.8
  counts the locals of the block of 5.28 to its end.
- `c09f0a4`: adds 5.27 (an `enum`'s write finds its index by the item's
  `Value`) and 5.28 (a `cframe` is read into one `CFrame` from a quaternion).
- `c080cf2`: 7.3 says package where it said repository.
- `c783929` / `fbdc265`: 3.1 and 3.3 add `createCursorCodec`, and 5.3 states the cursor
  codec's state.
- `8375f07` / `46bffef`: 5.20 sizes an `array` of arrays by a loop over its rows.
- `f0a321f` / `72a4887`: 5.5 shares reservations among a tuple's fixed-size
  elements and makes a tuple of only fixed-size elements fixed-size, and 5.21
  reads such a tuple inside a run into one table constructor.
- `8de2795` / `a566bd2`: 5.20 adds the bytes every element writes once, ahead
  of the size loop. 5.26 reads a datatype's value once again, without the
  `cframe` it read before, and 5.5 counts the local that takes.
- `ce86b2f` / `da35c52`: no statement changes. The 5.9 row names a round
  trip of a recursive type that holds a blob.
- `324c701` / `e6325ac`: 5.9 stores a blob at a counted index, where it
  appended it with `table.insert`.
- `693f5ce` / `680cff4`: 5.9 creates the blob list at the most blobs a value
  appends.
- `ee30e4a` / `062199a`: 5.3 passes a recursion helper's write function the
  write cursor, and has it return the cursor.
- `a4b36f8` / `50ee379`: no statement changes. 5.20 cites the second measurement
  of a loop over an array of strings and over a `dict`.
- `685401a` / `8727491`: 5.20 sizes an `array` of objects whose size varies
  by a loop over them.
- `c9faf84` / `9056ffd`: 5.20 sizes an `array` and a tuple's rest whose element
  is of a constant size without being fixed-size, such as an object that
  holds a blob.
- `c298e3b` / `9cbe5e5`: 5.9 appends and reads a blob inline, in the serializer's own state, and
  5.16 and 7.3 name no package function.
- `a99101d` / `6bf86ea`: 4.1 and 4.4 walk one enum item to a `literalConst`
  of that item, and 4.16 keeps such a key out of a `bitSet`.
- `8b73a80` / `024d7a4`: 4.1 states why a type with no properties is a
  `blob`.
- `9eac6b9` / `024d7a4`: 5.8 names native code generation's limits, which
  it does not handle, in place of the instruction-count limit of a function.
- `ab62da5` / `024d7a4`: 5.20 sums a size of more than 32 terms in parts.
- `a6c8d12` / `afefffd`: 5.5 and 5.18 bound a run by the locals its
  properties declare, not by their number.
- `b307a8d` / `a8eb521`: no statement changes. 5.26 (a datatype's value
  read once), added at `f16bdc3` / `8d1c05d`, is withdrawn.
- `1cea966` / `4a7a289`: 5.20 states that a size past its 32 locals reads
  a tag for each comparison; the 5.25 row names the checks of the write
  reading the size's tag.
- `900658d` / `4a7a289`: 5.20 reads a `taggedUnion`'s tag once where its
  size compares it more than once, and 5.25 has the write read the size's
  local.
- `fb2fe0b` / `68b528a`: 4.4 admits opaque constituents to a `guardedUnion`
  as one last `blob` variant; 7.2 no longer lists them.
- `1cca9c2` / `a3baf44`: 4.4 guards each of several enums in a union by its
  `EnumType`; 7.2 no longer lists a union of items from two enums.
- `b223086` / `e8c9cff`: 4.4 takes the items of one enum in a union as one
  `enum` constituent, so an enum may stand next to another type.
- `73f6143` / `62d4909`: 5.25 has a variant's index share the reservation
  of the fixed-size bytes that start the variant.
- `7ffea67` / `6fb2441`: adds 5.25 (a union's write tests its variants
  once).
- `5b102af` / `c006601`: adds 5.24 (a packed region's bytes are read once
  and its bits tested inline).
- `68f9922` / `499d768`: 5.3 has a `deserialize` that reaches no recursion
  helper declare its read state in itself; 6.1 follows it.
- `4338a95` / `bdabc6c`: 5.20 binds ahead of the result the locals the
  write binds outside a loop or a branch, and the write reads them.
- `d60c411` / `9bce939`: 5.20 sizes by a loop only an `array` of unions; an
  `array` of any other element whose size varies, and a `dict`, keep the
  scratch buffer, where the loop measured slower.
- `a59fabc` / `01801d5`: 5.20 sizes a `taggedUnion` and a `guardedUnion` by
  the variant their write picks.
- `5c83147` / `5cd0208`: 5.20 sizes an `array` whose elements vary in size,
  and a `dict`, by a loop ahead of the result.
- `2310f16` / `fcc7a9c`: adds 5.23 (a nested object reads its value once).
- `e2deaf7` / `3260841`: 5.22 keeps only the cast of an element read at an
  index. The loop by index it stated measured slower than the generic `for`
  ([research/per-element-encode.md](../research/per-element-encode.md)).
- `b8c3206` / `ff2f6ec`: adds 5.22 (an array that writes a count is written
  by index, up to its length, and an element read by index is cast to its
  type).
- `44dcafd` / `0c0f412`: adds 5.21 (a read creates its table at its size and
  stores each element at its index, so an absent tuple element keeps its
  place); 5.7 names the loop's index `i`.
- `bea5fc0` / `015e1f3`: adds 5.20 (a shape sized without a loop is written
  into a buffer of its size); 5.3 and 5.4 follow it.
- `f2d6437` / `ba1331a`: adds 5.19 (a counted `str` or `buffer` reserves its
  count and bytes at once); 5.10 bounds the count before it is read.
- `194ece0` / `8b8be1d`: 5.18 leaves an element of more than 31 properties
  to reserve on its own.
- `02efefc` / `42ce64d`: adds 5.18 (an array of fixed-size elements
  reserves them all at once).
- `1ad16f9` / `125ed38`: 5.5 admits a nested `object` of fixed-size
  properties to a run, and counts its properties toward the bound of 31.
- `85f2241` / `642062d`: 5.17 checks the input against the declared
  `Serialized<T>`, read at a `createDeserializer` call site from
  `deserialize`'s first call signature (5.16); 7.3 applies to every call site
  again.
- `0849e60` / `802a94f`: adds 5.17 (under `readChecks`, `deserialize` takes
  `unknown` and checks its shape); 5.16 and 7.3 follow it.
- `b7b0746` / `7422117`: 3.1 and 3.3 name `createCodec` and `readChecks`;
  5.16 gives `deserialize` one parameter, the declared `Serialized<T>`; 6.1
  imports from `@rbxts/surge/out/abi`; 5.9, 5.10, 5.12 and 7.3 follow them.
- `4801267` / `32ca81c`: 5.16 returns the buffer alone where `Serialized<T>`
  is `buffer`; 7.3 follows it.
- `984a9cc` / `08bd04e`: adds 5.16 (`serialize` returns `blobs` only where
  `Serialized<T>` declares it); 5.9 and 7.3 follow it.
- `a822f0c` / `0710f5d`: 4.1 and 4.16 state which `Set` keys make a `bitSet`
  by the kind the key walks to, so `Set<boolean>` is a `dict`.
- `45454d2` / `0710f5d`: 7.2 states that a union reports a rejected
  constituent's diagnostic alone; 4.14 states the width rule apart from the
  whole-number rule.
- `86f729b` / `c8481d3`: adds 4.14 (`DataType.Range<T, Min, Max>`), 4.15
  (`DataType.Quantized<T>`) and 4.16 (a `bitSet`); 4.1, 4.3 (a width brand's
  property is tried last), 5.5, 5.14 and 7.2 follow them.
- `bbd55c4` / `04cda66`: adds 5.15 (a `deserialize` result types as the type
  argument).
- `fec89a8` / `17fda41`: 3.3 (the options each factory takes, now
  with `writeChecks`); adds 5.14 (the write-side checks).
- `f0d9639` / `fd89bf5`: 4.7 (every `dict` key kind type-checks) now
  states a guarantee; adds 4.13 (a width-branded `Record` key).
- `a7cb730` / `84e0abb`: the remaining known defects of the walk
  fixed. 4.8 (`undefined` and `void` are constants, `never` a diagnostic),
  4.11 (a cycle through arrays or tuples is a recursion helper), 4.12 (a
  tuple union is two table-shaped constituents) and 5.12 (a packed `cframe`
  is bounded under checks) now state guarantees; 4.1, 4.2, 5.10, 7.1, 7.2 and
  7.5 follow them.
- `4f09f80` / `69b6018`: three known defects fixed. 4.9 (a type that depends
  on a type parameter is a diagnostic), 4.10 (`Map` and `Set` by declaration)
  and 5.13 (a single-sided factory emits only its side) now state guarantees;
  4.1, 4.8, 5.2, 6.4, 7.1, 7.2 and 7.5 follow them.
- `a597b56` / `9fc05be`: 4.8–4.12, 5.12 and 5.13 name the future-work documents that track
  them.
- `aff15c3` / `b8ace27`: corrected against the code: 2 (Opaque, Reservation),
  3.3, 4.1 (row order and rows), 4.2, 4.3, 4.4, 4.7 (keys), 5.2 (helper scope),
  5.3–5.6, 5.8, 5.10, 6.1, 7.1, 7.2, 7.4, 7.5 and the Conformance table; adds
  4.8–4.12, 5.12, 5.13, 6.4 and 6.5; retracts the first version's claim that a type
  the walk cannot encode is always a diagnostic.
- `c1cb304` / `058495f`: first version, from Transformer design, Type
  coverage and Risks in the former `docs/transformer.md`. Corrects two
  statements that document made: an ambiguous table-shaped union is a
  diagnostic, not a generated structural guard, and a type the walk cannot
  encode is a diagnostic, not a `blob`.
