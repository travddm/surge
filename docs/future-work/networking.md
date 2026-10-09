# Future work: `surge-net` networking layer

Part of the [surge](../architecture.md) design.

## What

A Zap-style transport layer built on top of `@rbxts/surge`: the Fire/On
dispatch API, per-`Heartbeat` event batching, and reliable/unreliable
channel semantics.

## Why deferred

These are Zap's other headline speed contributors beyond serialization,
but they're networking-layer, not serializer-layer — explicitly out of
scope for the current `rbxts-transformer-surge`/`@rbxts/surge` work (see
Non-goals in [architecture.md](../architecture.md)). The serializer is
designed to sit under a networking layer later, as fbs sits under
Flamework's networking today, without being redesigned when this is picked
up.

## How, briefly

- A package of its own, `surge-net`, in a directory of its own in this
  repository: `@rbxts/surge` is the serializer's runtime package (Two
  packages, one repository in [architecture.md](../architecture.md)).
- Builds on `@rbxts/surge`'s `Codec<T>` (Runtime API 3.1 in
  [specs/runtime-api.md](../specs/runtime-api.md)) rather than re-deriving its own wire format.
- Batching a frame's events into one buffer can use the cursor codec
  (Runtime API 3.15 in [specs/runtime-api.md](../specs/runtime-api.md)),
  which writes each event into one buffer the batch owns, where each
  `serialize` would cost a buffer of its own and a copy into the batch.
- Its benchmark compares it with the networking layers a consumer would
  weigh against it: Blink's, Zap's, and that of the experimental Flamework v2
  (`@flamework-experimental/networking`), which packs payloads with the code
  its `Flamework.createSerializer` generates. The wire-cost tier in
  [benchmark-tooling.md](benchmark-tooling.md) is the measure that includes
  batching.
- Not designed further than this until picked up — gets its own design
  pass (detection/dispatch model, batching strategy, channel semantics,
  and whether it needs a transformer of its own, as `@rbxts/surge` does) at
  that point.
- Until then, nothing for it exists yet — it isn't part of the "full
  stack" the current tooling/tests exercise (see
  [testing.md](../testing.md)).
