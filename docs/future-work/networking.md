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

- Its own repository and package, `surge-net` — not `@rbxts/surge`, which
  is now the serializer runtime itself (see Repository layout in
  [architecture.md](../architecture.md)). An earlier draft of this design
  reserved the bare `@rbxts/surge` name for this networking layer instead;
  that reservation was dropped once the serializer runtime needed the
  `@rbxts` scope for its own real distribution (see
  [serde.md](../serde.md)) and "surge-net" turned out to name this layer
  just as well.
- Builds on `@rbxts/surge`'s `Serializer<T>` (see
  [serde.md](../serde.md)) rather than re-deriving its own wire format.
- Not designed further than this until picked up — gets its own design
  pass (detection/dispatch model, batching strategy, channel semantics,
  and its own repository, following the same two-repo distribution
  reasoning as `@rbxts/surge`/`rbxts-transformer-surge` if it also needs a
  transformer) at that point.
- Until then, nothing for it exists yet — it isn't part of the "full
  stack" the current tooling/tests exercise (see
  [testing.md](../testing.md)).
