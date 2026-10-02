# Future work: benchmark tooling

Part of the [surge](../architecture.md) design. The benchmark harness is built
and specified in [specs/benchmark-harness.md](../specs/benchmark-harness.md):
its catalog, the columns it compares and how each is driven, and each tier's
protocol. What it has measured is under [docs/research/](../research/README.md).
This document holds what is still open.

## What

**A stable fbs and serio column.** Two builds of unchanged source can compile
an fbs or serio fixture differently. On 2026-09-26, two builds of
`small-flat-struct.ts` listed the fields of `createFbsSerializer`'s and
`createSerioSerializer`'s generated schema in the order `x, y, id, z, active`
in one and `id, x, y, z, active`, the declaration order, in the other. Both
libraries take the schema from `rbxts-transformer-flamework`, which chose the
order. surge's own code was the same text in both builds. The cause is not
known: `tests/flamework.build`, Flamework's cache, holds identifiers and no
field order. A column whose code can change between two runs is a weaker
control than one whose code cannot, and a measurement that reads fbs or
serio as a control on a single row can read a change of field order as
drift.

**A readable `Blink: Booleans` encode cell.** surge's encode of that row lands
in one of two modes per Studio run, about 157k to 177k values a second or
about 215k, with nothing changed between the runs. Four invocations on
2026-09-27 ran one of each mode three times and the lower one twice
([per-element-encode.md](../research/per-element-encode.md)). fbs's and serio's
cells on the row agree across the runs of each invocation. A cell that pools
a run of each mode is past the recorder's 10% spread rule, so the row's
encode has not been readable in the last two measurements. The cause is not
known. The row is a thousand booleans, each a one-byte write, so a cost per
element that differs between Studio processes, such as where native code or
the buffer lands, would show here first.

**A third tier, for wire cost.** `Stats.DataSendKbps` in a real Roblox
client and server is Blink's own benchmark method, and the only measure that
includes remote overhead and batching, so a networking library and a bare
serializer would meet on one axis.

**A Zap-shaped timing.** Zap has no callable encoder, so it is a size column
only (Benchmark harness 4.3 in
[specs/benchmark-harness.md](../specs/benchmark-harness.md)). A hand-written
Luau column that transcribes the statement sequence Zap's `irgen` emits for
each row, the way the baseline transcribes surge's bytes, is the only route
to one.

## Why deferred

Tier 3 has no driver:
nothing yet asks what a serializer costs on the wire once a networking layer
batches it, and [networking.md](networking.md) is where that would come from.
A Zap-shaped timing has no driver either, and a transcription would measure
the transcription as much as Zap.

A readable `Blink: Booleans` encode cell waits on nothing either. It costs
one row per measurement, and the rest of the catalog is read without it.

A stable fbs and serio column waits on nothing. It is not in the way today:
a measurement reads its controls as a median over many cells, and one that
changed its code on one row moves that median little.
[one-reservation-per-array.md](../research/one-reservation-per-array.md) left
the two cells out.

## How, briefly

1. Find what sets the field order `rbxts-transformer-flamework` emits, by
   building `tests/` several times from a clean tree and comparing the fbs
   and serio schemas. Then either make the build choose one order, or have a
   golden check or the speed recorder say when a fixture's fbs or serio code
   differs from the last run's.
2. Run the `Blink: Booleans` row alone (`mise run bench:speed:only
booleans`) across several Studio processes, and look for what differs
   between a fast process and a slow one before changing the row or the
   recorder.
3. Tier 3 only if wire cost with batching becomes a question the serializer
   comparison cannot answer.
4. A Zap-shaped timing only if Zap's speed becomes a question Blink's column,
   the other IDL compiler, cannot answer.
