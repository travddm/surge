# Transformer specification

Status: current
Applies to: `@rbxts/surge` at commit `16dddf8`, `rbxts-transformer-surge` at
commit `05b267b` (no tagged release yet)

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
- **`Field` kind**: as in [wire-format.md](wire-format.md).
- **Table-shaped**: an `object`, `array`, `tuple` or `dict`, all of which are
  a Luau table at run time and cannot be told apart by `typeIs(value, "table")`.
- **Reservation**: the inline code that advances a serializer's write cursor
  by a number of bytes, growing its scratch buffer when the cursor passes the
  capacity.
- **Diagnostic**: an error the transformer reports through the TypeScript
  program instead of emitting code.

## 3. Detection

**3.1** A call is a call site when its callee resolves, following import
aliases, to the declaration of `createBinarySerializer`, `createSerializer` or
`createDeserializer` in `@rbxts/surge`. A declaration of the same name that
does not resolve to one of those is not transformed.

**3.2** A call site must have exactly one explicit type argument. The type is
never inferred from the call's contextual type.

**3.3** A call site may pass one options argument, which must be an object
literal with at most the property `checks`, whose value must be the literal
`true` or `false`. `createSerializer` takes no options.

**3.4** Each call site is transformed independently of every other: two call
sites for one type generate two serializers, and write the same bytes.

## 4. Classification

**4.1** The walk classifies a type as follows. The first row that matches
applies.

| TypeScript type                                                                                     | `Field` kind                             |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `number`                                                                                            | `num(f64)`                               |
| a `DataType` width brand: `f32`, `f64`, `u8`, `u16`, `u24`, `u32`, `i8`, `i16`, `i24`, `i32`        | `num(width)`                             |
| `boolean`                                                                                           | `bool`                                   |
| `string`                                                                                            | `str`                                    |
| `buffer`                                                                                            | `buffer`                                 |
| `Vector2`, `Vector3`, `CFrame`, `Color3`                                                            | `vector2`, `vector3`, `cframe`, `color3` |
| `Vector3int16`, `UDim`, `UDim2`, `BrickColor`, `NumberRange`, `Rect`, `DateTime`                    | `datatype`                               |
| `ColorSequence`, `NumberSequence`                                                                   | `colorSequence`, `numberSequence`        |
| an item of one specific enum, `Enum.X`                                                              | `enum`                                   |
| an interface or object type with declared properties and no index signature                         | `object`                                 |
| `T[]`                                                                                               | `array`                                  |
| a tuple, with at most one rest element, last                                                        | `tuple`                                  |
| `Map<K, V>`, `ReadonlyMap<K, V>`, `Record<string, V>`, `Record<number, V>`, an index-signature type | `dict` with a key and a value            |
| `Set<V>`, `ReadonlySet<V>`                                                                          | `dict` with a key only                   |
| a required property whose type is exactly one literal value                                         | `literalConst`                           |
| a union of two or more literal values, which may include `undefined`                                | `literal`                                |
| `T \| undefined`, or an optional property                                                           | `optional`                               |
| a union of object types sharing one property whose literal value is unique per variant              | `taggedUnion`                            |
| any other union, subject to 4.4                                                                     | `guardedUnion`                           |
| `unknown`, `any`                                                                                    | `optional(blob)`                         |
| `Instance` and its subclasses, a Roblox datatype with no row above, `defined`                       | `blob`                                   |

**4.2** A type that reappears on its own walk path is a `recursiveRef` to the
first occurrence.

**4.3** `DataType.Packed<T>`, `DataType.Length<T, L>`, `DataType.Vector<X, Y, Z>`
and `DataType.Transform<X, Y, Z>` are recognized both by alias identity and,
for a re-aliased brand, by their brand property. A composition of brands
resolves every brand before any brand property is consulted.

**4.4** A union is a `guardedUnion` only if the write side can tell every
constituent apart at run time: at most one constituent is table-shaped, no two
constituents share a runtime type, and no constituent is opaque. A primitive
constituent is guarded by its `typeIs` tag, a Roblox datatype by its own type
name, a single enum item by `"EnumItem"`, and a recursive object type by
`"table"`.

**4.5** Each generic instantiation is walked on its own: `Box<number>` and
`Box<string>` are two types, whatever declaration they share.

**4.6** A `Record` whose key is a finite union of literals is an `object` with
one property per key, not a `dict`.

**4.7** Known defect, not a guarantee: a `Map` or `Set` whose key is a Roblox
datatype or a literal union is classified as a `dict` per 4.1, but the
generated TypeScript does not type-check, so the build fails with no
diagnostic. It is tracked in
[../future-work/dict-key-typing.md](../future-work/dict-key-typing.md).

## 5. Emission

**5.1** A call site is replaced by generated code for its type: a
`serialize` function, a `deserialize` function, or both, according to the
factory. Both are generated from the same `Field` tree, and `deserialize`
reads fields in the order `serialize` writes them.

**5.2** Each function is one flat body with no run-time dispatch on `Field`
kind. Nested objects, arrays and tuples are inlined. A `recursiveRef` is the
one exception: its type compiles to a named helper function, local to the
module, called at each recursion point.

**5.3** Each generated serializer owns its scratch buffer, its capacity and
its write and read cursors, declared in the closure it is generated into.
The runtime package owns none of them.

**5.4** Every reservation is emitted inline and calls `grow` only when it
passes the capacity. A top-level `serialize` ends with one call to
`finishWrite`.

**5.5** A run of consecutive fixed-size fields shares one reservation. A run
ends at 31 fields.

**5.6** A count is reserved before its contents, the entries are counted as
they are written, and the count is written back once known.

**5.7** A count-driven read loop is emitted as `for (const _i of $range(1, count))`,
which roblox-ts lowers to a Luau numeric `for`.

**5.8** The emitter counts the locals each generated function declares. Past
120, it wraps an object's fields, or a tuple's fixed elements, in blocks of
at most 32 locals, and builds such an object on the read side by assignment
rather than with one table constructor. The instruction-count limit of a Luau
function is not handled.

**5.9** The blob channel's entry points, `beginWriteBlobs`,
`finishWriteBlobs` and `beginReadBlobs`, are emitted only where the body
reaches `pushBlob` or `nextBlob`, including from inside a recursion helper.
Otherwise `serialize` returns an empty `blobs` array and the
`inputBlobs` parameter is named `_inputBlobs`.

**5.10** Read-side checks are emitted only at a call site that sets
`checks: true`: one `buffer.len` per `deserialize`, a bound after every
read-side reservation, and a bound on every count read back, which is the
count times the element's minimum size against the bytes left, or a fixed
cap where the element reads no bytes.

**5.11** Blob pushes inside a branch that writes only when taken are emitted
inside that branch, so encounter order is the same on both sides.

## 6. Injected imports

**6.1** The transformer adds one import of `@rbxts/surge` per file that has a
call site, with every name aliased to a `__surge_` prefix, so no user
declaration can collide with or shadow it. The closure-scoped buffer and
cursors carry the same prefix.

**6.2** The imports are named imports, which roblox-ts compiles to one local
each.

**6.3** A file's leading comments move onto the injected import, so a `--!`
directive stays ahead of the first line of code and a file header keeps its
order.

## 7. Diagnostics

**7.1** A type the transformer cannot encode is a diagnostic, never a silent
fallback. Each is a TypeScript diagnostic of category `Error` whose code is
the string `surge`, so roblox-ts prints it as `error TS surge: …`.

**7.2** The walk reports a diagnostic for:

- a template literal type, `symbol`, `bigint`, `null`, or a function type;
- a type with both declared properties and an index signature;
- a bare `EnumItem`, with no specific enum;
- a union of items from two enums;
- a tuple whose rest element is not last;
- a union the write side cannot guard (4.4): an opaque constituent next to
  another, a constituent of a kind no guard covers, two or more table-shaped
  constituents with no discriminant, or two or more constituents with the
  same runtime type;
- a `Length<T, L>` whose `T` writes no count, whose `L` is not `u8`, `u16`,
  `u24`, `u32` or a whole number that is not negative, or whose exact form is
  applied to a `dict`, or to a tuple with no rest element;
- a `Vector<X, Y, Z>` or `Transform<X, Y, Z>` component width that is not a
  `DataType` number width;
- a `Transform<X, Y, Z>` inside a packed subtree.

**7.3** The entry point reports a diagnostic for a call site that breaks 3.2
or 3.3.

**7.4** A diagnostic points at the declaration of the offending property when
that declaration is in the file being transformed, and at the call site
otherwise.

**7.5** A call site with a diagnostic is left untransformed. A thrown
exception is reserved for a broken internal invariant.

## 8. Conformance

`walk`, `emit`, `transform` and `detect` below are the `test/*.test.ts` files
of `rbxts-transformer-surge`, cited by `describe` block.

| Statement | Pinned by                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.1       | `detect`: `resolveFactoryName`; `tests/src/tests/factories.spec.ts`: `transformsAFactoryImportedUnderAnotherName`                                            |
| 3.2, 3.3  | `transform`: `transform diagnostics`, `transform checks option`                                                                                              |
| 3.4       | `tests/src/tests/factories.spec.ts`: `writesTheSameBytesFromTwoCallSitesForOneType`                                                                          |
| 4.1       | `walk`: `TypeWalker classification`, `TypeWalker classification with fixture packages`, `TypeWalker blob classification`, `TypeWalker tuples`                |
| 4.2       | `walk`: `TypeWalker recursion through unions`; `test/golden.test.mjs`: the recursion-helper checks                                                           |
| 4.3       | `detect`: `getDataTypeBrand / getSurgeBrand`; `walk`: `TypeWalker Packed<T>`, `TypeWalker Length<T, L>`, `TypeWalker Vector<X, Y, Z> and Transform<X, Y, Z>` |
| 4.4       | `walk`: `TypeWalker union guards`; `emit`: `Emitter union guards`                                                                                            |
| 4.5       | `walk`: `TypeWalker generic instantiation identity`                                                                                                          |
| 4.6       | Source only: the property walk handles a finite `keyof T` before the index-signature check                                                                   |
| 4.7       | Not pinned: a known defect. `tests/src/tests/checks.spec.ts` uses a `Set<string>` in its place                                                               |
| 5.1       | `emit`: `Emitter read-order for side-effecting fields`; every round trip under `tests/src/tests/`                                                            |
| 5.2       | `emit`: `Emitter per-kind write/read snapshots`; `test/golden.test.mjs`: a non-recursive shape never calls a helper                                          |
| 5.3, 5.4  | `emit`: `Emitter per-kind write/read snapshots`                                                                                                              |
| 5.5       | `emit`: `Emitter shared reservations`; `test/golden.test.mjs`: consecutive fixed-size fields share one reservation                                           |
| 5.6       | `tests/src/tests/bytes.spec.ts`: `pinsContainers`                                                                                                            |
| 5.7       | `test/golden.test.mjs`: a count-driven read is a numeric for loop                                                                                            |
| 5.8       | `emit`: `Emitter local-register ceiling`; `tests/src/tests/coverage.spec.ts`: `roundTripsAnObjectWiderThanTheLocalRegisterLimit`                             |
| 5.9       | `test/golden.test.mjs`: a shape with no blob field pays nothing for the blob side channel                                                                    |
| 5.10      | `emit`: `Emitter read-side checks`; `test/golden.test.mjs`: the two `checks` checks                                                                          |
| 5.11      | `emit`: `Emitter read-order for side-effecting fields`; `tests/src/tests/roblox.spec.ts`: `keepsLaterBlobsInPlaceWhenAnUnknownIsUndefined`                   |
| 6.1, 6.2  | `transform`: `transform injected imports`; `tests/src/tests/coverage.spec.ts`: `leavesAUserDeclarationNamedAfterAnInjectedImportAlone`                       |
| 6.3       | `test/golden.test.mjs`: a file directive survives the transformer's injected imports                                                                         |
| 7.1–7.3   | `transform`: `transform diagnostics`; `walk`: each rejection's own `describe` block above                                                                    |
| 7.4       | `walk`: `TypeWalker diagnostic position`                                                                                                                     |
| 7.5       | `transform`: `transform diagnostics`                                                                                                                         |

## Changes

- `16dddf8` / `05b267b`: first version, from Transformer design, Type
  coverage and Risks in the former `docs/transformer.md`. Corrects two
  statements that document made: an ambiguous table-shaped union is a
  diagnostic, not a generated structural guard, and a type the walk cannot
  encode is a diagnostic, not a `blob`.
