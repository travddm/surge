# Future work: writing into and reading from a caller's buffer

Part of the [surge](../architecture.md) design.

## What

`serialize` returns a new buffer that holds one value, and `deserialize`
reads one value from the start of a buffer and returns nothing else (Runtime
API 3.1, 3.5 and 4.8 in [specs/runtime-api.md](../specs/runtime-api.md)). A
caller that puts several values in one buffer pays for both:

- **On write**, each value costs a buffer from `finishWrite`, a
  `{ buffer, blobs }` table for a type that can hold a blob, and a copy into
  the caller's buffer, where one write into the caller's buffer would do.
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

## The decided shape

A new factory, so that `createCodec`'s call sites and their `serialize` and
`deserialize` do not change, whose functions take one mutable cursor that the
caller owns and that several codecs can share in a batch:

```ts
interface Cursor {
	buffer: buffer;
	offset: number;
	blobs: Array<defined>;
	blobIndex: number;
}

interface CursorCodec<in out T> {
	write: (cursor: Cursor, value: T) => void;
	read: (cursor: Cursor) => T;
	size: number | undefined;
}

function createCursorCodec<T>(options?: CodecOptions): CursorCodec<T>;
```

`write`, `read` and `size` are properties, as `Codec`'s are, and not methods:
roblox-ts calls a method with `:`, which passes the object as `self`, and the
generated functions take no `self`.

- **`write(cursor, value)`** writes `value` at `cursor.offset` of
  `cursor.buffer` and moves `cursor.offset` past it. When the value does not
  fit, it grows the buffer: a new one that holds every byte before the value,
  which replaces `cursor.buffer`. The caller reads `cursor.buffer` back after
  each write, since a buffer it held before may be the old one. A blob is
  appended to `cursor.blobs` after the blobs already in it, so one batch has
  one list, in order, across every codec that wrote into it.
- **`read(cursor)`** reads a value at `cursor.offset` of `cursor.buffer`,
  takes its blobs from `cursor.blobs` starting at `cursor.blobIndex`, and moves
  both past the value.
- **`size`** is the number of bytes every value of `T` writes, where that does
  not depend on the value, and `undefined` otherwise: the exact size of
  Transformer 5.20 when it reads nothing of the value. It counts a packed
  region of `boolean`s, which `fixedBytes` leaves out.
- **`writeChecks` and `readChecks`** govern `write` and `read` as they govern
  `serialize` and `deserialize`. A read is bounded against the length of
  `cursor.buffer`, not against the end of the value: in a buffer that holds
  several values, the bytes left include the values after this one, so a
  count that fits the buffer but not this value is admitted, as it is for a
  value read from a buffer with bytes after it.

## Why deferred

It adds to the consumer API, which is `Codec<T>` today (Runtime API 3.1), so
it lands before the first release in [ci-and-release.md](ci-and-release.md).
It does not wait for `surge-net`, its first caller, which stays deferred
([networking.md](networking.md)).

## How, briefly

- **The body does not change.** `write` declares the scratch path's state, the
  buffer, its capacity and the write cursor (Transformer 5.3 in
  [specs/transformer.md](../specs/transformer.md)), from the cursor, runs the
  body the scratch path runs, and stores the buffer and the write cursor back.
  `read` declares the read state from the cursor in the same way. Where the
  shape reaches no recursion helper, the state is locals of `write` and
  `read`. Where it reaches one, it is the closure's, which the helper reads,
  and Runtime API 5.6 applies to the cursor codec as it does to `serialize`.
- **The blob list is the caller's.** `write`'s count of stored blobs starts at
  the length of `cursor.blobs`, and the list is not created at a length.
- **`grow` must start from an empty buffer.** It doubles the buffer's length
  until the value fits, and a caller's buffer may be `buffer.create(0)`, whose
  length doubles to nothing. A buffer of length 0 grows to the length needed
  (a change to the helper ABI, Runtime API 5.1).
- **One check ahead of an exactly sized body, later.** A shape sized exactly
  could check the room for its size once and write with no check per
  reservation. That is a second form of the body, and it is measured before it
  is built, on a catalog row that writes into a cursor.
- **Code size.** The cursor codec has a body of its own, and no `createCodec`
  call site changes. A shape that needs both one value at a time and batches
  declares both.
- Update Runtime API 3, 5.1, 5.2 and 5.6, Transformer 3.1,
  [getting-started.md](../getting-started.md) and
  [errors-and-guarantees.md](../errors-and-guarantees.md).
