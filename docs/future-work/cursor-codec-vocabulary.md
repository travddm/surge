# Future work: one vocabulary for the codec and the cursor codec

Part of the [surge](../architecture.md) design.

## What

A `CursorCodec<T>` names its two functions `serialize` and `deserialize`, as
a `Codec<T>` does, instead of `write` and `read` (Runtime API 3.15 in
[specs/runtime-api.md](../specs/runtime-api.md)). `serialize(cursor, value)`
writes into the cursor and `deserialize(cursor)` reads from it; `size` stays.
Nothing else changes.

## Why

The two codecs do the same work and differ only in where the bytes go, and
the options already use one vocabulary for both: `writeChecks` governs
`serialize` and a cursor codec's `write`, and `readChecks` the other two.
One pair of names makes every sentence about a codec true of a cursor codec,
and a reader who knows one knows the other.

The case for the names today is that the signatures differ: `write` returns
nothing and moves the cursor, where `serialize` returns the bytes. If that
difference is worth two vocabularies, this document is closed with a sentence
in [getting-started.md](../getting-started.md) saying so, and nothing else
changes.

## Why deferred

It is a rename across the consumer API, the specifications, the suites and
the benchmark's cursor adapter, for a gain in reading and none in code, so
it lands before the first release or not at all.

## How, briefly

- `CursorCodec` in `surge/src/serializer.ts`, and the property names
  `buildReplacement` in `rbxts-transformer-surge/src/index.ts` emits for a
  cursor codec.
- Runtime API 3.15 to 3.17, 3.19, 5.2 and 5.6, Transformer 5.3 and 5.30,
  [getting-started.md](../getting-started.md)'s Four factories table and Many
  values in one buffer section, and
  [errors-and-guarantees.md](../errors-and-guarantees.md)'s Two options table
  and its Reading what a client sent and One call at a time sections.
- `cursor.spec.ts`, the golden check of a cursor codec in
  `surge/test/golden.test.mjs`, the cursor codec's type checks in
  `transform.test.ts`, and the `surge (cursor)` adapter in
  `surge/tests/src/bench/adapters/surge-cursor.ts`.
