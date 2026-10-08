# An array of arrays, sized by a loop

2026-10-08 · surge `8375f07` · rbxts-transformer-surge `46bffef` · Roblox
0.741.19.7411056

## Abstract

An array whose elements are arrays kept the scratch buffer, and was not
measured either way: the catalog had no row for it. This adds one, 20 rows of
up to 20 `u16` elements, and sizes such an array by a loop over its rows, as
an array of unions or of objects is, with the rows' counts added once ahead of
the loop. Encode is 1.073× as measured and 1.078× adjusted, 0.080 µs less a
call, and decode, whose code did not change, did not move. The hand-written
codec, which encoded the row 1.10× as fast as surge, ran 0.97× as fast as it
in the change's run. The change is kept.

## Background

A sized `serialize` (Transformer 5.20 in
[specs/transformer.md](../specs/transformer.md)) creates its result at its
size and checks no capacity. Before this change, a loop ahead of the result
sized an array of unions and an array of objects whose size varies, and an
array of anything else whose size varies kept the scratch buffer. A loop had
measured slower on an array of strings
([string-and-dict-loops-again.md](string-and-dict-loops-again.md)) and faster
on an array of objects that hold a string
([object-array-loop-sizing.md](object-array-loop-sizing.md)).

The new row is the nested arrays (Benchmark harness 3.1 in
[specs/benchmark-harness.md](../specs/benchmark-harness.md)): 446 bytes, which
surge, fbs, serio and the hand-written codec each write; Blink and Zap write
404, with narrower counts. Before this change, its `serialize` checked the
scratch buffer's capacity twice a row, once for the row's count and once for
its elements, and copied its result at the end. With it, the size is:

```luau
local arr1 = value.rows
local size3 = #arr1 * 4 + 4
for _, item2 in arr1 do
	size3 += #item2 * 2
end
```

and no reservation checks the capacity. A row whose elements vary in size
still keeps an array of it on the scratch buffer: an array of arrays of
strings is not sized. Among the fixture modules, only the nested arrays' surge
module changed, and [benchmarks/code-size.md](../benchmarks/code-size.md) took
it from 1,750 to 1,084 bytes of bytecode. Its `deserialize` did not change.

## Method

**Builds.** The reference is surge `8375f07` and rbxts-transformer-surge
`72a4887`. The change is surge `8375f07` and rbxts-transformer-surge
`46bffef`. Each run's compiled nested arrays module was kept: the reference's
calls `grow`, and the change's does not.

**Runs.** Each is one full invocation of `mise run bench:speed`: two Studio
runs back to back, nine trials per cell per run. The reference ran from 02:46
to 02:57 UTC, and the change from 02:58 to 03:09 UTC. At each start no Roblox
process was running, and the CPU load, averaged over fifteen one-second
samples of `Get-Counter`, was 14% and 10%.

**Reading.** Fixed before the runs: the change stays only if the nested
arrays' encode is faster, with both runs of the change above both runs of the
reference, and the cell is not marked noisy.

**Controls.** The fbs, serio, Blink and baseline columns, and the twenty rows
whose code did not change.

## Results

The nested arrays:

| Half   | Reference    | Change       | Ratio | `D`       | Adjusted | µs a call | Runs, reference | Runs, change   |
| ------ | ------------ | ------------ | ----- | --------- | -------- | --------- | --------------- | -------------- |
| encode | 846.5k ±1.1% | 908.1k ±2.0% | 1.073 | 0.995 (4) | 1.078    | −0.080    | 850.0k, 843.4k  | 907.3k, 920.5k |
| decode | 301.7k ±3.8% | 305.6k ±2.9% | 1.013 | 1.026 (4) | 0.987    | −0.042    | 301.1k, 304.1k  | 303.6k, 306.0k |

The other encode rows moved between 0.974× and 1.015× adjusted, but for
`Blink: Booleans`, which moved 0.885× and runs at one of two speeds per Studio
process ([benchmark-tooling.md](../future-work/benchmark-tooling.md)). The
quiet control cells moved 0.998× on encode, quartiles [0.994, 1.002] over 63.
The other decode rows moved between 0.958× and 1.024×, and the quiet control
cells 0.996×, quartiles [0.988, 1.004] over 63.

Against the hand-written codec, which sizes the row by the same loop, the
nested arrays' encode is 0.97× in the change's run, and 0.949× and 0.987× by
run, where the reference had it at 1.10×, and 1.110× and 1.101× by run. The
hand-written codec's own encode ran lower in the change's run, 877.5k against
934.5k in the reference's. Their decode is 1.03× in the change's run and 1.00×
in the reference's.

## Discussion

The row's encode moved in both runs, clear of both runs of the reference, and
no other encode row moved. The loop saved about 4 ns a row: two capacity
checks, the scratch state in the closure, and the copy at the end, against a
second walk over 20 rows that reads each row's length. The same loop lost on
the string-heavy row's hundred strings
([string-and-dict-loops-again.md](string-and-dict-loops-again.md)), where each
element is one string behind one length, and here each of 20 rows is up to 20
elements behind one length. Why one pays and the other does not was not
probed.

## Conclusion

Sizing an array of arrays by a loop over its rows is worth 1.073× to 1.078×
on the nested arrays' encode, and leaves surge's encode of the row within the
band of the hand-written codec.

## Data

- The reference:
  [data/before-array-of-arrays-loop.md](data/before-array-of-arrays-loop.md)
  and
  [data/before-array-of-arrays-loop.tsv](data/before-array-of-arrays-loop.tsv),
  recorded at surge `8375f07` and rbxts-transformer-surge `72a4887`.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `955f747`,
  recorded at surge `8375f07` and rbxts-transformer-surge `46bffef`.
- The figures above were computed from the two `.tsv` files, with the
  recorder's own median, spread and noise rule.
