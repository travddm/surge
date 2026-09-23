# Runtime API specification

Status: current
Applies to: `@rbxts/surge` at commit `02dbdd8`, `rbxts-transformer-surge` at
commit `05b267b` (no tagged release yet)

## 1. Scope

This specifies `@rbxts/surge`, the runtime package: the API a consumer calls,
what `deserialize` does with input it did not write, the helpers generated
code calls into, and how the package's version is coupled to the
transformer's. The bytes an encoding writes, and what the transformer emits
for a call, are specified in Type coverage and Transformer design in
[../transformer.md](../transformer.md) until `wire-format.md` and
`transformer.md` are written in this directory. How to install the two
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
packing brands. What each brand does to the bytes is in Type coverage in
[../transformer.md](../transformer.md).

## 4. What `deserialize` does with input it did not write

**4.1** Without checks, `deserialize` does not examine its input. On bytes
that no `serialize` of the same `T` produced, its behavior is unspecified: it
may raise a Luau `buffer` error, return a wrong value, or run a loop for as
long as a count in the input says.

**4.2** With checks, every read is bounded against the length of `input`.

**4.3** With checks, every count read from `input` is bounded against the
number of elements the remaining bytes could hold. For an element that reads
no bytes, the count is bounded by 2^24 instead.

**4.4** With checks, an input that fails a bound in 4.2 or 4.3 raises a string
beginning `@rbxts/surge:`.

**4.5** Reading past the end of `inputBlobs` raises a string beginning
`@rbxts/surge:`, with or without checks.

**4.6** Reading a blob field when `inputBlobs` was omitted raises a string
beginning `@rbxts/surge:`, with or without checks.

**4.7** Checks examine lengths and counts only, never values. An input whose
lengths are consistent deserializes into a value of the right shape whatever
its contents, and a value outside the range a caller expects is the caller's
to reject.

**4.8** The input buffer and the read cursor are reset at the start of every
`deserialize`, and the blob index at the start of every `deserialize` of a `T`
that has a blob field — which is every call that can read one. A call that
raised leaves no state that a later call reads, so a `pcall` around
`deserialize` is sufficient to reject an input.

## 5. The helper ABI

**5.1** Generated code calls only the following exports. Their signatures are
part of the coupling in section 6.

| Export              | Called                                    | Contract                                                                                                                                                  |
| ------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grow`              | when a reservation passes the capacity    | `grow(current, live, needed)` returns a buffer of at least `needed` bytes whose first `live` bytes are `current`'s. `current` must have a nonzero length. |
| `finishWrite`       | once per `serialize`                      | `finishWrite(written, size)` returns a new buffer of exactly `size` bytes holding `written`'s first `size`.                                               |
| `writePackedCFrame` | per `CFrame` inside `Packed<T>`           | writes the packed form at the given offset and returns the bytes it used.                                                                                 |
| `readPackedCFrame`  | per `CFrame` inside `Packed<T>`           | reads the packed form at the given offset and returns the value and the bytes it used.                                                                    |
| `unpackBit`         | per bit read inside `Packed<T>`           | `unpackBit(buf, byteOffset, bitIndex)` returns that bit.                                                                                                  |
| `beginWriteBlobs`   | once per `serialize`, if `T` has a blob   | starts an empty write-side blob list.                                                                                                                     |
| `pushBlob`          | per blob field written                    | appends a value to the write-side blob list.                                                                                                              |
| `finishWriteBlobs`  | once per `serialize`, if `T` has a blob   | returns the write-side blob list.                                                                                                                         |
| `beginReadBlobs`    | once per `deserialize`, if `T` has a blob | sets the read-side blob list to `inputBlobs` and its index to the first element.                                                                          |
| `nextBlob`          | per blob field read                       | returns the next read-side blob, or raises per 4.5 and 4.6.                                                                                               |

**5.2** The package owns no scratch buffer and no cursor. Each generated
serializer declares its own scratch buffer, capacity, write cursor and read
cursor in the closure it is emitted into, and reserves bytes inline.

**5.3** `packBit` is exported and is not called by generated code: the write
side of a `Packed<T>` bit region is emitted inline.

## 6. Version coupling

**6.1** Generated code calls the helper ABI of section 5 with no version
negotiation. A consumer must pin `@rbxts/surge` and `rbxts-transformer-surge`
to the same release and must update them together.

**6.2** Nothing checks, at compile time or at run time, that the two pinned
versions match. A mismatch surfaces as a call to a helper that does not exist
or whose contract has changed.

## 7. Conformance

| Statement               | Pinned by                                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1–3.3                 | `tests/src/tests/factories.spec.ts`: round trip through the bundled serializer and through separate ones                                                                         |
| 3.4                     | Source only: `notConfigured` in `src/serializer.ts`. No test runs a factory untransformed.                                                                                       |
| 3.5                     | `tests/src/tests/bytes.spec.ts`, which compares every pinned encoding's whole buffer                                                                                             |
| 3.6                     | `tests/src/tests/roblox.spec.ts`: `passesUnknownAndInstanceValuesThroughTheBlobChannel`, `keepsLaterBlobsInPlaceWhenAnUnknownIsUndefined`, `writesNoBlobForAnAbsentOptionalBlob` |
| 3.7                     | `deserializesAShapeWithNoBlobWithoutInputBlobs` in `tests/src/tests/factories.spec.ts`                                                                                           |
| 3.8                     | `test/golden.test.mjs`: a serializer without `checks` carries no read-side check, and one with it carries them                                                                   |
| 3.9                     | Source: `src/data-type.ts`; each brand's bytes are pinned in `tests/src/tests/bytes.spec.ts`                                                                                     |
| 4.1                     | Source only: the unchecked read path in the emitter. A statement of what is not guaranteed has nothing to pin.                                                                   |
| 4.2–4.4                 | `tests/src/tests/checks.spec.ts`: `rejectsATruncatedPayload`, `rejectsACountTheInputCannotHold`, `rejectsACountOfElementsThatReadNoBytes`                                        |
| 4.3 (no over-rejection) | `acceptsWhatSerializeWrote`, `acceptsEveryKindThatReadsACount`, `acceptsEmptyContainers` in the same file                                                                        |
| 4.5                     | `rejectsAReadPastTheEndOfTheBlobs` in `tests/src/tests/checks.spec.ts`                                                                                                           |
| 4.6                     | Source only: `nextBlob` in `src/blobs.ts`                                                                                                                                        |
| 4.7                     | Source only: checks bound reads and counts and emit no comparison against a value                                                                                                |
| 4.8                     | Source only: the generated `deserialize` prologue and `beginReadBlobs`. No test raises and then deserializes again.                                                              |
| 5.1                     | Source: the calls the emitter makes in `rbxts-transformer-surge` `src/emit/`, and the exports of `src/index.ts`                                                                  |
| 5.2                     | `test/golden.test.mjs`: consecutive fixed-size fields share one reservation, inline                                                                                              |
| 5.3                     | `test/golden.test.mjs`: packed booleans never call a per-bit `packBit` helper                                                                                                    |
| 6.1–6.2                 | Source only: no version field is read or written by either package                                                                                                               |

## Changes

- `02dbdd8` / `05b267b`: first version, from `docs/serde.md`. Corrects that
  document's statement that the factories have no runtime body (3.4).
