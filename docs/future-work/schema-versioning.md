# Future work: schema evolution / versioning

Part of the [surge](../architecture.md) design.

## What

A way for a `createSerializer<T>()`/`createBinarySerializer<T>()` shape to
change over time (fields added, removed, retyped) without silently
producing incompatible bytes between an old and new build.

## Why deferred

Unaddressed by both fbs and this design so far. fbs has no versioning
story at all, and this design hasn't needed one yet — every shape
considered so far is compiled and consumed from the same build. Out of
scope unless a concrete need for it shows up (e.g. rolling deploys where
client and server briefly run different builds against the same shape).

## How, briefly

Not designed — two directions worth considering when this is picked up,
neither committed to:

- A leading version tag byte per top-level shape, with the transformer
  emitting one generated codec per known version and dispatching on the
  tag at `deserialize()` time.
- An additive-only field discipline (new fields must be `optional`,
  existing fields never change type or get removed) enforced as a
  transformer diagnostic against a checked-in previous-shape snapshot,
  avoiding a runtime tag entirely at the cost of a stricter authoring
  rule.

Both trade off differently against the flat, no-runtime-dispatch codegen
this design is built around (see [transformer.md](../transformer.md)) —
an actual design pass should weigh that before picking one.
