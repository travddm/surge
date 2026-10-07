# The tagged union's gap closed

2026-10-07 · surge `8de2795` · rbxts-transformer-surge `a566bd2` · Roblox
0.741.19.7411056

## Abstract

[tagged-union-attribution.md](tagged-union-attribution.md) attributed the
tagged union's 1.05× gap to the hand-written codec to two differences: a
`spawn` event's `at` read once for each component, and the size loop's form.
These two changes remove both: the size loop adds the bytes every element
writes once, ahead of the loop, and a datatype's value is read into a local
once, with that local counted in a run's locals. Measured together, the
tagged union's encode is 1.020× as measured and 1.035× adjusted, 0.053 µs
less a call, and the hand-written codec now encodes the row 1.02× as fast as
surge, where it was 1.06×. The changes are kept.

## Background

Before these changes, surge's size loop for the row added
`(if … else 16) + 1` for each event, and a `spawn` event's write read
`item.at` for each of its three components. Within one process, a
hand-written codec changed to do either ran 2% to 3% slower
([tagged-union-attribution.md](tagged-union-attribution.md)), and a size loop
that adds the variant bytes once, ahead of the loop, ran as fast as the
hand-written codec. Each is about 2%, which a pair of invocations cannot read
alone ([noise-in-the-speed-tier.md](noise-in-the-speed-tier.md)), so they are
measured together here.

With rbxts-transformer-surge `f787050` (Transformer 5.20 in
[specs/transformer.md](../specs/transformer.md)), the row's size is:

```luau
local arr1 = value.events
local size4 = #arr1 + 4
for _, item2 in arr1 do
	local tag3 = item2.kind
	size4 += (if tag3 == "chat" then #item2.text + 8 elseif tag3 == "damage" then 6 elseif tag3 == "despawn" then 4 else 16)
end
```

and with `a566bd2` (Transformer 5.26), a `spawn` event writes its position
through `local vec10 = item6.at`. Reading a datatype's value once was tried
before and withdrawn ([datatype-values.md](datatype-values.md)): the local it
took was not counted in a run of shared reservations, which let a shape of 16
strings and 31 `CFrame`s pass Luau's 200 locals. Now a `vector2`, a
`vector3`, a `color3` and a `datatype` of more than one component count two
locals in a run (Transformer 5.5), and the `cframe` is left as it was: its
write reads `Position` into a local already, and reads its value only once
more. `roundTripsRunsOfCFramesNextToBoundStrings` passes.

Among the fixture modules, the tagged union's, the leaderboard's and the
guarded union's surge modules changed: the leaderboard and the guarded union
are arrays sized by a loop too, so the first change reaches them, and they
are not controls here. [benchmarks/code-size.md](../benchmarks/code-size.md)
took the tagged union from 2,741 to 2,726 bytes of bytecode and the
leaderboard from 1,256 to 1,261. No `deserialize` changed.

## Method

**Builds.** The reference is surge `8de2795` and rbxts-transformer-surge
`da35c52`. The change is surge `8de2795` and rbxts-transformer-surge
`a566bd2`, which holds both changes. Each run's compiled tagged union module
was kept.

**Runs.** Each is one full invocation of `mise run bench:speed`: two Studio
runs back to back, nine trials per cell per run. The reference ran from 21:56
to 22:07 UTC, and the change from 22:07 to 22:17 UTC. At each start no Roblox
process was running, and the CPU load, averaged over fifteen one-second
samples of `Get-Counter`, was 7% both times.

**Reading.** Fixed before the runs: both changes stay only if the tagged
union's encode is faster, with both runs of the change above both runs of the
reference, and the cell is not marked noisy, and neither the leaderboard nor
the guarded union is slower with both runs of the change below both runs of
the reference.

**Controls.** The fbs, serio, Blink and baseline columns, and the sixteen
rows whose code did not change.

## Results

| Row, half             | Reference    | Change       | Ratio | `D`       | Adjusted | µs a call | Runs, reference | Runs, change   |
| --------------------- | ------------ | ------------ | ----- | --------- | -------- | --------- | --------------- | -------------- |
| tagged union, encode  | 362.9k ±1.1% | 370.0k ±3.4% | 1.020 | 0.985 (4) | 1.035    | −0.053    | 362.3k, 363.4k  | 376.7k, 364.2k |
| tagged union, decode  | 95.7k ±2.5%  | 96.5k ±2.5%  | 1.009 | 0.994 (4) | 1.015    | −0.093    | 97.1k, 94.9k    | 95.8k, 97.4k   |
| leaderboard, encode   | 500.9k ±1.6% | 488.2k ±5.9% | 0.975 | 0.972 (4) | 1.003    | +0.052    | 498.5k, 501.9k  | 510.4k, 481.5k |
| guarded union, encode | 647.1k ±1.3% | 646.1k ±3.5% | 0.998 | 0.990 (2) | 1.008    | +0.002    | 651.0k, 644.8k  | 656.9k, 634.3k |

Both runs of the change are above both runs of the reference on the tagged
union's encode, the second by 0.8k a second. The leaderboard and the guarded
union each have one run of the change above both runs of the reference and
one below them. The change's second run was the slower of its two on most
rows: the leaderboard's hand-written codec, for one, ran at 478.1k there
against 508.5k in the first.

The other encode rows moved between 0.976× and 1.028× adjusted, but for the
tree, whose surge cell moved 0.945× on unchanged code against its one control
cell's 1.008×, and `Blink: Booleans`, marked noisy in the change. The quiet
control cells moved 0.992× on encode, quartiles [0.980, 0.999] over 54, and
0.996× on decode, quartiles [0.992, 1.002] over 56.

Against the hand-written codec, the tagged union's encode is 1.02× in the
change's run, and 1.006× and 1.015× by run, where the reference had it at
1.06×, and 1.068× and 1.050× by run.

## Discussion

The tagged union's encode moved by about what the two attributed differences
were worth together, and is now within the band of the hand-written codec.
The margin is thin: the change's second run is above the reference's faster
run by 0.2%, and the adjusted ratio leans on the row's controls having moved
0.985× together. What carries the reading is the attribution, where each
difference cleared its floor in both of its runs within one process.

The leaderboard and the guarded union, which the first change also reaches,
did not move either way.

## Conclusion

Adding a size loop's constant bytes once and reading a datatype's value once
are worth 1.020× to 1.035× on the tagged union's encode together, and leave
the hand-written codec 1.02× ahead on it, where it was 1.06×. With it, each of
the eight rows with a hand-written codec is within the band of it on both
halves: the flat struct, the nested object and the `CFrame` array
([size-and-read-locals.md](size-and-read-locals.md)), the packed toggles
([packed-bits-read-in-place.md](packed-bits-read-in-place.md)), the
leaderboard ([object-array-loop-sizing.md](object-array-loop-sizing.md)), the
tree ([recursion-write-cursor.md](recursion-write-cursor.md)), the instance
references ([blob-store-by-index.md](blob-store-by-index.md)) and the tagged
union.

## Data

- The reference:
  [data/before-tagged-union-closed.md](data/before-tagged-union-closed.md) and
  [data/before-tagged-union-closed.tsv](data/before-tagged-union-closed.tsv),
  recorded at surge `8de2795` and rbxts-transformer-surge `da35c52`.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `f16ad80`,
  recorded at surge `8de2795` and rbxts-transformer-surge `a566bd2`.
- The figures above were computed from the two `.tsv` files, with the
  recorder's own median, spread and noise rule.
