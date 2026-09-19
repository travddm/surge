# Future work: an `undefined` value in the blob channel

Part of the [surge](../architecture.md) design. Found while the round-trip
test coverage work landed. Both cases below were confirmed by running a
probe fixture under Lune.

## What

A `blob` field whose value is `undefined` at runtime shifts every later
blob of the same `serialize()` call into the wrong field, with no error.

- `interface P { a: unknown; b: unknown }` with `{ a: undefined, b: "second" }`
  returns one blob and reads back as `{ a: "second", b: undefined }`.
- `interface P { a?: unknown; b: unknown }` with `{ b: "second" }` does the
  same. This is the common case: TypeScript reduces `unknown | undefined`
  to `unknown`, so the walker sees no `undefined` constituent and classifies
  the optional property as a plain `blob`, not as `optional(blob)`. The
  buffer is 0 bytes long; nothing records that `a` is absent.

The cause is in the runtime, not in the generated code. `pushBlob(value)`
compiles to `table.insert(writeBlobs, value)`, and inserting `nil` appends
nothing. The read side calls `nextBlob()` once per `blob` field in the same
order, so every read after the missing entry is one position early.

`any` has the same static behavior as `unknown` (not probed). An
`Instance`-typed property is not affected when it is declared optional:
`Part | undefined` keeps its `undefined` constituent and walks as
`optional(blob)`, which `roblox.spec.ts` covers. A required `Instance`
property cannot hold `undefined` without a cast.

## Why deferred

The round-trip coverage step adds fixtures, and this fix changes the wire
format of every `unknown` field, so it is its own change. It is small, and
it is a silent wrong value for a valid type, so it should land before the
Tier A encodings.

## How, briefly

- Walk `unknown` and `any` as `optional(blob)`: a 1-byte presence flag in
  the buffer, and `pushBlob` only when the value is not `undefined`. fbs
  does the same (the "optional side" entry of the coverage matrix in
  [type-coverage-parity.md](type-coverage-parity.md)). Cost: one byte per
  `unknown` field, or one bit inside `Packed<T>` once Tier A packs
  `optional`.
- Do not fix it by writing the blob at an explicit index. That leaves a
  hole in the returned `blobs` array, `blobs.size()` is then wrong, and
  Roblox truncates an array at its first hole when it crosses a
  `RemoteEvent`.
- Fixtures: both shapes above in `roblox.spec.ts`, with the buffer length
  asserted, and `unknown[]` with no `undefined` element (an array cannot
  hold one). `passesUnknownAndInstanceValuesThroughTheBlobChannel` asserts
  a buffer length of `8 + 1`; it becomes `8 + 1 + 1`.
- Update the `blob` row of Type Coverage and "Blob / passthrough channel"
  in [transformer.md](../transformer.md).
