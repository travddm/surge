# Future work: opaque values as union members

Part of the [surge](../architecture.md) design.

## What

One union shape is a diagnostic (Transformer 4.4 and 7.2 in
[specs/transformer.md](../specs/transformer.md)) that the write side could
support: **an opaque value next to another type.** `Instance | string` and
`Vector2int16 | string` report the "opaque variant" diagnostic, and the user
must type the whole field as `unknown`, which also moves the `string` to the
blob channel. `unknown | string` is not affected: TypeScript reduces it to
`unknown`.

An enum next to another type, and the items of two enums in one union, work.

## Why deferred

The shape is a diagnostic, not a wrong encoding, so the work is support
rather than a fix. Support changes the `guardedUnion` variant order, which is
part of the wire format (Wire format 5.7 in
[specs/wire-format.md](../specs/wire-format.md)). `bytes.spec.ts` pins no
union with an opaque member, so it moves no pinned buffer; pin the new shape
when it lands.

## How, briefly

- **Opaque variant as the fallthrough.** A union's write never guards the
  last variant, and every other variant has a positive check, so one `blob`
  variant is sound if it is always last. Sort `blob` after every other kind
  in `classifyUnion`, merge every opaque constituent into that one variant
  (they all write and read through `pushBlob`/`nextBlob`), and drop the
  "opaque variant" rejection. `Instance | string` then costs one index byte,
  with the string in the buffer and the `Instance` in the blob channel.
  `guardFor` in `emit/write.ts` has no guard for a `blob`, and both the write
  and the size build every variant's test, the last included, so the last
  variant's test has to be skipped. The declared `Serialized<T>` of
  `@rbxts/surge` has to give such a union a `blobs` array (Runtime API 3.6).
  Round-trip fixtures: `Vector2int16 | string`, and `Instance | string` with
  a Lune data-model `Part` (as `roblox.spec.ts` builds one).
- Update Transformer 4.4 and 7.2, and Wire format 5.7, when it lands.
