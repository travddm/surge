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
designed so a networking layer can sit underneath it later (the same way
fbs's own use inside Flamework networking works today) without needing
the serializer redesigned when this is picked up.

## How, briefly

- Its own repository and package, `surge-net`: `@rbxts/surge` is the
  serializer's runtime package (Two packages, two repositories in
  [architecture.md](../architecture.md)).
- Builds on `@rbxts/surge`'s `Serializer<T>` (Runtime API 3.1 in
  [specs/runtime-api.md](../specs/runtime-api.md)) rather than re-deriving its own wire format.
- Not designed further than this until picked up — gets its own design
  pass (detection/dispatch model, batching strategy, channel semantics,
  and its own repository, following the same two-repo distribution
  reasoning as `@rbxts/surge`/`rbxts-transformer-surge` if it also needs a
  transformer) at that point.
- Until then, nothing for it exists yet — it isn't part of the "full
  stack" the current tooling/tests exercise (see
  [testing.md](../testing.md)).
