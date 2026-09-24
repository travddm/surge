# Future work: benchmark tooling

Part of the [surge](../architecture.md) design. The benchmark harness is built
and specified in [specs/benchmark-harness.md](../specs/benchmark-harness.md):
its catalog, the columns it compares and how each is driven, and both tiers'
protocols. What it has measured is under [docs/research/](../research/README.md).
This document holds what is still open.

## What

**Widen the hand-written baseline** to the shapes whose generated code is not
a straight run of writes: the tagged union, which branches on the tag and
builds each variant, and the packed `toggles`, whose bit region runs through a
runtime function rather than inline code. Not the large array, since the
`CFrame` array already prices a per-element loop (see the correction in
[generated-code-against-hand-written.md](../research/generated-code-against-hand-written.md)).

**Measure the generated Luau's size.** Each fixture module holds its shape,
its sample value and three factory calls, so its compiled size is not any one
library's generated code. Measuring it honestly needs each call in a module of
its own per fixture and library, and it belongs beside the speed tier, where
code size against speed is the question.

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

The first two are step 2 of the [index](README.md), after the per-call gap.
Widening the baseline measures nothing new until the gap the three existing
rows already show is understood:
surge's encode has a gap to the hand-written codec that is paid once per call
([generated-code-against-hand-written.md](../research/generated-code-against-hand-written.md)).
Most of it was three tables per call
([tables-around-serialize.md](../research/tables-around-serialize.md)), and
two of them are gone. The table around the buffer is open in
[generated-code-performance.md](generated-code-performance.md). The code-size measurement
needs the fixtures restructured, one call per module. Tier 3 has no driver:
nothing yet asks what a serializer costs on the wire once a networking layer
batches it, and [networking.md](networking.md) is where that would come from.
A Zap-shaped timing has no driver either, and a transcription would measure
the transcription as much as Zap.

## How, briefly

1. Add the tagged union and packed `toggles` to
   `tests/src/bench/baseline/codecs.luau`, each writing surge's exact bytes,
   which the size tier confirms.
2. Split the fixtures so each factory call is a module of its own, and report
   each module's compiled size beside the speed table.
3. Tier 3 only if wire cost with batching becomes a question the serializer
   comparison cannot answer.
4. A Zap-shaped timing only if Zap's speed becomes a question Blink's column,
   the other IDL compiler, cannot answer.
