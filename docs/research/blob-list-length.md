# The blob list created at its length

2026-10-07 · surge `693f5ce` · rbxts-transformer-surge `680cff4` · Roblox
0.741.19.7411056

## Abstract

A `serialize` created its blob list empty and appended to it, so a list of 50
blobs was grown several times in each call, where the hand-written codec
creates its list once at its count
([blob-array-sizing.md](blob-array-sizing.md)). This change creates the list
with `table.create` at the most blobs the value appends. On the row of 50
`Instance` references, encode is 1.170× as measured and 1.195× adjusted,
0.197 µs less a call, and decode, whose code did not change, did not move.
The hand-written codec encodes the row 1.07× as fast as surge, where it was
1.28×. The change is kept.

## Background

Each blob is appended with `table.insert`, which appends nothing for `nil`
(Wire format 6.7 in [specs/wire-format.md](../specs/wire-format.md)). A list
created empty has no room, so appending 50 blobs grows its array part each
time it fills. The hand-written codec of the row creates its list with
`table.create(count)` and stores each blob at its index.

With this change (Transformer 5.9 in
[specs/transformer.md](../specs/transformer.md)), a `serialize` whose shape
reaches no recursion helper creates its list at the most blobs its value
appends: one for each `blob`, an optional that holds one counted as present,
and an `array`'s count times its element's. The row's `serialize` now starts
with:

```luau
local arr1 = value.entries
local __surge_scratch = buffer.create(#arr1 * 2 + 4)
local __surge_cursor = 0
local __surge_writeBlobs = table.create(#arr1)
```

It reads the array through the local its size bound, and still appends with
`table.insert`, so an absent blob leaves no hole, and a list created longer
than it ends holds only what was appended. Where the count would need a
loop, or a union, a tuple or a `dict` holds a blob, the list is created empty
as before. Among the fixture modules, only the instance references' surge
module changed, and [benchmarks/code-size.md](../benchmarks/code-size.md)
took it from 1,240 to 1,255 bytes of bytecode. Its `deserialize` did not
change.

## Method

**Builds.** The reference is surge `693f5ce` and rbxts-transformer-surge
`062199a`. The change is surge `693f5ce` and rbxts-transformer-surge
`680cff4`. Each run's compiled instance references module was kept: the
reference's creates `{}`, and the change's `table.create(#arr1)`.

**Runs.** Each is one full invocation of `mise run bench:speed`: two Studio
runs back to back, nine trials per cell per run. The reference ran from 19:51
to 20:01 UTC, and the change from 20:01 to 20:12 UTC. At each start no Roblox
process was running, and the CPU load, averaged over fifteen one-second
samples of `Get-Counter`, was 8% and 7%.

**Reading.** Fixed before the runs: the change stays only if the instance
references' encode is faster, with both runs of the change above both runs of
the reference, and the cell is not marked noisy.

**Controls.** The fbs, serio, Blink and baseline columns, and the eighteen
rows whose code did not change.

## Results

The instance references:

| Half   | Reference    | Change       | Ratio | `D`       | Adjusted | µs a call | Runs, reference | Runs, change   |
| ------ | ------------ | ------------ | ----- | --------- | -------- | --------- | --------------- | -------------- |
| encode | 739.6k ±1.2% | 865.7k ±4.2% | 1.170 | 0.979 (3) | 1.195    | −0.197    | 737.8k, 740.4k  | 887.9k, 853.8k |
| decode | 269.7k ±2.1% | 267.1k ±2.5% | 0.990 | 0.994 (3) | 0.996    | +0.036    | 269.6k, 269.7k  | 271.4k, 264.8k |

The other encode rows moved between 0.980× and 1.022× adjusted, but for
`Blink: Booleans`, which is marked noisy. The quiet control cells moved 1.000×
on encode, quartiles [0.994, 1.005] over 54. The other decode rows moved
between 0.982× and 1.030×, and the quiet control cells 0.998×, quartiles
[0.993, 1.005] over 56.

Against the hand-written codec, the instance references' encode is 1.07× in
the change's run, and 1.041× and 1.088× by run, where the reference had it at
1.28×, and 1.296× and 1.278× by run. Their decode is 1.02×, and 1.027× and
1.012× by run, where it was 1.01×, and 1.015× and 1.014× by run.

## Discussion

The row's encode moved in both runs, clear of both runs of the reference, and
no other encode row moved. Creating the list at its length saved about 3.9 ns
a blob, two thirds of what was left of the gap to the hand-written codec. The
per-element cursor move, which the hand-written codec does not make, is what
is left of the two known differences.

A list is created at its length only where that length is an expression of
the value's lengths. A list a recursion helper appends to is in the closure
and created empty each call, and so is one whose length depends on a union's
variant or a dict's entries. No catalog row has either with a blob.

## Conclusion

Creating the blob list at the most blobs a value appends is worth 1.170× to
1.195× on the instance references' encode, and leaves the hand-written codec
1.07× ahead on it, where it was 1.28×.

## Data

- The reference:
  [data/before-blob-list-length.md](data/before-blob-list-length.md) and
  [data/before-blob-list-length.tsv](data/before-blob-list-length.tsv),
  recorded at surge `693f5ce` and rbxts-transformer-surge `062199a`.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `9b0db84`,
  recorded at surge `693f5ce` and rbxts-transformer-surge `680cff4`.
- The figures above were computed from the two `.tsv` files, with the
  recorder's own median, spread and noise rule.
