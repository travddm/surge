# Future work: an enum's write keyed by the item's `Name`, as an option

Part of the [surge](../architecture.md) design.

## What

An option of `CodecOptions` that makes an `enum`'s write find the item's
index in a table keyed by the item's `Name`, next to the default write keyed
by the `EnumItem` itself (Transformer 5.29 in
[specs/transformer.md](../specs/transformer.md)). The bytes are the same
under both (Wire format 4.12 in [specs/wire-format.md](../specs/wire-format.md)).

## Why

The default write finds an item only where the runtime gives each item one
object. Roblox does. Lune does not: there `Enum.X.Y` is a new object on each
access, so generated code run under Lune, such as in a game's own unit
tests, finds no index for an enum item: the write raises, or, in a union of
more than one enum, takes the union's last variant. surge's own round-trip
suite runs under a
stand-in `Enum` that gives each item one object (Test harness 4.3 in
[specs/test-harness.md](../specs/test-harness.md)), which a game's tests do
not have.

## Why deferred

The default was measured first: on the enum row, the write keyed by the
`Name` encodes at 0.27× the throughput of the write keyed by the item
([research/enum-index-by-item.md](../research/enum-index-by-item.md)). The
option adds a second form of the write and of the guard to maintain and test,
which only code run outside Roblox needs.

## How, briefly

- A literal option at the call site, as `readChecks` and `writeChecks` are
  (Runtime API 3.8 in [specs/runtime-api.md](../specs/runtime-api.md)).
- `ensureEnumTable` in `rbxts-transformer-surge/src/emit/context.ts` builds
  the table keyed by the `Name` as it did before `359c8e1`, and the guard of
  a union of several enums compares the item's `EnumType` again, since a
  table keyed by the `Name` cannot tell two enums' items of one name apart.
