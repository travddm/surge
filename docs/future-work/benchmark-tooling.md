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
`CFrame` array already prices the loop at under a nanosecond per element; and
not the large record until Tier B of
[type-coverage-parity.md](type-coverage-parity.md) has settled its length
prefix, because a baseline writes surge's exact bytes and the size tier
checks that it does.

**Measure the generated Luau's size.** Each fixture module holds its shape,
its sample value and three factory calls, so its compiled size is not any one
library's generated code. Measuring it honestly needs each call in a module of
its own per fixture and library, and it belongs beside the speed tier, where
code size against speed is the question.

**A third tier, for wire cost.** `Stats.DataSendKbps` in a real Roblox
client and server is Blink's own benchmark method, and the only measure that
includes remote overhead and batching, so a networking library and a bare
serializer would meet on one axis.

## Why deferred

None of the three can start yet. Widening the baseline measures nothing new
until the per-call gap the three existing rows already show is understood:
surge's encode is about 0.2 µs per call behind the hand-written codec, and
[generated-code-against-hand-written.md](../research/generated-code-against-hand-written.md)
accounts for an eighth of it and names two table allocations per call as the
next thing to measure. The large record also waits on Tier B. The code-size
measurement needs the fixtures restructured, one call per module. Tier 3 has
no driver: nothing yet asks what a serializer costs on the wire once a
networking layer batches it, and [networking.md](networking.md) is where that
would come from.

## How, briefly

1. Measure the per-call gap's next candidate, then add the tagged union and
   packed `toggles` to `tests/src/bench/baseline/codecs.luau`, each writing
   surge's exact bytes, which the size tier confirms.
2. Split the fixtures so each factory call is a module of its own, and report
   each module's compiled size beside the speed table.
3. Tier 3 only if wire cost with batching becomes a question the serializer
   comparison cannot answer.
