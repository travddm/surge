# Runtime API specification

Status: current
Applies to: `@rbxts/surge` at commit `a564714`, `rbxts-transformer-surge` at
commit `642062d` (no tagged release yet)

## 1. Scope

This specifies `@rbxts/surge`, the runtime package: the API a consumer calls,
what `deserialize` does with input it did not write, the helpers generated
code calls into, and how the package's version is coupled to the
transformer's. The bytes an encoding writes are in
[wire-format.md](wire-format.md), and what the transformer emits for a call
in [transformer.md](transformer.md). How to install the two
packages is in [../getting-started.md](../getting-started.md).

## 2. Terms

- **Factory**: `createCodec`, `createSerializer`, or `createDeserializer`.
- **Call site**: one call of a factory with a type argument, which the
  transformer replaces with a serializer generated for that type.
- **Generated code**: the Luau the transformer emits in place of a call site.
- **Blob channel**: the array of values a serializer passes alongside the
  buffer rather than writing into it (`blobs`).
- **Checks**: the `readChecks` option of `CodecOptions`.
- **Helper ABI**: the functions this package's `out/abi` module exports for
  generated code to call, as distinct from the API a consumer calls.

## 3. The consumer API

**3.1** `createCodec<T>(options?: CodecOptions): Codec<T>` returns a
`serialize` and a `deserialize` function for `T`:

```ts
type Serializer<in out T> = (value: T) => Serialized<T>;
type Deserializer<in out T> = (input: Serialized<T>) => T;

interface Codec<in out T> {
	serialize: Serializer<T>;
	deserialize: Deserializer<T>;
}

// What createCodec and createDeserializer return under readChecks (3.14).
interface CheckedDeserializer<in out T> {
	(input: Serialized<T>): T;
	(input: unknown): T;
}

interface CheckedCodec<in out T> {
	serialize: Serializer<T>;
	deserialize: CheckedDeserializer<T>;
}

// One of the two, by 3.6.
type Serialized<T> = buffer | { buffer: buffer; blobs: Array<defined> };
```

**3.2** `createSerializer<T>(options?: Pick<CodecOptions, "writeChecks">)`
returns the `serialize` function alone, typed `Serializer<T>`.

**3.3** `createDeserializer<T>(options?: Pick<CodecOptions, "readChecks">)`
returns the `deserialize` function alone, typed `Deserializer<T>`.

**3.4** Every factory call site must be replaced by the transformer at compile
time. A factory that runs untransformed raises a string saying that
`rbxts-transformer-surge` is not registered in the project's `tsconfig.json`
`plugins`; it has no other behavior.

**3.5** The buffer `serialize(value)` returns, alone or as the table's
`buffer`, holds exactly the bytes written for `value` and no more: its length
is the encoded size.

**3.6** `Serialized<T>` is the table `{ buffer, blobs }` when `T` can hold a
blob field, as 3.12 decides, and `buffer` otherwise. Where it is the table,
`blobs` holds the values the encoding passed through the blob channel, in the
order the encoding met them, and is empty when there were none.

**3.7** `deserialize(input)` takes what `serialize` returned, and reads a
value of `T` from it: from `input` itself where `Serialized<T>` is `buffer`,
and otherwise from `input.buffer`, taking blob fields from `input.blobs` in
the order `serialize` produced them.

**3.8** `CodecOptions.readChecks` and `CodecOptions.writeChecks` must be
written as literals at the call site, because the transformer decides from
them what to emit. Each defaults to `false`. `readChecks` governs
`deserialize` (section 4) and `writeChecks` governs `serialize` (3.10 and
3.11).

**3.9** The package exports the `DataType` namespace of width, length, range,
quantization and packing brands. What each brand does to the bytes is in
[wire-format.md](wire-format.md).

**3.10** With `writeChecks`, `serialize` raises a string beginning
`@rbxts/surge:` for a value that does not fit its type: a value in the exact
form of `DataType.Length<T, N>` that is not `N` long, a count larger than the
`u8`, `u16` or `u24` width `DataType.Length<T, L>` gives it, and a number that
its `DataType.Range<T, Min, Max>` does not admit
([wire-format.md](wire-format.md) 4.17). An `array` or tuple rest in the exact
form whose element is `optional`, or a `literal` that includes `undefined`,
may be shorter than `N`, which [wire-format.md](wire-format.md) 6.6 makes
valid; only a longer one raises.

**3.11** Without `writeChecks`, `serialize` does not examine lengths, counts
or numbers: a value in the exact form is truncated or padded as
[wire-format.md](wire-format.md) 6.3 and 6.7 state, a count too large for its
width wraps as 6.8 states, and a number outside its width wraps as 4.15
states, whatever its `DataType.Range`. `writeChecks` examines no other value,
and no number without a `DataType.Range`.

**3.12** `Serialized<T>` decides in the type system whether `T` can hold a
blob field, by the rows of Transformer 4.1 that make a `blob`: `unknown`,
`any`, an `Instance` or another Roblox type the transformer does not encode,
an encoded Roblox type with properties of its own, and a type with no
properties. It looks through unions, arrays, tuples, `Map`, `Set`, objects,
records and the `DataType` brands, and meets each type on a recursive path
once. Where it cannot tell, it is the table, whose `blobs` is then always
empty. A type that declares its own `_nominal_*` property is one such `T`. A
call site whose `serialize` passes a blob where `Serialized<T>` is `buffer` is
a diagnostic (Transformer 7.3).

**3.13** The package's own exports are the three factories, the types
`Codec`, `CheckedCodec`, `Serializer`, `Deserializer`, `CheckedDeserializer`,
`Serialized` and `CodecOptions`, and `DataType`. The helper ABI is a module of its own (5.1).

**3.14** With checks, `createCodec` returns `CheckedCodec<T>` and
`createDeserializer` returns `CheckedDeserializer<T>`, whose second call
signature takes `unknown` as well as the first's `Serialized<T>`.
`deserialize` reads an input of the shape `Serialized<T>` names, as 3.7
states, and any other input raises by 4.11.

## 4. What `deserialize` does with input it did not write

**4.1** Without checks, `deserialize` does not examine its input. On bytes
that no `serialize` of the same `T` produced, its behavior is unspecified: it
may raise a Luau `buffer` error, return a wrong value, or run a loop for as
long as a count in the input says.

**4.2** With checks, every read is bounded against the length of `input`. A
`CFrame` inside `Packed<T>` is bounded in two steps, because its size is in
its header: the header byte, then the bytes the header says follow.

**4.3** With checks, the count ahead of an `array`, a tuple's rest or a `dict`
is bounded against the bytes left in `input`: the count times the element's
minimum size must not exceed them. Where that minimum is zero, the count must
not exceed 2^24 instead. The minimum is a lower bound: it is zero for an
element that reads no bytes, and also for some elements that do, such as a
`recursiveRef`. The length ahead of a `str` or `buffer`, and the keypoint count
of a `ColorSequence` or `NumberSequence`, are bounded only by 4.2, through the
reads they lead to.

**4.4** With checks, an input that fails a bound in 4.2 or 4.3 raises a string
beginning `@rbxts/surge:`.

**4.5** Reading past the end of `blobs` raises a string beginning
`@rbxts/surge:`, with or without checks.

**4.6** Reading a blob field from an input that has no `blobs` raises a
string beginning `@rbxts/surge:`, with or without checks.

**4.7** Checks examine lengths and counts, and the two indexes of 4.9. An input
that passes them deserializes to a value of the right type, except in its blob
fields: each holds whatever `blobs` holds at its position, which checks
do not examine. Which value of the right type it is, such as a number outside
the range a caller expects, is the caller's to check, and that includes a
number outside its `DataType.Range<T, Min, Max>`: checks do not compare it.

**4.8** The input buffer and the read cursor are reset at the start of every
`deserialize` of a `T` that reads bytes, and the blob index at the start of
every `deserialize` of a `T` that has a blob field — which is every call that
can read one. A call that raised leaves no state that a later call reads, so a
`pcall` around `deserialize` is sufficient to reject an input.

**4.9** With checks, an `enum` index past the items its type admits, and a
packed `CFrame` header whose rotation code is from 24 to 30, raise a string
beginning `@rbxts/surge:`.

**4.10** Without checks, the two indexes of 4.9 are not examined, as 4.1
states: an `enum` index past its items reads back as `undefined`, and a packed
rotation code from 24 to 30 raises a Luau error that does not begin
`@rbxts/surge:`.

**4.11** With checks, an input that is not of the shape `Serialized<T>`
names raises a string beginning `@rbxts/surge:` before anything is read:
where `Serialized<T>` is `buffer`, any input but a buffer, and where it is
the table, any input but a table whose `buffer` is a buffer and whose
`blobs` is a table.

## 5. The helper ABI

**5.1** Generated code calls only the following exports of the package's
`out/abi` module, which it imports as `@rbxts/surge/out/abi`. Their
signatures are part of the coupling in section 6.

| Export              | Called                                     | Contract                                                                                                                                                  |
| ------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grow`              | when a reservation passes the capacity     | `grow(current, live, needed)` returns a buffer of at least `needed` bytes whose first `live` bytes are `current`'s. `current` must have a nonzero length. |
| `finishWrite`       | once per `serialize`, except as 5.4 states | `finishWrite(written, size)` returns a new buffer of exactly `size` bytes holding `written`'s first `size`.                                               |
| `writePackedCFrame` | per `CFrame` inside `Packed<T>`            | writes the packed form at the given offset and returns the bytes it used.                                                                                 |
| `readPackedCFrame`  | per `CFrame` inside `Packed<T>`            | reads the packed form at the given offset and returns the value and the bytes it used.                                                                    |
| `unpackBit`         | per bit read inside `Packed<T>`            | `unpackBit(buf, byteOffset, bitIndex)` returns that bit.                                                                                                  |
| `beginWriteBlobs`   | once per `serialize`, if `T` has a blob    | starts an empty write-side blob list.                                                                                                                     |
| `pushBlob`          | per blob field written                     | appends a value to the write-side blob list.                                                                                                              |
| `finishWriteBlobs`  | once per `serialize`, if `T` has a blob    | returns the write-side blob list.                                                                                                                         |
| `beginReadBlobs`    | once per `deserialize`, if `T` has a blob  | sets the read-side blob list to `input.blobs` and its index to the first element.                                                                         |
| `nextBlob`          | per blob field read                        | returns the next read-side blob, or raises per 4.5 and 4.6.                                                                                               |

**5.2** The package owns no scratch buffer and no byte cursor. Each generated
serializer declares, in the closure it is emitted into, the scratch buffer,
capacity and write cursor its `serialize` uses and the read cursor its
`deserialize` uses, and reserves bytes inline. The blob channel's state is
the exception, in 5.5.

**5.3** The write side of a `Packed<T>` bit region calls no helper: it is
emitted inline, one whole byte at a time.

**5.4** A `serialize` of a `T` that reserves no bytes, such as a `T` whose
every field is a `blob`, has no scratch buffer. It calls neither `grow` nor
`finishWrite`, and its `buffer` is `buffer.create(0)`.

**5.5** The blob channel's write list, read list and read index are module
state in this package, shared by every serializer. A `serialize` of a `T`
that has a blob field must not start while another such `serialize` is
running. A `deserialize` of a `T` that has a blob field must not start while
another such `deserialize` is running. 5.7 states what can start one.

**5.6** The state of 5.2 belongs to a serializer, not to a call. A `serialize`
must not start while a `serialize` of the same serializer is running, and a
`deserialize` must not start while a `deserialize` of the same serializer is
running, whatever `T` is. A call that starts anyway resets the cursor that the
running call uses. The running `serialize` then returns wrong bytes without
an error, and the running `deserialize` reads the rest of its value from the
other call's input.

**5.7** A serializer runs code that it did not generate only through the
metamethods of a table it is given. Only a metamethod can therefore start a
call that 5.5 or 5.6 forbids: by calling a serializer itself, or, in the case
of the iterator function that an `__iter` metamethod returns, by yielding
while another thread calls one. Luau lets that iterator yield from release
0.736, and from release 0.722 behind a flag; in an earlier release, the yield
raises. `__index` and `__len` cannot yield.

**5.8** A call of one serializer may start while a call of a different
serializer is running, unless 5.5 forbids it. Each call then returns what it
returns when it runs alone.

## 6. Version coupling

**6.1** Generated code calls the helper ABI of section 5 with no version
negotiation. A consumer must pin `@rbxts/surge` and `rbxts-transformer-surge`
to the same release and must update them together.

**6.2** Nothing checks, at compile time or at run time, that the two pinned
versions match. A mismatch surfaces as a call to a helper that does not exist
or whose contract has changed.

## 7. Conformance

A test file named `*.spec.ts` is under `tests/src/tests/`. A path starting
`emit/` is under `src/` of `rbxts-transformer-surge`, and a path starting
`src/` is in `@rbxts/surge`.

| Statement                   | Pinned by                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1–3.3                     | `factories.spec.ts`: round trip through a codec and through a separate serializer and deserializer                                                                                                                                                                                                                                                                                                                                 |
| 3.4                         | Source only: `notConfigured` in `src/serializer.ts`; no test runs a factory untransformed                                                                                                                                                                                                                                                                                                                                          |
| 3.5                         | `bytes.spec.ts`, which compares every pinned encoding's whole buffer                                                                                                                                                                                                                                                                                                                                                               |
| 3.6                         | `roblox.spec.ts`: `passesUnknownAndInstanceValuesThroughTheBlobChannel`, `keepsLaterBlobsInPlaceWhenAnUnknownIsUndefined`, `writesNoBlobForAnAbsentOptionalBlob`; the buffer alone: `factories.spec.ts`: `passesTheBufferAloneForAShapeWithNoBlob`, and `test/golden.test.mjs`: a shape with no blob field returns the buffer alone; the empty array: `rbxts-transformer-surge` `test/transform.test.ts`, `transform (end-to-end)` |
| 3.7                         | `factories.spec.ts`: `passesTheBufferAloneForAShapeWithNoBlob`; `test/golden.test.mjs`: `deserialize` takes what `serialize` returned; `rbxts-transformer-surge` `test/transform.test.ts`, `transform (end-to-end)`: the declared table at a `createDeserializer` call site                                                                                                                                                        |
| 3.8                         | `test/golden.test.mjs`: a serializer without `readChecks` carries no read-side check, and one with it carries them; `rbxts-transformer-surge` `test/transform.test.ts`: `transform readChecks option`, `transform writeChecks option`                                                                                                                                                                                              |
| 3.9                         | Source: `src/data-type.ts`; each brand's bytes are pinned in `bytes.spec.ts`                                                                                                                                                                                                                                                                                                                                                       |
| 3.10                        | `checks.spec.ts`: `rejectsAnExactLengthValueOfAnyOtherLength`, `letsAnExactArrayOfOptionalsBeShorterButNotLonger`, `rejectsACountPastItsWidth`, `rejectsANumberItsRangeDoesNotAdmit`                                                                                                                                                                                                                                               |
| 3.11                        | `checks.spec.ts`: `wrapsACountPastItsWidthWithoutWriteChecks`, `wrapsANumberOutsideItsRangeWithoutWriteChecks`; `collections.spec.ts`: `padsAShortExactArrayOfOptionalsInsteadOfRaising`                                                                                                                                                                                                                                           |
| 3.12                        | `rbxts-transformer-surge` `test/transform.test.ts`, `transform (end-to-end)`: the declared result has a blobs array exactly when the walk finds a blob, on fourteen shapes; every call site under `tests/src/`, each of which Transformer 7.3 would reject. Source: `Serialized` in `src/serializer.ts`                                                                                                                            |
| 3.13                        | `test/golden.test.mjs`: generated code imports its helpers from the package's abi module, whose second half reads `out/index.d.ts`. Source: `src/index.ts`                                                                                                                                                                                                                                                                         |
| 3.14                        | `checks.spec.ts`: `rejectsAnythingButABufferForAShapeWithNoBlob`, `rejectsAnythingButItsTableForAShapeWithABlob`; `rbxts-transformer-surge` `test/transform.test.ts`, `transform readChecks option`: a caller passing `unknown`, and without `readChecks` it does not type-check                                                                                                                                                   |
| 4.1                         | Source only: the unchecked read path under `emit/`; a statement of what is not guaranteed has nothing to pin                                                                                                                                                                                                                                                                                                                       |
| 4.2–4.4                     | `checks.spec.ts`: `rejectsATruncatedPayload`, `rejectsATruncatedPackedCFrame`, `rejectsACountTheInputCannotHold`, `rejectsACountOfElementsThatReadNoBytes`                                                                                                                                                                                                                                                                         |
| 4.3 (no over-rejection)     | `checks.spec.ts`: `acceptsWhatSerializeWrote`, `acceptsEveryKindThatReadsACount`, `acceptsEmptyContainers`                                                                                                                                                                                                                                                                                                                         |
| 4.3 (minimum size, lengths) | Source only: `minBytes` in `emit/layout.ts`; `readStr`, `readBuffer` and `readSequence` in `emit/read.ts` check no count                                                                                                                                                                                                                                                                                                           |
| 4.5                         | With checks: `checks.spec.ts`: `rejectsAReadPastTheEndOfTheBlobs`. Without: source only, `nextBlob` in `src/blobs.ts`, which `readChecks` does not change                                                                                                                                                                                                                                                                          |
| 4.6                         | Source only: `nextBlob` in `src/blobs.ts`                                                                                                                                                                                                                                                                                                                                                                                          |
| 4.7                         | `checks.spec.ts`: `acceptsWhatSerializeWrote`; a `DataType.Range`: `rbxts-transformer-surge` `test/emit.test.ts`, `Emitter write-side checks`. Source only for what checks do not examine: the emitter compares no value but the two indexes of 4.9, and `nextBlob` in `src/blobs.ts` returns the element of the input's `blobs` as it is                                                                                          |
| 4.8                         | Source only: the generated `deserialize` prologue and `beginReadBlobs`; no test raises and then deserializes again                                                                                                                                                                                                                                                                                                                 |
| 4.9                         | `checks.spec.ts`: `rejectsAnEnumIndexPastItsItems`, `rejectsAPackedRotationCodeThatNamesNoRotation`                                                                                                                                                                                                                                                                                                                                |
| 4.10                        | Source only: `enumFromIndexExpr` in `emit/read.ts`; `readPackedCFrame` in `src/cframe.ts`                                                                                                                                                                                                                                                                                                                                          |
| 4.11                        | `checks.spec.ts`: `rejectsAnythingButABufferForAShapeWithNoBlob`, `rejectsAnythingButItsTableForAShapeWithABlob`; `test/golden.test.mjs`: a serializer with `readChecks` carries them. Source only for the order: `buildCheckedDeserialize` in `src/index.ts` of `rbxts-transformer-surge` checks before the body                                                                                                                  |
| 5.1                         | `test/golden.test.mjs`: generated code imports its helpers from the package's abi module. Source: the calls the emitter makes under `emit/`, and the exports of `src/abi.ts`                                                                                                                                                                                                                                                       |
| 5.2                         | `test/golden.test.mjs`: consecutive fixed-size fields share one reservation, inline                                                                                                                                                                                                                                                                                                                                                |
| 5.3                         | `test/golden.test.mjs`: packed booleans never call a per-bit `packBit` helper                                                                                                                                                                                                                                                                                                                                                      |
| 5.4                         | Source only: `finishWriteExpression` and `writeStateDecls` in `emit/context.ts`                                                                                                                                                                                                                                                                                                                                                    |
| 5.5                         | Source only: the module state in `src/blobs.ts`                                                                                                                                                                                                                                                                                                                                                                                    |
| 5.6                         | Source only: `writeStateDecls` and `readStateDecls` in `emit/context.ts` declare the state once per closure, and `beginWriteStatements` and `beginReadStatements` reset it per call; no test re-enters a serializer                                                                                                                                                                                                                |
| 5.7                         | Source only: the emitter reads a value's properties, lengths and `for … in` iterations under `emit/`, and calls nothing else of the value's. Which metamethods may yield is Luau's: `luaD_call` and `luaD_performcally` in its `VM/src/ldo.cpp`. No test yields inside `serialize`, because Lune 0.10.5 bundles Luau 0.709                                                                                                         |
| 5.8                         | `overlap.spec.ts`: `runsAnotherSerializerInsideAnIterator`, a call from inside an `__iter` iterator. A call while an iterator is suspended is not run, as the 5.7 row states                                                                                                                                                                                                                                                       |
| 6.1–6.2                     | Source only: no version field is read or written by either package                                                                                                                                                                                                                                                                                                                                                                 |

## Changes

- `a564714` / `642062d`: 3.14 states what `readChecks` makes `createCodec`
  and `createDeserializer` return, which an unnumbered paragraph after 3.3
  said; Conformance rows 3.1–3.3 and 4.7 corrected.
- `85f2241` / `642062d`: 3.14 and 4.11 accept only the shape `Serialized<T>`
  names, where they accepted either; 3.1, 3.3 and 3.13 name `CheckedCodec<T>`
  and `CheckedDeserializer<T>` in place of the types' second parameter.
- `0849e60` / `802a94f`: adds 3.14 (with checks, `deserialize` takes
  `unknown`) and 4.11 (the input's shape is checked); 3.1 and 3.3 give the
  types a second parameter for what `deserialize` takes.
- `b7b0746` / `7422117`: 3.1–3.3 name `createCodec`, `Codec<T>`,
  `Serializer<T>`, `Deserializer<T>` and `CodecOptions`; 3.7:
  `deserialize` takes what `serialize` returned; 3.8 names `readChecks`;
  adds 3.13 (what the package exports); 5.1: the helpers are in `out/abi`;
  5.3: `packBit` is removed; 2 and 4.5–4.7 follow them.
- `4801267` / `32ca81c`: 3.1, 3.5, 3.6 and 3.12: `Serialized<T>` is the
  buffer itself for a `T` that can hold no blob; 3.1 no longer describes
  fbs's `Serializer<T>`.
- `984a9cc` / `08bd04e`: 3.1 and 3.6 give `serialize` the result type
  `Serialized<T>`, which has no `blobs` array for a `T` that can hold no blob;
  adds 3.12 (how `Serialized<T>` decides).
- `9fcca62` / `0710f5d`: adds 5.8 (a call of a different serializer may
  overlap), pinned by `overlap.spec.ts`; 5.7 names the Luau release from
  which an `__iter` iterator may yield.
- `1bfb702` / `0710f5d`: adds 5.6 (a serializer is not re-entrant, whatever
  `T` is) and 5.7 (what can start a second call, including an `__iter`
  iterator that yields); 5.5 points at 5.7.
- `86f729b` / `c8481d3`: 3.9 names the range and quantization brands; 3.10
  and 3.11 add a number under `DataType.Range<T, Min, Max>` to what
  `writeChecks` examines, and 4.7 states that checks do not.
- `be5d3e6` / `04cda66`: the Scope points at `getting-started.md` for
  installation.
- `fec89a8` / `17fda41`: adds `writeChecks`. 3.2, 3.3 and 3.8 give
  each factory the options of its own side; adds 3.10 (what `writeChecks`
  rejects) and 3.11 (what `serialize` does without it).
- `a7cb730` / `84e0abb`: the two gaps in `checks` closed. 4.2 (a
  packed `CFrame` is bounded) and 4.9 (checks reject an `enum` index past its
  items and a rotation code that names no rotation) now state guarantees;
  4.7 (a value of the right type, blob fields excepted) and 4.10 follow them.
- `a597b56` / `9fc05be`: 4.9 and 4.10 name the future-work document that tracks them.
- `aff15c3` / `b8ace27`: corrected against the code: 4.2 (a packed `CFrame`
  read is not bounded), 4.3 (which counts are bounded, and how), 4.7 (unchecked
  indexes), 4.8 (a `T` that reads bytes), 5.1 (`finishWrite` for a `T` that
  reserves no bytes), 5.2 (the blob channel is the exception); adds 4.9, 4.10,
  5.4 and 5.5; Conformance rows corrected.
- `c1cb304` / `058495f`: 5.3 states that `packBit` is a public primitive and
  that the bit region is written one whole byte at a time; the Scope and 3.9
  point at the new specifications.
- `78af06a` / `058495f`: first version, from `docs/serde.md`. Corrects that
  document's statement that the factories have no runtime body (3.4).
