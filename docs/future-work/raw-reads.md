# Future work: an option to read values raw

Part of the [surge](../architecture.md) design.

## What

An option of `CodecOptions`, off by default, under which `serialize` and a
cursor codec's `write` read the value they are given raw: `rawget` for a
property, `rawlen` for a length, and `next` for a loop. No `__index`, `__len`
or `__iter` metamethod of the value then runs.

## Why deferred

- No consumer needs it yet. A plain table, a roblox-ts array, `Map` or `Set`,
  and a roblox-ts class instance hold every property their type declares on
  themselves, so a raw read returns what a plain read returns.
- Where the two differ, the raw read is the wrong one for most values: a proxy
  or a read-only wrapper keeps its data behind `__index`, and would serialize
  as if its properties were absent, without raising.
- What it would remove are the hazards that Runtime API 5.6 to 5.9
  ([specs/runtime-api.md](../specs/runtime-api.md)) leave to the caller: a
  metamethod that calls a serializer or yields, and one that answers a second
  read differently. Each needs a metamethod written to do it.
- `deserialize` and a cursor codec's `read` are not affected either way: they
  read a buffer and a `blobs` list, and build new tables.

## How, briefly

- A literal at the call site, as `readChecks` and `writeChecks` are (Runtime
  API 3.8), so the transformer emits one form per call site and a call site
  without the option is unchanged.
- The reads to change are the ones the 5.7 row of the runtime API's
  conformance table names: the value's properties, lengths and `for … in`
  loops under `emit/` in `rbxts-transformer-surge`. Each needs its raw form,
  and the facts that pin the round trip need to run under both.
- With the option, 5.7 changes from "only through metamethods" to "never",
  and 5.6 and 5.9 no longer apply to a value read raw.
- Its speed against plain reads is unmeasured. The speed tier would measure
  it on the catalog before it lands, as a paper under
  [research/](../research/README.md).
- A driver would be a consumer whose values carry metatables that answer
  reads, and who wants their raw contents serialized.
