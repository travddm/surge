# Transformer specification

Status: current
Applies to: `@rbxts/surge` at commit `8ab32c4`, `rbxts-transformer-surge` at
commit `e83581b` (no tagged release yet)

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
aliases, to the declaration of `createBinarySerializer`, `createSerializer` or
`createDeserializer` in `@rbxts/surge`. A declaration of the same name that
does not resolve to one of those is not transformed.

**3.2** A call site must have exactly one explicit type argument. The type is
never inferred from the call's contextual type.

**3.3** A call site may pass one options argument. It must be an object
literal whose only property, if it has one, is `checks: true` or
`checks: false`, with `checks` written as an identifier: a quoted key, a
shorthand property and a spread are rejected. `createSerializer` takes no
options.

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

| TypeScript type                                                                                                                            | `Field` kind                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| a type that depends on a type parameter, such as `T`, `keyof T` or `T["a"]`                                                                | a diagnostic (4.9)                                             |
| `DataType.Packed<T>`                                                                                                                       | `T`'s kind, with `T` walked as a packed subtree                |
| `DataType.Length<T, L>`                                                                                                                    | `T`'s kind, with the count `L` sets                            |
| `DataType.Vector<X, Y, Z>`, `DataType.Transform<X, Y, Z>`                                                                                  | `vector3` with component widths, `cframe` with position widths |
| a `DataType` width brand: `f32`, `f64`, `u8`, `u16`, `u24`, `u32`, `i8`, `i16`, `i24`, `i32`                                               | `num(width)`                                                   |
| `boolean`                                                                                                                                  | `bool`                                                         |
| `boolean \| undefined`, including an optional `boolean` property                                                                           | `optional(bool)`                                               |
| a union of literal values, which may include `undefined`, including an optional property whose type is one literal value                   | `literal`                                                      |
| one item of an enum, `Enum.X.Y`, or a union of items of one enum, which may include `undefined`                                            | `enum`, or `optional(enum)` with `undefined`                   |
| `T \| undefined` with one `T`, including an optional property                                                                              | `optional` of `T`'s kind                                       |
| a union of object types sharing one property whose type is a different literal value in each; a tuple counts as an object type here (4.12) | `taggedUnion`                                                  |
| a union whose constituents are all opaque                                                                                                  | `blob`                                                         |
| any other union, subject to 4.4                                                                                                            | `guardedUnion`                                                 |
| `unknown`, `any`                                                                                                                           | `optional(blob)`                                               |
| one literal value, such as `"a"`, `1` or `true`, in any position                                                                           | `literalConst`                                                 |
| `string`                                                                                                                                   | `str`                                                          |
| `number`                                                                                                                                   | `num(f64)`                                                     |
| `buffer`                                                                                                                                   | `buffer`                                                       |
| `Vector2`, `Vector3`, `CFrame`, `Color3`                                                                                                   | `vector2`, `vector3`, `cframe`, `color3`                       |
| `ColorSequence`, `NumberSequence`                                                                                                          | `colorSequence`, `numberSequence`                              |
| `Vector3int16`, `UDim`, `UDim2`, `BrickColor`, `NumberRange`, `Rect`, `DateTime`                                                           | `datatype`                                                     |
| `Instance` and its subclasses, and every other `@rbxts/types` type with a `_nominal_` brand property, such as `Vector2int16`               | `blob`                                                         |
| a template literal type, `symbol`, `bigint`, `null`, a function or constructor type                                                        | a diagnostic (7.2)                                             |
| `T[]`, `ReadonlyArray<T>`                                                                                                                  | `array`                                                        |
| a tuple whose rest element, if it has one, is last                                                                                         | `tuple`                                                        |
| `Map<K, V>`, `ReadonlyMap<K, V>`                                                                                                           | `dict` with a key and a value                                  |
| `Set<V>`, `ReadonlySet<V>`                                                                                                                 | `dict` with a key only                                         |
| a type with both declared properties and an index signature                                                                                | a diagnostic (7.2)                                             |
| an interface or object type with declared properties                                                                                       | `object`                                                       |
| `Record<string, V>`, `Record<number, V>`, an index-signature type                                                                          | `dict` with a key and a value                                  |
| a type with no properties and no index signature: `{}`, `object`, `defined`, `void`, `undefined` or `never`                                | `blob` (4.8)                                                   |

**4.2** An object type or a union that reappears on its own walk path is a
`recursiveRef` to its first occurrence. A cycle through neither is 4.11.

**4.3** `DataType.Packed<T>`, `DataType.Length<T, L>`, `DataType.Vector<X, Y, Z>`
and `DataType.Transform<X, Y, Z>` are recognized both by alias identity and,
for a re-aliased brand, by their brand property. Alias identity is tried for
all four brands before any brand property. In a composition of brands, the
walk resolves the outermost brand and then walks its inner type, which
resolves the next.

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

**4.7** Known defect, not a guarantee: a `Map` or `Set` whose key walks to
anything other than `str`, `num` or a `guardedUnion` of the two is classified
as a `dict` per 4.1, but the generated TypeScript does not type-check, so the
build fails on a type error in generated code, with no diagnostic. This
covers a `boolean`, enum, object, `buffer` or Roblox datatype key, and a key
of one literal value or a literal union. It is tracked in
[../future-work/dict-key-typing.md](../future-work/dict-key-typing.md).

**4.8** Known defect, not a guarantee: `void`, `undefined` and `never` walk to
`blob` by the last row of 4.1, with no diagnostic. A plain
`blob` has no presence byte ([wire-format.md](wire-format.md) 9.3), so one that
holds `undefined` appends nothing to `blobs`, as a missing element does in
[wire-format.md](wire-format.md) 6.7. `deserialize` then reads each later blob
one position early and raises past the end of `inputBlobs`
([runtime-api.md](runtime-api.md) 4.5). It is tracked in
[../future-work/types-the-walk-mishandles.md](../future-work/types-the-walk-mishandles.md).

**4.9** A type that depends on a type parameter is a diagnostic (7.2), because a
serializer is generated for one concrete type. This covers a type parameter
with or without a constraint, which is not walked as its constraint, and a
type that reaches one, such as `{ v: T }` inside a generic function.

**4.10** The `Map` and `Set` rows of 4.1 match `Map`, `ReadonlyMap`, `Set` and
`ReadonlySet` only as `@rbxts/compiler-types` declares them, or as
TypeScript's own lib does in a program compiled without it. A user type with
one of those names is walked as any other type.

**4.11** Known defect, not a guarantee: a type that reappears on its own walk
path with no object type and no union on the cycle, such as
`type Nest = Nest[]` or `type Tree = [number, Tree[]]`, is not a
`recursiveRef`. The walk recurses until the stack overflows, and the
transformer throws. It is tracked in
[../future-work/types-the-walk-mishandles.md](../future-work/types-the-walk-mishandles.md).

**4.12** Known defect, not a guarantee: a union of tuples of different lengths
matches the `taggedUnion` row of 4.1, with `length` as the tag property. The
walk then walks each tuple's other members, including those it inherits from
`Array`, and reports a diagnostic for each one it cannot encode (7.2), not the
diagnostic for two table-shaped constituents. It is tracked in
[../future-work/types-the-walk-mishandles.md](../future-work/types-the-walk-mishandles.md).

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
`num`, `vector2`, `vector3`, `color3`, `datatype`, `enum`, `literal` or
`literalConst`, a `bool` outside the packed region, or a `cframe` outside a
packed subtree. A tuple's fixed elements do not share a reservation.

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
Otherwise `serialize` returns an empty `blobs` array and the
`inputBlobs` parameter is named `_inputBlobs`.

**5.10** Read-side checks are emitted only at a call site that sets
`checks: true`: one `buffer.len` per `deserialize`, a bound after every
read-side reservation, and a bound on the count an `array`, a `dict` or a
tuple's rest element reads back. That bound is the count times the element's
minimum size against the bytes left, or a fixed cap where the element reads
no bytes. A `str` or `buffer` length is bounded by the reservation it sizes.
A sequence's `u8` keypoint count gets no count bound, and each keypoint's
reservation is bounded.

**5.11** Blob pushes inside a branch that writes only when taken are emitted
inside that branch, so encounter order is the same on both sides.

**5.12** Known defect, not a guarantee: a `cframe` in a packed subtree is read
by `readPackedCFrame` rather than by a reservation, and gets no bound under
`checks: true`. A truncated one raises a Luau `buffer` error that does not
begin with `@rbxts/surge:`. It is tracked in
[../future-work/data-type-surface.md](../future-work/data-type-surface.md).

**5.13** A `createSerializer` or `createDeserializer` call site emits only the
side it returns, recursion helpers included, so its generated code refers to
no state its closure does not declare (5.3).

## 6. Injected imports

**6.1** The transformer adds one import of `@rbxts/surge` to each file where a
transformed call site uses an export, with every name aliased to a `__surge_`
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
`error TS surge: …`. Not every type the walk cannot encode is a diagnostic:
4.8 walks with none.

**7.2** The walk reports a diagnostic for:

- a type that depends on a type parameter (4.9);
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
- a `Length<T, L>` whose `T` writes no count, whose `L` is not `u8`, `u16`,
  `u24`, `u32` or a whole number that is not negative, whose `T` is a tuple
  with no rest element, or whose exact form is applied to a `dict`;
- a `Vector<X, Y, Z>` or `Transform<X, Y, Z>` component width that is not a
  `DataType` number width;
- a `Transform<X, Y, Z>` with a width other than the default inside a packed
  subtree.

**7.3** The entry point reports a diagnostic for a call site that breaks 3.2
or 3.3.

**7.4** A walk diagnostic points at the declaration of the property whose
type the walk was in, when that declaration is in the file being transformed.
Otherwise it points at the nearest enclosing property declared in that file,
or at the call site where there is none. An entry-point diagnostic points at
the call site, the options argument, the offending property or its value.

**7.5** A call site with a diagnostic is left untransformed. The transformer
throws only on a broken internal invariant and in the known defect of 4.11.

## 8. Conformance

`walk`, `emit`, `transform` and `detect` below are the `test/*.test.ts` files
of `rbxts-transformer-surge`, cited by `describe` block. Source paths are in
`rbxts-transformer-surge` unless they name `@rbxts/surge`.

| Statement | Pinned by                                                                                                                                                                                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1       | `detect`: `resolveFactoryName`; `tests/src/tests/factories.spec.ts`: `transformsAFactoryImportedUnderAnotherName`                                                                                                                                                                                                               |
| 3.2, 3.3  | `transform`: `transform diagnostics`, `transform checks option`. Source only for more than one argument, options that are not an object literal, and a quoted or shorthand `checks`: `readChecksOption` in `src/index.ts`                                                                                                       |
| 3.4       | `tests/src/tests/factories.spec.ts`: `writesTheSameBytesFromTwoCallSitesForOneType`                                                                                                                                                                                                                                             |
| 4.1       | `walk`: `TypeWalker classification`, `TypeWalker classification with fixture packages`, `TypeWalker blob classification`, `TypeWalker tuples`, `TypeWalker union guards`, `TypeWalker wire-format determinism`, and the brand blocks under 4.3                                                                                  |
| 4.2       | `walk`: `TypeWalker recursion through unions`, `TypeWalker union guards` (a recursive object type); `test/golden.test.mjs`: the recursion-helper checks                                                                                                                                                                         |
| 4.3       | `detect`: `getDataTypeBrand / getSurgeBrand`; `walk`: `TypeWalker Packed<T>`, `TypeWalker Length<T, L>`, `TypeWalker Vector<X, Y, Z> and Transform<X, Y, Z>`                                                                                                                                                                    |
| 4.4       | `walk`: `TypeWalker union guards`, `TypeWalker wire-format determinism` (two literal values of one runtime type), `TypeWalker classification with fixture packages` (a union of `Instance` subclasses is a `blob`); `emit`: `Emitter union guards`                                                                              |
| 4.5       | `walk`: `TypeWalker generic instantiation identity`                                                                                                                                                                                                                                                                             |
| 4.6       | `walk`: `TypeWalker classification` (a finite key union walks as a fixed-property object)                                                                                                                                                                                                                                       |
| 4.7       | Source only: `readDict` in `src/emit/read.ts`                                                                                                                                                                                                                                                                                   |
| 4.8       | Source only: `TypeWalker.walk` in `src/walk.ts`, its last fallback                                                                                                                                                                                                                                                              |
| 4.9       | `walk`: `TypeWalker type parameters`; `transform`: `transform diagnostics` (a call site inside a generic function)                                                                                                                                                                                                              |
| 4.10      | `walk`: `TypeWalker Map and Set by declaration`                                                                                                                                                                                                                                                                                 |
| 4.11      | Source only: `walkArrayOrTuple` in `src/walk.ts`, which records no walk in progress                                                                                                                                                                                                                                             |
| 4.12      | Source only: `classifyUnion` and `findDiscriminant` in `src/walk.ts`                                                                                                                                                                                                                                                            |
| 5.1       | `emit`: `Emitter read-order for side-effecting fields`; every round trip under `tests/src/tests/`                                                                                                                                                                                                                               |
| 5.2       | `emit`: `Emitter per-kind write/read snapshots`; `test/golden.test.mjs`: a non-recursive shape never calls a helper. Source only for the closure the helpers are declared in: `buildReplacement` in `src/index.ts`                                                                                                              |
| 5.3       | `emit`: `Emitter read-side checks` (the read state); `transform`: `transform injected imports` (the scratch buffer). Source only for the state a side with no bytes omits: `writeStateDecls` and `readStateDecls` in `src/emit/context.ts`                                                                                      |
| 5.4       | `emit`: `Emitter per-kind write/read snapshots` (the inline reservation); `transform`: `transform (end-to-end)` (the `finishWrite` import). Source only for the `buffer.create(0)` return: `finishWriteExpression` in `src/emit/context.ts`                                                                                     |
| 5.5       | `emit`: `Emitter shared reservations`; `test/golden.test.mjs`: consecutive fixed-size fields share one reservation. Source only for the 31-property bound and tuple elements: `allocRuns` and `fixedBytes` in `src/emit/layout.ts`                                                                                              |
| 5.6       | `tests/src/tests/bytes.spec.ts`: `pinsContainers` (each count ahead of its contents). Source only for the `dict` count written back: `writeDict` in `src/emit/write.ts`                                                                                                                                                         |
| 5.7       | `test/golden.test.mjs`: a count-driven read is a numeric for loop                                                                                                                                                                                                                                                               |
| 5.8       | `emit`: `Emitter local-register ceiling`; `tests/src/tests/coverage.spec.ts`: `roundTripsAnObjectWiderThanTheLocalRegisterLimit`                                                                                                                                                                                                |
| 5.9       | `transform`: `transform (end-to-end)` (no blob field, a blob field, and a blob reachable only through a recursion helper); `test/golden.test.mjs`: a shape with no blob field pays nothing for the blob side channel                                                                                                            |
| 5.10      | `emit`: `Emitter read-side checks`; `test/golden.test.mjs`: the two `checks` checks. Source only for the sequence keypoint count: `readSequence` in `src/emit/read.ts`                                                                                                                                                          |
| 5.11      | `tests/src/tests/roblox.spec.ts`: `keepsLaterBlobsInPlaceWhenAnUnknownIsUndefined`, `writesNoBlobForAnAbsentOptionalBlob`                                                                                                                                                                                                       |
| 5.12      | Source only: `readPackedCFrame` in `src/emit/read.ts`, and `readPackedCFrame` in `@rbxts/surge`'s `src/cframe.ts`                                                                                                                                                                                                               |
| 5.13      | `transform`: `transform generated code` (the single-sided factories on a recursive type); `tests/src/tests/factories.spec.ts`: `roundTripsARecursiveTypeThroughASeparateSerializerAndDeserializer`                                                                                                                              |
| 6.1, 6.2  | `transform`: `transform injected imports`, and in `transform (end-to-end)` the single shared import and the same-named local function; `tests/src/tests/coverage.spec.ts`: `leavesAUserDeclarationNamedAfterAnInjectedImportAlone`                                                                                              |
| 6.3       | `test/golden.test.mjs`: a file directive survives the transformer's injected imports; `transform`: `transform generated code` (the three directive tests)                                                                                                                                                                       |
| 6.4       | `transform`: `transform injected imports` (a `createDeserializer` call site)                                                                                                                                                                                                                                                    |
| 6.5       | Source only: `src/emit/`                                                                                                                                                                                                                                                                                                        |
| 7.1       | `transform`: `transform diagnostics` (the category). Source only for the code string: `report` in `src/index.ts`                                                                                                                                                                                                                |
| 7.2       | `walk`: `TypeWalker blob classification`, `TypeWalker bare EnumItem`, `TypeWalker classification with fixture packages`, `TypeWalker tuples`, `TypeWalker classification`, `TypeWalker union guards`, and the brand blocks under 4.3. Source only for a constituent of a kind no guard covers: `classifyUnion` in `src/walk.ts` |
| 7.3       | `transform`: `transform diagnostics`, `transform checks option`. Source only: the cases listed under 3.2 and 3.3                                                                                                                                                                                                                |
| 7.4       | `walk`: `TypeWalker diagnostic position`; `transform`: `transform diagnostics`, `transform checks option` (the positions). Source only for a property declared in another file: `nodeForProperty` in `src/walk.ts`                                                                                                              |
| 7.5       | `transform`: `transform diagnostics`. The throw is 4.11                                                                                                                                                                                                                                                                         |

## Changes

- `8ab32c4` / `e83581b`: three known defects fixed. 4.9 (a type that depends
  on a type parameter is a diagnostic), 4.10 (`Map` and `Set` by declaration)
  and 5.13 (a single-sided factory emits only its side) now state guarantees;
  4.1, 4.8, 5.2, 6.4, 7.1, 7.2 and 7.5 follow them.
- `38b634f` / `6967359`: 4.8–4.12, 5.12 and 5.13 name the future-work documents that track
  them.
- `8c4d5f5` / `87813e5`: corrected against the code: 2 (Opaque, Reservation),
  3.3, 4.1 (row order and rows), 4.2, 4.3, 4.4, 4.7 (keys), 5.2 (helper scope),
  5.3–5.6, 5.8, 5.10, 6.1, 7.1, 7.2, 7.4, 7.5 and the Conformance table; adds
  4.8–4.12, 5.12, 5.13, 6.4 and 6.5; retracts the first version's claim that a type
  the walk cannot encode is always a diagnostic.
- `16dddf8` / `05b267b`: first version, from Transformer design, Type
  coverage and Risks in the former `docs/transformer.md`. Corrects two
  statements that document made: an ambiguous table-shaped union is a
  diagnostic, not a generated structural guard, and a type the walk cannot
  encode is a diagnostic, not a `blob`.
