# Transformer specification

Status: current
Applies to: `@rbxts/surge` at commit `0849e60`, `rbxts-transformer-surge` at
commit `802a94f` (no tagged release yet)

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
aliases, to the declaration of `createCodec`, `createSerializer` or
`createDeserializer` in `@rbxts/surge`. A declaration of the same name that
does not resolve to one of those is not transformed.

**3.2** A call site must have exactly one explicit type argument. The type is
never inferred from the call's contextual type.

**3.3** A call site may pass one options argument. It must be an object
literal whose properties, if it has any, are `readChecks` and `writeChecks`,
each written as an identifier with the literal `true` or `false`: a quoted key,
a shorthand property and a spread are rejected. `createSerializer` takes only
`writeChecks`, `createDeserializer` only `readChecks`, and `createCodec` both.

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

| TypeScript type                                                                                                                                  | `Field` kind                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| a type that depends on a type parameter, such as `T`, `keyof T` or `T["a"]`                                                                      | a diagnostic (4.9)                                             |
| `DataType.Packed<T>`                                                                                                                             | `T`'s kind, with `T` walked as a packed subtree                |
| `DataType.Length<T, L>`                                                                                                                          | `T`'s kind, with the count `L` sets                            |
| `DataType.Vector<X, Y, Z>`, `DataType.Transform<X, Y, Z>`                                                                                        | `vector3` with component widths, `cframe` with position widths |
| `DataType.Range<T, Min, Max>`                                                                                                                    | `num` with a range (4.14)                                      |
| `DataType.Quantized<T>`                                                                                                                          | `cframe` with a quantized rotation (4.15)                      |
| a `DataType` width brand: `f32`, `f64`, `u8`, `u16`, `u24`, `u32`, `i8`, `i16`, `i24`, `i32`                                                     | `num(width)`                                                   |
| `boolean`                                                                                                                                        | `bool`                                                         |
| `boolean \| undefined`, including an optional `boolean` property                                                                                 | `optional(bool)`                                               |
| a union of literal values, which may include `undefined`, including an optional property whose type is one literal value                         | `literal`                                                      |
| one item of an enum, `Enum.X.Y`, or a union of items of one enum, which may include `undefined`                                                  | `enum`, or `optional(enum)` with `undefined`                   |
| `T \| undefined` with one `T`, including an optional property                                                                                    | `optional` of `T`'s kind                                       |
| a union of object types sharing one property whose type is a different literal value in each, where no constituent is a tuple or an array (4.12) | `taggedUnion`                                                  |
| a union whose constituents are all opaque                                                                                                        | `blob`                                                         |
| any other union, subject to 4.4                                                                                                                  | `guardedUnion`                                                 |
| `unknown`, `any`                                                                                                                                 | `optional(blob)`                                               |
| `undefined`, `void`                                                                                                                              | `literalConst` of `undefined` (4.8)                            |
| `never`                                                                                                                                          | a diagnostic (4.8)                                             |
| one literal value, such as `"a"`, `1` or `true`, in any position                                                                                 | `literalConst`                                                 |
| `string`                                                                                                                                         | `str`                                                          |
| `number`                                                                                                                                         | `num(f64)`                                                     |
| `buffer`                                                                                                                                         | `buffer`                                                       |
| `Vector2`, `Vector3`, `CFrame`, `Color3`                                                                                                         | `vector2`, `vector3`, `cframe`, `color3`                       |
| `ColorSequence`, `NumberSequence`                                                                                                                | `colorSequence`, `numberSequence`                              |
| `Vector3int16`, `UDim`, `UDim2`, `BrickColor`, `NumberRange`, `Rect`, `DateTime`                                                                 | `datatype`                                                     |
| `Instance` and its subclasses, and every other `@rbxts/types` type with a `_nominal_` brand property, such as `Vector2int16`                     | `blob`                                                         |
| a template literal type, `symbol`, `bigint`, `null`, a function or constructor type                                                              | a diagnostic (7.2)                                             |
| `T[]`, `ReadonlyArray<T>`                                                                                                                        | `array`                                                        |
| a tuple whose rest element, if it has one, is last                                                                                               | `tuple`                                                        |
| `Map<K, V>`, `ReadonlyMap<K, V>`                                                                                                                 | `dict` with a key and a value                                  |
| `Set<V>`, `ReadonlySet<V>` in a packed subtree, with `V` walking to a `literal` or `literalConst` that is not `undefined` (4.16)                 | `bitSet`                                                       |
| `Set<V>`, `ReadonlySet<V>`                                                                                                                       | `dict` with a key only                                         |
| a type with both declared properties and an index signature                                                                                      | a diagnostic (7.2)                                             |
| an interface or object type with declared properties                                                                                             | `object`                                                       |
| `Record<string, V>`, `Record<number, V>`, an index-signature type                                                                                | `dict` with a key and a value                                  |
| a type with no properties and no index signature: `{}`, `object` or `defined`                                                                    | `blob`                                                         |

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
constituent apart at run time: at most one constituent is table-shaped, no two
constituents other than literal values share a runtime type, and no
constituent is opaque. A literal value is guarded by `===`, a primitive by its
`typeIs` tag, a Roblox datatype by its own type name, a single enum item by
`"EnumItem"`, and a table-shaped or recursive constituent by `"table"`. A
union whose constituents are all opaque is a `blob` (4.1).

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
`literal` without `undefined`, or to a `literalConst` other than `undefined`,
is a `bitSet` of those values (Wire format 8.8). Any other `Set`, and every
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
none: a shape of only `blob` fields declares no state at all.

**5.4** Every write-side reservation is emitted inline and calls `grow` only
when the write cursor passes the capacity. A top-level `serialize` whose shape
reserves bytes returns the result of one call to `finishWrite`. One whose
shape reserves none, such as a shape of only `blob` fields, returns
`buffer.create(0)` and calls no `finishWrite`.

**5.5** A run of consecutive fixed-size properties of one object shares one
reservation, and a run ends at 31 properties. A fixed-size property is a
`num`, `vector2`, `vector3`, `color3`, `datatype`, `enum`, `literal`,
`literalConst` or `bitSet`, a `bool` outside the packed region, or a `cframe`
outside a packed subtree. A tuple's fixed elements do not share a reservation.

**5.6** A `dict`'s count is reserved before its entries, the entries are
counted as they are written, and the count is written back once known. Every
other count is written before its contents, from the size of the value.

**5.7** A count-driven read loop is emitted as `for (const _i of $range(1, count))`,
which roblox-ts lowers to a Luau numeric `for`.

**5.8** The emitter counts the locals each generated function declares, and
counts a local declared in a loop or a branch as live to the end of the
function. Past 120, it wraps an object's properties, or a tuple's fixed
elements, in blocks. A block ends before the next property or element would
take it past 32 locals, and one that counts more than 32 on its own gets a
block to itself. Such an object is built on the read side by assignment
rather than with one table constructor. The instruction-count limit of a Luau
function is not handled.

**5.9** The blob channel's entry points, `beginWriteBlobs`,
`finishWriteBlobs` and `beginReadBlobs`, are emitted only where the body
reaches `pushBlob` or `nextBlob`, including from inside a recursion helper.

**5.10** Read-side checks are emitted only at a call site that sets
`readChecks: true`: one `buffer.len` per `deserialize`, a bound after every
read-side reservation, and a bound on the count an `array`, a `dict` or a
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
`serialize`'s result, or, at a `createDeserializer` call site, of
`deserialize`'s parameter. `serialize`'s `blobs` is the blob channel's list
if the body reaches `pushBlob`, and a new empty array if it does not.
`deserialize` reads `blobs` only if the body reaches `nextBlob`, and names
its parameter `_input` if it reads neither bytes nor `blobs`. Under
`readChecks: true`, `deserialize`'s parameter is `unknown` instead (5.17).

**5.17** Under `readChecks: true`, a generated `deserialize` takes `unknown`
and checks its shape before the body runs (Runtime API 3.14 and 4.11): it
reads the buffer from a table's `buffer`, or takes the input itself when it
is not a table, and rejects an input whose buffer is not a buffer or whose
table's `blobs` is not a table. It accepts both forms whatever
`Serialized<T>` is, because a `createDeserializer` call site declares no
`Serialized<T>` to read. The two locals that hold the input's parts are
declared ahead of the body and count toward 5.8.

## 6. Injected imports

**6.1** The transformer adds one import of `@rbxts/surge/out/abi`, the
package's helper module (Runtime API 5.1), to each file where a transformed
call site uses an export, with every name aliased to a `__surge_`
prefix. A user declaration that does not use the prefix cannot collide with
or shadow an import. The closure-scoped buffer and cursors carry the same
prefix.

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
- a union of items from two enums;
- a tuple whose rest element is not last;
- a union the write side cannot guard (4.4): an opaque constituent next to
  one that is not opaque, a constituent of a kind no guard covers, two or more
  table-shaped constituents with no discriminant, or two or more constituents
  other than literal values with the same runtime type;
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
or 3.3, and for one whose body reaches `pushBlob` or `nextBlob` where the
`Serialized<T>` `@rbxts/surge` declares is `buffer` (5.16). A
`createDeserializer` call site under `readChecks: true` declares none, and is
not reported for it.

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

| Statement | Pinned by                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1       | `detect`: `resolveFactoryName`; `tests/src/tests/factories.spec.ts`: `transformsAFactoryImportedUnderAnotherName`                                                                                                                                                                                                                                                                                                                                                                     |
| 3.2, 3.3  | `transform`: `transform diagnostics`, `transform readChecks option`, `transform writeChecks option`. Source only for more than one argument, options that are not an object literal, and a quoted or shorthand option: `readOptions` in `src/index.ts`                                                                                                                                                                                                                                |
| 3.4       | `tests/src/tests/factories.spec.ts`: `writesTheSameBytesFromTwoCallSitesForOneType`                                                                                                                                                                                                                                                                                                                                                                                                   |
| 4.1       | `walk`: `TypeWalker classification`, `TypeWalker classification with fixture packages`, `TypeWalker blob classification`, `TypeWalker tuples`, `TypeWalker union guards`, `TypeWalker wire-format determinism`, and the brand blocks under 4.3                                                                                                                                                                                                                                        |
| 4.2       | `walk`: `TypeWalker recursion through unions`, `TypeWalker union guards` (a recursive object type); `test/golden.test.mjs`: the recursion-helper checks; `walk`: `TypeWalker recursion through arrays and tuples`                                                                                                                                                                                                                                                                     |
| 4.3       | `detect`: `getDataTypeBrand / getSurgeBrand`; `walk`: `TypeWalker Packed<T>`, `TypeWalker Length<T, L>`, `TypeWalker Vector<X, Y, Z> and Transform<X, Y, Z>`, `TypeWalker Range<T, Min, Max>`, `TypeWalker Quantized<T>`                                                                                                                                                                                                                                                              |
| 4.4       | `walk`: `TypeWalker union guards`, `TypeWalker wire-format determinism` (two literal values of one runtime type), `TypeWalker classification with fixture packages` (a union of `Instance` subclasses is a `blob`); `emit`: `Emitter union guards`                                                                                                                                                                                                                                    |
| 4.5       | `walk`: `TypeWalker generic instantiation identity`                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 4.6       | `walk`: `TypeWalker classification` (a finite key union walks as a fixed-property object)                                                                                                                                                                                                                                                                                                                                                                                             |
| 4.7       | `transform`: `transform generated code` (a dictionary keyed by each kind); `tests/src/tests/collections.spec.ts`: `roundTripsDictionariesKeyedByWhatARecordCannotType`                                                                                                                                                                                                                                                                                                                |
| 4.8       | `walk`: `TypeWalker undefined, void and never`; `tests/src/tests/roblox.spec.ts`: `writesNothingForUndefinedAndVoidProperties`                                                                                                                                                                                                                                                                                                                                                        |
| 4.9       | `walk`: `TypeWalker type parameters`; `transform`: `transform diagnostics` (a call site inside a generic function)                                                                                                                                                                                                                                                                                                                                                                    |
| 4.10      | `walk`: `TypeWalker Map and Set by declaration`                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 4.11      | `walk`: `TypeWalker recursion through arrays and tuples`; `transform`: `transform generated code` (an array of itself, a tuple holding an array of itself); `tests/src/tests/recursion.spec.ts`: `roundTripsRecursionThroughArraysAndTuplesAlone`                                                                                                                                                                                                                                     |
| 4.12      | `walk`: `TypeWalker unions of tuples`                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 4.13      | `walk`: `TypeWalker Record keys`; `tests/src/tests/collections.spec.ts`: `roundTripsDictionariesKeyedByWhatARecordCannotType`                                                                                                                                                                                                                                                                                                                                                         |
| 4.14      | `walk`: `TypeWalker Range<T, Min, Max>`                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 4.15      | `walk`: `TypeWalker Quantized<T>`                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 4.16      | `walk`: `TypeWalker bit sets inside Packed<T>`                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 5.1       | `emit`: `Emitter read-order for side-effecting fields`; every round trip under `tests/src/tests/`                                                                                                                                                                                                                                                                                                                                                                                     |
| 5.2       | `emit`: `Emitter per-kind write/read snapshots`; `test/golden.test.mjs`: a non-recursive shape never calls a helper. Source only for the closure the helpers are declared in: `buildReplacement` in `src/index.ts`                                                                                                                                                                                                                                                                    |
| 5.3       | `emit`: `Emitter read-side checks` (the read state); `transform`: `transform injected imports` (the scratch buffer). Source only for the state a side with no bytes omits: `writeStateDecls` and `readStateDecls` in `src/emit/context.ts`                                                                                                                                                                                                                                            |
| 5.4       | `emit`: `Emitter per-kind write/read snapshots` (the inline reservation); `transform`: `transform (end-to-end)` (the `finishWrite` import). Source only for the `buffer.create(0)` return: `finishWriteExpression` in `src/emit/context.ts`                                                                                                                                                                                                                                           |
| 5.5       | `emit`: `Emitter shared reservations`, and `Emitter bit sets` for a `bitSet`; `test/golden.test.mjs`: consecutive fixed-size fields share one reservation. Source only for the 31-property bound and tuple elements: `allocRuns` and `fixedBytes` in `src/emit/layout.ts`                                                                                                                                                                                                             |
| 5.6       | `tests/src/tests/bytes.spec.ts`: `pinsContainers` (each count ahead of its contents). Source only for the `dict` count written back: `writeDict` in `src/emit/write.ts`                                                                                                                                                                                                                                                                                                               |
| 5.7       | `test/golden.test.mjs`: a count-driven read is a numeric for loop                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 5.8       | `emit`: `Emitter local-register ceiling`; `tests/src/tests/coverage.spec.ts`: `roundTripsAnObjectWiderThanTheLocalRegisterLimit`                                                                                                                                                                                                                                                                                                                                                      |
| 5.9       | `transform`: `transform (end-to-end)` (no blob field, a blob field, and a blob reachable only through a recursion helper); `test/golden.test.mjs`: a shape with no blob field pays nothing for the blob side channel                                                                                                                                                                                                                                                                  |
| 5.10      | `emit`: `Emitter read-side checks`; `test/golden.test.mjs`: the two `readChecks` checks; `tests/src/tests/checks.spec.ts`: `rejectsAnEnumIndexPastItsItems`. Source only for the sequence keypoint count: `readSequence` in `src/emit/read.ts`                                                                                                                                                                                                                                        |
| 5.11      | `tests/src/tests/roblox.spec.ts`: `keepsLaterBlobsInPlaceWhenAnUnknownIsUndefined`, `writesNoBlobForAnAbsentOptionalBlob`                                                                                                                                                                                                                                                                                                                                                             |
| 5.12      | `emit`: `Emitter read-side checks` (a packed CFrame); `tests/src/tests/checks.spec.ts`: `rejectsATruncatedPackedCFrame`, `rejectsAPackedRotationCodeThatNamesNoRotation`                                                                                                                                                                                                                                                                                                              |
| 5.13      | `transform`: `transform generated code` (the single-sided factories on a recursive type); `tests/src/tests/factories.spec.ts`: `roundTripsARecursiveTypeThroughASeparateSerializerAndDeserializer`                                                                                                                                                                                                                                                                                    |
| 5.14      | `emit`: `Emitter write-side checks`; `transform`: `transform writeChecks option`; `tests/src/tests/checks.spec.ts`: `rejectsAnExactLengthValueOfAnyOtherLength`, `letsAnExactArrayOfOptionalsBeShorterButNotLonger`, `rejectsACountPastItsWidth`, `rejectsANumberItsRangeDoesNotAdmit`                                                                                                                                                                                                |
| 5.15      | `transform`: `transform generated code` (a deserialize result with each of seven shapes is assignable to its type argument)                                                                                                                                                                                                                                                                                                                                                           |
| 5.16      | `transform`: `transform (end-to-end)` (the declared result has a blobs array exactly when the walk finds a blob, an array the shape never fills, the declared table at a `createDeserializer` call site, and a `deserialize` that reads nothing), `transform generated code` (a caller of a result with no blob and with one, and separate factories); `test/golden.test.mjs`: a shape with no blob field returns the buffer alone, and `deserialize` takes what `serialize` returned |
| 5.17      | `transform`: `transform readChecks option` (`deserialize` takes `unknown`, and a caller passing it, with a blob and without, type-checks); `test/golden.test.mjs`: a serializer with `readChecks` carries them; `tests/src/tests/checks.spec.ts`: `rejectsAnInputThatIsNeitherABufferNorATableOfOne`, `rejectsABufferAloneForAShapeThatReadsABlob`                                                                                                                                    |
| 6.1, 6.2  | `transform`: `transform injected imports`, and in `transform (end-to-end)` the single shared import and the same-named local function; `tests/src/tests/coverage.spec.ts`: `leavesAUserDeclarationNamedAfterAnInjectedImportAlone`; `test/golden.test.mjs`: generated code imports its helpers from the package's abi module                                                                                                                                                          |
| 6.3       | `test/golden.test.mjs`: a file directive survives the transformer's injected imports; `transform`: `transform generated code` (the three directive tests)                                                                                                                                                                                                                                                                                                                             |
| 6.4       | `transform`: `transform injected imports` (a `createDeserializer` call site)                                                                                                                                                                                                                                                                                                                                                                                                          |
| 6.5       | Source only: `src/emit/`                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 7.1       | `transform`: `transform diagnostics` (the category). Source only for the code string: `report` in `src/index.ts`                                                                                                                                                                                                                                                                                                                                                                      |
| 7.2       | `walk`: `TypeWalker blob classification`, `TypeWalker bare EnumItem`, `TypeWalker classification with fixture packages`, `TypeWalker tuples`, `TypeWalker classification`, `TypeWalker union guards`, the brand blocks under 4.3, and `TypeWalker bit sets inside Packed<T>`. Source only for a constituent of a kind no guard covers: `classifyUnion` in `src/walk.ts`                                                                                                               |
| 7.3       | `transform`: `transform diagnostics`, `transform readChecks option`. Source only: the cases listed under 3.2 and 3.3, and a missed blob, `buildReplacement` in `src/index.ts`, which no type in either repository reaches                                                                                                                                                                                                                                                             |
| 7.4       | `walk`: `TypeWalker diagnostic position`; `transform`: `transform diagnostics`, `transform readChecks option` (the positions). Source only for a property declared in another file: `nodeForProperty` in `src/walk.ts`                                                                                                                                                                                                                                                                |
| 7.5       | `transform`: `transform diagnostics`                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Changes

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
