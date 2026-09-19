# Future work: hardening `deserialize` against malformed input

Part of the [surge](../architecture.md) design.

## What

Transformer Design §7 in [transformer.md](../transformer.md) deliberately
omits bounds checks, matching fbs, and testing.md scopes tests to
`deserialize(serialize(x))`. That is fine for trusted bytes. The deferred
networking layer ([networking.md](networking.md)) will hand a server
client-controlled bytes, and the current read path has consequences worth
naming now (all from code reading, none executed):

- **Unbounded loops on zero-byte elements.** An array or dict count is a
  `u32` read straight from the buffer. For fixed-size elements a hostile
  count ends in a Luau `buffer` out-of-bounds error after a few
  iterations. For elements that consume no bytes, the loop runs the full
  count: `Array<"x">` (a `literalConst`), an array of objects made only of
  literal constants, or `Array<Instance>`/`Array<unknown>` (blobs; live since
  [blob-classification.md](blob-classification.md) landed). A 4-byte payload declaring 2^32 elements
  makes the server push billions of entries. Denial of service.
- **`nextBlob()` past the end** returns `undefined` silently; a field
  typed `Instance` then holds `nil` with no error. `nextBlob()` throws
  only when no `inputBlobs` array was passed at all (`blobs.ts`).
- **Errors are raw Luau errors.** A truncated buffer surfaces as
  `buffer access out of bounds` from inside generated code. Nothing
  documents that callers must `pcall`, and nothing distinguishes a
  malformed payload from a bug.
- **Module-scoped read state** (`input`, `readCursor`, `readBlobs`) is
  reset at the start of each call, so a failed call does not poison the
  next one. Worth stating in the docs, since it is the reason the design
  is safe to `pcall`.

## Why deferred

Bounds checks cost per-field branches and contradict the flat-output goal
for the trusted case. Zap makes them opt-in (`write_checks`); this design
should do the same, and the transformer's `config` argument (currently
`_config: unknown`, unused) is the natural place for the switch.

## How, briefly

- Add a transformer option (`checks: true`) that emits, per read, a
  remaining-bytes check; per count, a check that the count times the
  element's minimum size fits the remaining bytes, plus a hard cap for
  zero-byte elements; and a blob-index bound in `nextBlob`.
- Document the error contract in [serde.md](../serde.md): Luau errors,
  `pcall` at the boundary, state is reset per call.
- Tests: truncated and count-inflated buffers under `checks: true`
  asserting a clean error; a golden check that `checks: false` emits no
  branches.
