# Future work: writing into and reading from a caller's buffer

Part of the [surge](../architecture.md) design.

## What

`serialize` returns a new buffer that holds one value, and `deserialize`
reads one value from the start of a buffer and returns nothing else (Runtime
API 3.1, 3.5 and 4.8 in [specs/runtime-api.md](../specs/runtime-api.md)). A
caller that puts several values in one buffer pays for both:

- **On write**, each value costs a result table, a buffer from `finishWrite`
  and a copy into the caller's buffer, where one write into the caller's
  buffer would do.
- **On read**, `deserialize` cannot start at an offset and does not say where
  the value ended. The caller must frame each value with its own length, and
  copy it into a buffer of its own before reading it.

A networking layer that batches a frame's events into one buffer, as
[networking.md](networking.md) plans, is that caller. Zap batches with one
growing buffer that every event writes into, copied out once per frame for
each player
([`base.luau`](https://github.com/red-blox/zap/blob/0.6.x/zap/src/output/luau/base.luau),
[`server.rs`](https://github.com/red-blox/zap/blob/0.6.x/zap/src/output/luau/server.rs)).
Sera exposes the same thing as API: `Sera.Push(schema, t, b, offset)` writes
into the caller's buffer and returns the offset after the value, and
`Sera.Deserialize(schema, b, offset)` returns the value and the offset after
it ([`Sera.luau`](https://github.com/MadStudioRoblox/Sera/blob/main/Sera.luau)).

The work is three additions:

- a write entry point that takes a buffer and an offset, and returns the
  buffer and the offset after the value;
- a read entry point that takes an offset, and returns the value and the
  offset after it;
- for a type whose size is a constant, that constant, so a caller can size a
  buffer before writing.

## Why deferred

No caller needs it yet. Its driver is `surge-net`, which is deferred
indefinitely. It also adds to the consumer API, which is
`Codec<T>` today (Runtime API 3.1), and the shape of the addition is
undecided.

## How, briefly

- **The body does not change.** A generated `serialize` writes through closure
  state: the scratch buffer, its capacity and the write cursor (Transformer
  5.3 in [specs/transformer.md](../specs/transformer.md)). The write entry
  point sets them from the caller's buffer and offset instead of the
  serializer's own buffer and `0`, runs the same body, and returns the buffer
  and the cursor instead of calling `finishWrite`. The read entry point sets
  the read cursor to the offset, and returns it after the value. The `readChecks`
  bounds need no new form: each read is bounded against `buffer.len` of the
  input, and a count against the bytes left after the cursor (Runtime API 4.2
  and 4.3). In a buffer that holds several values, though, the bytes left
  include the values after this one. The bounds then stop a read at the end of
  the buffer, not at the end of the value, and admit a count that a buffer of
  this value alone would reject.
- **The caller's buffer cannot grow in place.** A Luau `buffer` has a fixed
  length. A write past its end must either raise, as `Sera.Push` does, or call
  `grow` and return the new buffer for the caller to keep, as Zap's `alloc`
  does with its own buffer. Only the second lets a caller write without
  sizing the buffer first.
- **Restore the serializer's own scratch buffer** after the call. Otherwise
  the closure keeps the caller's buffer, and the next `serialize` writes into
  it.
- **Code size.** Emitting the body once per entry point doubles each
  serializer. Emitting it once, as a local function that both entry points
  call, adds a call to every `serialize`. Emitting the new entry points only
  from a new factory leaves existing call sites as they are. Measure the call
  before choosing.
- **Blobs.** Values batched into one buffer need one `blobs` array, in order,
  for the whole batch. The write side appends to an array the caller passes.
  The read side starts at a blob index the caller passes, and returns the
  index after the value. This needs the blob channel's state out of the
  package first, which [blob-channel-state.md](blob-channel-state.md)
  describes.
- **A constant size.** `fixedBytes` in the transformer's `emit/layout.ts`
  gives the size of each kind that has a constant one, but not of an `object`,
  which is the usual root. A type's constant size therefore needs `fixedBytes`
  to cover an object whose fields all have one. That is also the first item
  under fewer reservations in
  [generated-code-performance.md](generated-code-performance.md). Sizing a
  type without a constant size is the exact-size question in the same
  document, not part of this one.
- Update Runtime API 3 and 5.1, [getting-started.md](../getting-started.md)
  and [errors-and-guarantees.md](../errors-and-guarantees.md). A new factory
  also updates Transformer 3.1.
