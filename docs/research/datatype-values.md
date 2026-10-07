# A datatype's value read once

2026-10-07 · surge `f16bdc3` · rbxts-transformer-surge `8d1c05d` · Roblox
0.741.19.7411056

## Abstract

A `spawn` event's write in the tagged union row read the event's `at`
property once for each component of its `Vector3`, where the hand-written
codec reads it once ([size-reads-tag-once.md](size-reads-tag-once.md)). This
change read the value of a `Vector2`, a `Vector3`, a `Color3`, a datatype of
more than one component and an unpacked `CFrame` into a local once, when the
value is not a local. Against the build before it, the tagged union's encode
is 1.027× adjusted, with one run of the change below both runs of the
reference and one above them, which is not a reading. The change is
withdrawn: the local it adds for each such property inside a shared
reservation took a shape that compiled before past Luau's limit of 200
locals.

## Background

With this change (Transformer 5.26 at the commits above), a `spawn` event's
branch was:

```luau
local pos9 = pos8 + 1
local vec10 = item6.at
buffer.writef32(__surge_scratch, pos9, vec10.X)
buffer.writef32(__surge_scratch, pos9 + 4, vec10.Y)
buffer.writef32(__surge_scratch, pos9 + 8, vec10.Z)
```

where it read `item6.at.X`, `item6.at.Y` and `item6.at.Z` before. No other
catalog row writes a datatype through a property path:
[benchmarks/code-size.md](../benchmarks/code-size.md) changed on the tagged
union's row alone.

## Method

**Builds.** The reference is surge `782356d` and rbxts-transformer-surge
`4a7a289`, whose table is the one committed at surge `ccfc922`. The change is
surge `f16bdc3` and rbxts-transformer-surge `8d1c05d`.

**Runs.** Both ran on 2026-10-07, the reference from 03:25 to 03:34 UTC and
the change from 04:18 to 04:27 UTC, each one full invocation of
`mise run bench:speed`: two Studio runs back to back, nine trials per cell
per run. At the change's start no Roblox process was running, and the CPU
load, averaged over fifteen one-second samples of `Get-Counter`, was 11%. The
Roblox build is the same.

**Reading.** As in [size-reads-tag-once.md](size-reads-tag-once.md), with the
same rule: the change stays unless the tagged union's encode is slower past
the band.

**Controls.** The fbs, serio, Blink and baseline columns, and the fifteen
encode rows whose code did not change.

## Results

Encode of the tagged union:

| Reference    | Change       | Ratio | `D`       | Adjusted | Runs, reference | Runs, change   |
| ------------ | ------------ | ----- | --------- | -------- | --------------- | -------------- |
| 363.4k ±1.3% | 369.0k ±3.0% | 1.015 | 0.988 (4) | 1.027    | 364.8k, 363.3k  | 361.4k, 369.6k |

The other encode rows moved between 0.973× and 1.031× adjusted, with two
exceptions whose code did not change. The guarded union's surge cell moved
0.991×, and its two control cells 1.091×, so its 0.908× adjusted is the
controls'. `Blink: Booleans` moved 1.075× and is marked noisy. The quiet
control cells moved 1.001×, quartiles [0.989, 1.007] over 46. On decode,
where no code changed, the quiet control cells moved 1.013×, quartiles
[1.007, 1.020] over 47.

Against the hand-written codec, the tagged union's encode is 1.02× in the
change's run, and 1.024× and 1.035× by run, where the reference's run had it
at 1.05×. The hand-written codec's own cell moved 0.986× between the two
runs, so that move is not surge's alone.

## The register limit

Luau gives a function 200 locals. The transformer puts a large object's
properties in blocks of at most 32 locals (Transformer 5.8 in
[specs/transformer.md](../specs/transformer.md)), and ends a run of
properties that share one reservation before it holds more than 31 (5.5), so
that a run fits in a block when each of its properties declares one local. A
`CFrame` declares five on the write side. The change added one more for each
datatype property in a run, which took this shape past the limit:

```ts
interface StringsThenCFrames {
	s0: string; // and fifteen more strings, s1 to s15
	c0: CFrame; // and thirty more CFrames, c1 to c30
}
```

Its `serialize` failed to compile with "Out of local registers", and with
rbxts-transformer-surge `4a7a289` it compiles. Shapes past the limit before
this change are in
[future-work/locals-in-a-run.md](../future-work/locals-in-a-run.md).

## Discussion

Reading the value once removed two table reads from each `spawn` event, and
the speed tier cannot read what that was worth on this row: the change's two
runs straddle the reference's. A change that measures as nothing is kept
when what it emits is no worse, and this one is worse in one way: it takes
registers from a function whose locals the transformer already counts short.
It is withdrawn rather than repaired, since repairing it would mean changing
how a run is bounded to keep a change that measured as nothing.

With this difference tried, the known differences left between surge's write
of the tagged union and the hand-written one are arithmetic on locals and
cursor moves, and what is left of the gap is not attributed.

## Conclusion

Reading a datatype's value once is worth nothing the speed tier reads on the
tagged union's encode, and it is withdrawn, because the local it adds in a
run took a shape past Luau's limit of 200 locals.

## Data

- The reference: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `ccfc922`.
- The change: the same files as committed at surge `421ba84`, recorded at
  surge `f16bdc3` and rbxts-transformer-surge `8d1c05d`.
- The figures above were computed from the two `.tsv` files, with the
  recorder's own median, spread and noise rule.
