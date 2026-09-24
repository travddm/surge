# Future work: the blob channel's state in the serializer's closure

Part of the [surge](../architecture.md) design.

## What

The blob channel's write list, read list and read index are module state in
`src/blobs.ts`, shared by every serializer (Runtime API 5.5 in
[specs/runtime-api.md](../specs/runtime-api.md)). They are the only state the
package still owns: the scratch buffer and the cursors are declared in each
serializer's closure (Runtime API 5.2, Transformer 5.3 in
[specs/transformer.md](../specs/transformer.md)). The shared state has two
costs:

- **A rule between serializers.** A `serialize` of a type with a blob field
  must not start while another one is running, and the same holds for
  `deserialize` ([errors-and-guarantees.md](../errors-and-guarantees.md)).
- **A call into the package per blob.** Each blob written is a `pushBlob` call
  and each blob read is a `nextBlob` call, in addition to the calls that open
  and close the channel once per call.
  [per-call-overhead.md](../research/per-call-overhead.md) measured the
  opening and closing calls and their table allocation. The per-blob calls
  are not measured.

The work is to declare the lists and the index in the closure that the
serializer is generated into, as the scratch buffer is, and to append and
read blobs inline.

## Why deferred

Only the value being serialized can break the rule, because a serializer runs
code it did not generate only through a value's metamethods (Runtime API 5.7).
In Luau:

- `__index` and `__len` cannot yield. The VM calls them through `luaD_call`,
  and `lua_yield` raises "attempt to yield across metamethod/C-call boundary"
  inside them.
- The iterator function that an `__iter` metamethod returns can yield. The
  `FORGLOOP` instruction calls it through `luaD_performcally`, which permits
  it ([`VM/src/ldo.cpp`](https://github.com/luau-lang/luau/blob/master/VM/src/ldo.cpp),
  [`VM/src/lvmexecute.cpp`](https://github.com/luau-lang/luau/blob/master/VM/src/lvmexecute.cpp)).

So a second serializer starts inside a first one only when a metamethod
calls it, or when an `__iter` iterator yields and another thread serializes.
No report has hit either. Nothing measures the per-blob cost, because the
benchmark catalog has no type with a blob field.

## How, briefly

- Declare the write list, the read list and the read index in the closure,
  under the condition that Transformer 5.9 already uses for the entry points:
  only where the body reaches a blob.
- On write, create a new list in each `serialize`, because the caller keeps
  the list it is given. On read, take `inputBlobs` and reset the index in each
  `deserialize`.
- Keep the errors of Runtime API 4.5 and 4.6 with the same message strings,
  inline or in a function local to the closure.
- Remove `beginWriteBlobs`, `pushBlob`, `finishWriteBlobs`, `beginReadBlobs`
  and `nextBlob` from the helper ABI (Runtime API 5.1). The helper ABI is what
  both packages must agree on (Runtime API 6.1), so the change ships in a
  release of both.
- Update Runtime API 5.2, 5.5 and 5.7, Transformer 5.9 and 6.4, and the
  blob paragraph of [errors-and-guarantees.md](../errors-and-guarantees.md).
- Measure it with a benchmark catalog row that has blob fields.

This does not make a serializer re-entrant. The scratch buffer and the
cursors are closure state too. A `serialize` that starts while the same
serializer is running resets the write cursor and overwrites the bytes of the
call it interrupted, for every type, with or without a blob field (Runtime
API 5.6). Moving the blob state removes only the rule between different
serializers.
[caller-buffers.md](caller-buffers.md) goes further for blobs, because a
caller that passes its own blob list makes the list state per call.
