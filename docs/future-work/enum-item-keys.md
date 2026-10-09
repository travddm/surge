# Future work: an enum's write keyed by the item itself

Part of the [surge](../architecture.md) design.

## What

An `enum`'s write that finds an item's index in a table keyed by the
`EnumItem` itself, with no property read, next to the write keyed by the
item's `Name` (`ensureEnumTable` in
`rbxts-transformer-surge/src/emit/context.ts`). One of the two is the
default, and an option chooses the other. The bytes are the same under both
(Wire format 4.12 in [specs/wire-format.md](../specs/wire-format.md)).

## Why deferred

- The form keyed by the item cannot run under Lune, which runs the round
  trip suite. In Roblox, an `EnumItem` is the same object on each access, so
  a table keyed by it finds the item. Under Lune, `Enum.X.Y` is a new object
  on each access, so the lookup always misses.
- The speed tier, which runs in Roblox, does not check what a codec decodes,
  so nothing would catch a write keyed by the item that wrote the wrong
  index.
- Its speed is unmeasured. A write keyed by `Value` measured slower than the
  write keyed by `Name` ([research/enum-and-cframe-rows.md](../research/enum-and-cframe-rows.md)),
  so a gain from dropping the property read is a hypothesis.

## How, briefly

- An option of `CodecOptions`, a literal at the call site, as `readChecks`
  and `writeChecks` are (Runtime API 3.8 in
  [specs/runtime-api.md](../specs/runtime-api.md)). Which form is the default
  is decided from the measurement.
- A round trip check that runs in Roblox: the speed tier's process could
  compare each row's decoded value with its input once, before the timed
  trials, as the size tier does under Lune
  ([specs/benchmark-harness.md](../specs/benchmark-harness.md)).
- The speed tier measures the enum row's encode under both forms, as a paper
  under [research/](../research/README.md). Part of Flamework 2's lead on
  the row is its format, which writes the `Value` with no lookup
  ([research/enum-and-cframe-rows.md](../research/enum-and-cframe-rows.md)).
