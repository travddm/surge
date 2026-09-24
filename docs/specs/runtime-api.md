# Runtime API specification

Status: current
Applies to: `@rbxts/surge` at commit `f0b68ef`, `rbxts-transformer-surge` at
commit `b954fd2` (no tagged release yet)

## 1. Scope

This specifies `@rbxts/surge`, the runtime package: the API a consumer calls,
what `deserialize` does with input it did not write, the helpers generated
code calls into, and how the package's version is coupled to the
transformer's. The bytes an encoding writes are in
[wire-format.md](wire-format.md), and what the transformer emits for a call
in [transformer.md](transformer.md). How to install the two
packages is in [../serde.md](../serde.md) until a user page takes it.

## 2. Terms

- **Factory**: `createBinarySerializer`, `createSerializer`, or
  `createDeserializer`.
- **Call site**: one call of a factory with a type argument, which the
  transformer replaces with a serializer generated for that type.
- **Generated code**: the Luau the transformer emits in place of a call site.
- **Blob channel**: the array of values a serializer passes alongside the
  buffer rather than writing into it (`blobs`, `inputBlobs`).
- **Checks**: the `checks` option of `SerializerOptions`.
- **Helper ABI**: the functions this package exports for generated code to
  call, as distinct from the API a consumer calls.

## 3. The consumer API

**3.1** `createBinarySerializer<T>(options?: SerializerOptions): Serializer<T>`
returns a serializer for `T`:

```ts
interface Serializer<T> {
	serialize: (value: T) => { buffer: buffer; blobs: Array<defined> };
	deserialize: (input: buffer, inputBlobs?: Array<defined>) => T;
}
```

This is the shape and blob-array calling convention of
flamework-binary-serializer's `Serializer<T>`.

**3.2** `createSerializer<T>()` returns the `serialize` function alone. It
takes no options.

**3.3** `createDeserializer<T>(options?: SerializerOptions)` returns the
`deserialize` function alone.

**3.4** Every factory call site must be replaced by the transformer at compile
time. A factory that runs untransformed raises a string saying that
`rbxts-transformer-surge` is not registered in the project's `tsconfig.json`
`plugins`; it has no other behavior.

**3.5** `serialize(value).buffer` holds exactly the bytes written for `value`
and no more: its length is the encoded size.

**3.6** `serialize(value).blobs` holds the values the encoding passed through
the blob channel, in the order the encoding met them. A shape with no blob
field returns an empty array.

**3.7** `deserialize(input, inputBlobs)` reads a value of `T` from `input`,
taking blob fields from `inputBlobs` in the order `serialize` produced them.
`inputBlobs` may be omitted when `T` has no blob field.

**3.8** `SerializerOptions.checks` must be written as a literal at the call
site, because the transformer decides from it what to emit. It defaults to
`false`.

**3.9** The package exports the `DataType` namespace of width, length and
packing brands. What each brand does to the bytes is in
[wire-format.md](wire-format.md).

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

**4.5** Reading past the end of `inputBlobs` raises a string beginning
`@rbxts/surge:`, with or without checks.

**4.6** Reading a blob field when `inputBlobs` was omitted raises a string
beginning `@rbxts/surge:`, with or without checks.

**4.7** Checks examine lengths and counts, and the two indexes of 4.9. An input
that passes them deserializes to a value of the right type. Which value of
that type it is, such as a number outside the range a caller expects, is the
caller's to check.

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

## 5. The helper ABI

**5.1** Generated code calls only the following exports. Their signatures are
part of the coupling in section 6.

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
| `beginReadBlobs`    | once per `deserialize`, if `T` has a blob  | sets the read-side blob list to `inputBlobs` and its index to the first element.                                                                          |
| `nextBlob`          | per blob field read                        | returns the next read-side blob, or raises per 4.5 and 4.6.                                                                                               |

**5.2** The package owns no scratch buffer and no byte cursor. Each generated
serializer declares, in the closure it is emitted into, the scratch buffer,
capacity and write cursor its `serialize` uses and the read cursor its
`deserialize` uses, and reserves bytes inline. The blob channel's state is
the exception, in 5.5.

**5.3** `packBit` is exported as a public primitive for hand-written callers
and is not called by generated code: the write side of a `Packed<T>` bit
region is emitted inline, one whole byte at a time.

**5.4** A `serialize` of a `T` that reserves no bytes, such as a `T` whose
every field is a `blob`, has no scratch buffer. It calls neither `grow` nor
`finishWrite`, and its `buffer` is `buffer.create(0)`.

**5.5** The blob channel's write list, read list and read index are module
state in this package, shared by every serializer. A `serialize` of a `T`
that has a blob field must not start while another such `serialize` is
running. A `deserialize` of a `T` that has a blob field must not start while
another such `deserialize` is running. Only code a serializer calls while it
runs, such as a metamethod of the value, can start one.

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

| Statement                   | Pinned by                                                                                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1–3.3                     | `factories.spec.ts`: round trip through the bundled serializer and through separate ones                                                                                                                                                                |
| 3.4                         | Source only: `notConfigured` in `src/serializer.ts`; no test runs a factory untransformed                                                                                                                                                               |
| 3.5                         | `bytes.spec.ts`, which compares every pinned encoding's whole buffer                                                                                                                                                                                    |
| 3.6                         | `roblox.spec.ts`: `passesUnknownAndInstanceValuesThroughTheBlobChannel`, `keepsLaterBlobsInPlaceWhenAnUnknownIsUndefined`, `writesNoBlobForAnAbsentOptionalBlob`; the empty array: `factories.spec.ts`: `deserializesAShapeWithNoBlobWithoutInputBlobs` |
| 3.7                         | `factories.spec.ts`: `deserializesAShapeWithNoBlobWithoutInputBlobs`                                                                                                                                                                                    |
| 3.8                         | `test/golden.test.mjs`: a serializer without `checks` carries no read-side check, and one with it carries them                                                                                                                                          |
| 3.9                         | Source: `src/data-type.ts`; each brand's bytes are pinned in `bytes.spec.ts`                                                                                                                                                                            |
| 4.1                         | Source only: the unchecked read path under `emit/`; a statement of what is not guaranteed has nothing to pin                                                                                                                                            |
| 4.2–4.4                     | `checks.spec.ts`: `rejectsATruncatedPayload`, `rejectsATruncatedPackedCFrame`, `rejectsACountTheInputCannotHold`, `rejectsACountOfElementsThatReadNoBytes`                                                                                              |
| 4.3 (no over-rejection)     | `checks.spec.ts`: `acceptsWhatSerializeWrote`, `acceptsEveryKindThatReadsACount`, `acceptsEmptyContainers`                                                                                                                                              |
| 4.3 (minimum size, lengths) | Source only: `minBytes` in `emit/layout.ts`; `readStr`, `readBuffer` and `readSequence` in `emit/read.ts` check no count                                                                                                                                |
| 4.5                         | With checks: `checks.spec.ts`: `rejectsAReadPastTheEndOfTheBlobs`. Without: source only, `nextBlob` in `src/blobs.ts`, which `checks` does not change                                                                                                   |
| 4.6                         | Source only: `nextBlob` in `src/blobs.ts`                                                                                                                                                                                                               |
| 4.7                         | `checks.spec.ts`: `acceptsWhatSerializeWrote`. Source only for the values checks do not examine: the emitter compares no value but the two indexes of 4.9                                                                                               |
| 4.8                         | Source only: the generated `deserialize` prologue and `beginReadBlobs`; no test raises and then deserializes again                                                                                                                                      |
| 4.9                         | `checks.spec.ts`: `rejectsAnEnumIndexPastItsItems`, `rejectsAPackedRotationCodeThatNamesNoRotation`                                                                                                                                                     |
| 4.10                        | Source only: `enumFromIndexExpr` in `emit/read.ts`; `readPackedCFrame` in `src/cframe.ts`                                                                                                                                                               |
| 5.1                         | Source only: the calls the emitter makes under `emit/`, and the exports of `src/index.ts`                                                                                                                                                               |
| 5.2                         | `test/golden.test.mjs`: consecutive fixed-size fields share one reservation, inline                                                                                                                                                                     |
| 5.3                         | `test/golden.test.mjs`: packed booleans never call a per-bit `packBit` helper                                                                                                                                                                           |
| 5.4                         | Source only: `finishWriteExpression` and `writeStateDecls` in `emit/context.ts`                                                                                                                                                                         |
| 5.5                         | Source only: the module state in `src/blobs.ts`                                                                                                                                                                                                         |
| 6.1–6.2                     | Source only: no version field is read or written by either package                                                                                                                                                                                      |

## Changes

- `f0b68ef` / `b954fd2`: the two gaps in `checks` closed. 4.2 (a
  packed `CFrame` is bounded) and 4.9 (checks reject an `enum` index past its
  items and a rotation code that names no rotation) now state guarantees;
  4.7 and 4.10 follow them.
- `38b634f` / `6967359`: 4.9 and 4.10 name the future-work document that tracks them.
- `8c4d5f5` / `87813e5`: corrected against the code: 4.2 (a packed `CFrame`
  read is not bounded), 4.3 (which counts are bounded, and how), 4.7 (unchecked
  indexes), 4.8 (a `T` that reads bytes), 5.1 (`finishWrite` for a `T` that
  reserves no bytes), 5.2 (the blob channel is the exception); adds 4.9, 4.10,
  5.4 and 5.5; Conformance rows corrected.
- `16dddf8` / `05b267b`: 5.3 states that `packBit` is a public primitive and
  that the bit region is written one whole byte at a time; the Scope and 3.9
  point at the new specifications.
- `02dbdd8` / `05b267b`: first version, from `docs/serde.md`. Corrects that
  document's statement that the factories have no runtime body (3.4).
