# An array of objects that hold a string, sized by a loop

2026-10-07 · surge `942b73e` · rbxts-transformer-surge `8727491` · Roblox
0.741.19.7411056

## Abstract

An array whose elements vary in size kept the scratch buffer unless its
elements were unions: a loop over the elements ahead of the result measured
slower on an array of strings. An array of objects that hold a string was not
measured either way, and the catalog had no row for it. This adds one, a
leaderboard of 50 entries of a name, a `u32` and an `f64`, and sizes such an
array by a loop over its elements, as an array of unions is. Encode is 1.088×
as measured and 1.123× adjusted, 0.176 µs less a call, and decode, whose code
did not change, did not move. The hand-written codec encodes the row 1.01× as
fast as surge, where it was 1.14×. The change is kept.

## Background

A sized `serialize` (Transformer 5.20 in
[specs/transformer.md](../specs/transformer.md)) creates its result at its
size and checks no capacity. An array whose elements vary in size needs a
loop over them to be sized ahead of its write. That loop paid on arrays of
unions and lost on an array of strings and on a dictionary
([exact-sizing-with-loops.md](exact-sizing-with-loops.md)), so only an array
of unions was sized by it, and an array of objects that hold a string kept
the scratch buffer: a capacity check at each of an element's two
reservations, one for the name and one for the score and the user id, and
`finishWrite`'s copy at the end.

The new row is the leaderboard (Benchmark harness 3.1 in
[specs/benchmark-harness.md](../specs/benchmark-harness.md)): 50 entries, each
a name of up to 20 bytes, a `u32` score and an `f64` user id, 1,218 bytes in
all. Every column has a cell on it, and the hand-written codec writes the same
bytes as surge (Benchmark harness 4.5). With this change, the row's
`serialize` starts with:

```luau
local arr1 = value.entries
local size3 = 4
for _, item2 in arr1 do
	size3 += #item2.name + 16
end
local __surge_scratch = buffer.create(size3)
```

and its reservations check no capacity. Among the fixture modules, only the
leaderboard's surge module changed, and
[benchmarks/code-size.md](../benchmarks/code-size.md) took it from 1,913 to
1,256 bytes of bytecode. Its `deserialize` is the same code, but for the
numbers in its locals' names.

## Method

**Builds.** The reference is surge `942b73e` and rbxts-transformer-surge
`9056ffd`. The change is surge `942b73e` and rbxts-transformer-surge
`8727491`, which allows the loop for an element that is an object. Each run's
compiled leaderboard module was kept: the reference's calls `grow`, and the
change's does not.

**Runs.** Each is one full invocation of `mise run bench:speed`: two Studio
runs back to back, nine trials per cell per run. The reference ran from 10:55
to 11:05 UTC, and the change from 11:05 to 11:15 UTC. At each start no Roblox
process was running, and the CPU load, averaged over fifteen one-second
samples of `Get-Counter`, was 5% and 6%.

**Reading.** As in [size-reads-tag-once.md](size-reads-tag-once.md), with the
rule that the change stays unless the leaderboard is slower past the band on
either half.

**Controls.** The fbs, serio, Blink and baseline columns, and the seventeen
rows whose code did not change.

## Results

The leaderboard:

| Half   | Reference    | Change       | Ratio | `D`       | Adjusted | µs a call | Runs, reference | Runs, change   |
| ------ | ------------ | ------------ | ----- | --------- | -------- | --------- | --------------- | -------------- |
| encode | 458.1k ±2.8% | 498.4k ±3.0% | 1.088 | 0.968 (4) | 1.123    | −0.176    | 453.2k, 465.8k  | 505.6k, 490.8k |
| decode | 164.4k ±5.9% | 160.2k ±3.4% | 0.974 | 0.989 (4) | 0.985    | +0.160    | 161.2k, 168.5k  | 158.5k, 160.6k |

The row's four control cells moved 0.968× on encode, where the quiet control
cells of the whole catalog moved 0.996×, so the encode gain lies between the
1.088× measured and the 1.123× adjusted.

The other encode rows moved between 0.976× and 1.020× adjusted. The quiet
control cells moved 0.996× on encode, quartiles [0.981, 1.004] over 55. The
other decode rows moved between 0.955× and 1.035×, and the quiet control cells
0.999×, quartiles [0.990, 1.007] over 54.

Against the hand-written codec, the leaderboard's encode is 1.01× in the
change's run, and 1.031× and 1.010× by run, where the reference had it at
1.14×, and 1.141× and 1.125× by run. On decode, surge is the faster of the
two: the hand-written codec runs 0.98× as fast in the change's run, and 0.97×
in the reference's.

## Discussion

The row's encode moved in both runs, clear of both runs of the reference, and
no other encode row moved. The loop saved about 3.5 ns an element. On the
string-heavy row it cost about 2.8 ns an element
([exact-sizing-with-loops.md](exact-sizing-with-loops.md)). Each leaderboard
entry makes two reservations, as most union elements do, where a string makes
one; a dictionary's entry also makes two, and lost. Why the loop pays on the
one and not on the other is still not probed. The string-heavy result is from
before later changes to the size and the write, and the array of strings was
not measured again.

The decode is the same code in both builds. Its 0.985× is inside the band of
26% that two invocations of unchanged code differ by on one cell
([noise-in-the-speed-tier.md](noise-in-the-speed-tier.md)), so it is read as
no change.

## Conclusion

Sizing an array of objects that hold a string by a loop over them is worth
1.088× to 1.123× on the leaderboard's encode, and leaves the hand-written
codec 1.01× ahead on it, where it was 1.14×. An array of objects whose size
varies is now sized by a loop, as an array of unions is.

## Data

- The reference: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `685401a`,
  recorded at surge `942b73e` and rbxts-transformer-surge `9056ffd`.
- The change: the same files as committed at surge `489dcf1`, recorded at
  surge `942b73e` and rbxts-transformer-surge `8727491`.
- The figures above were computed from the two `.tsv` files, with the
  recorder's own median, spread and noise rule.
