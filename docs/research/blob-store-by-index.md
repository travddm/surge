# Each blob stored at a counted index

2026-10-07 · surge `324c701` · rbxts-transformer-surge `7576b8a` · Roblox
0.741.19.7411056

## Abstract

A `serialize` appended each blob to its list with `table.insert`, where the
hand-written codec stores each blob at its index
([blob-list-length.md](blob-list-length.md)). This change stores a blob at the
index a count of the blobs stored so far gives, after a test that it is not
`nil`, so the list still has no hole. On the row of 50 `Instance`
references, encode is 1.078× as measured and 1.076× adjusted, 0.082 µs less
a call, and decode, whose code did not change, did not move. surge's encode
of the row is now within the band of the hand-written codec, 0.97× as fast as
it. The change is kept.

## Background

`table.insert` appends at the list's length plus one, and appends nothing for
`nil` (Wire format 6.7 in [specs/wire-format.md](../specs/wire-format.md)).
Since [blob-list-length.md](blob-list-length.md), the list is created at the
most blobs its value appends, so the list has room for each blob either way.

With this change (Transformer 5.9 in
[specs/transformer.md](../specs/transformer.md)), each element of the row
stores its `Instance` with:

```luau
do
	local blob6 = item4.model
	if blob6 ~= nil then
		__surge_writeBlobs[__surge_writeBlobCount + 1] = blob6
		__surge_writeBlobCount += 1
	end
end
```

where `__surge_writeBlobCount` is a local of `serialize`, or of the closure
where a recursion helper stores blobs. A `nil` is neither stored nor counted,
as `table.insert` stored nothing for it. Among the fixture modules, only the
instance references' surge module changed, and
[benchmarks/code-size.md](../benchmarks/code-size.md) took it from 1,255 to
1,249 bytes of bytecode. Its `deserialize` did not change.

A later commit, rbxts-transformer-surge `e6325ac`, skips the test where an
optional's presence test has made it, so an optional blob is tested once. No
catalog row holds an optional blob, so that was not measured, and the
instance references' module is the same under both commits.

## Method

**Builds.** The reference is surge `324c701` and rbxts-transformer-surge
`680cff4`. The change is surge `324c701` and rbxts-transformer-surge
`7576b8a`. Each run's compiled instance references module was kept: the
reference's calls `table.insert`, and the change's does not.

**Runs.** Each is one full invocation of `mise run bench:speed`: two Studio
runs back to back, nine trials per cell per run. The reference ran from 20:32
to 20:42 UTC, and the change from 20:43 to 20:53 UTC. At each start no Roblox
process was running, and the CPU load, averaged over fifteen one-second
samples of `Get-Counter`, was 10% and 8%.

**Reading.** Fixed before the runs: the change stays only if the instance
references' encode is faster, with both runs of the change above both runs of
the reference, and the cell is not marked noisy.

**Controls.** The fbs, serio, Blink and baseline columns, and the eighteen
rows whose code did not change.

## Results

The instance references:

| Half   | Reference    | Change       | Ratio | `D`       | Adjusted | µs a call | Runs, reference | Runs, change   |
| ------ | ------------ | ------------ | ----- | --------- | -------- | --------- | --------------- | -------------- |
| encode | 882.0k ±8.0% | 950.8k ±1.8% | 1.078 | 1.002 (3) | 1.076    | −0.082    | 909.7k, 838.9k  | 959.8k, 942.6k |
| decode | 264.3k ±3.3% | 261.1k ±1.9% | 0.988 | 0.999 (3) | 0.989    | +0.046    | 268.9k, 263.5k  | 259.9k, 263.7k |

The reference's second run was slower on this row than its first, for surge
and for the hand-written codec alike, 838.9k and 875.3k against 909.7k and
939.9k. Both runs of the change are above both runs of the reference all the
same.

The other encode rows moved between 0.978× and 1.020× adjusted, but for
`Blink: Booleans`, which is marked noisy in the reference. The quiet control
cells moved 1.001× on encode, quartiles [0.996, 1.008] over 55. The other
decode rows moved between 0.986× and 1.028×, and the quiet control cells
1.004×, quartiles [0.997, 1.009] over 55.

Against the hand-written codec, the instance references' encode is 0.97× in
the change's run, and 0.967× and 0.978× by run, where the reference had it at
1.04×, and 1.033× and 1.043× by run. Their decode is 1.00×, and 1.003× and
0.998× by run, where it was 1.01×.

## Discussion

The row's encode moved in both runs, clear of both runs of the reference, and
no other encode row moved. Storing at a counted index saved about 1.6 ns a
blob. Whether that is the length `table.insert` finds for each blob or the
call itself was not probed. What is left between surge and the hand-written
codec on this row
is within the band, with surge the faster of the two in this session. The
cursor move each element makes, which the hand-written codec does not, is
the one known difference left, and it is not resolved here.

## Conclusion

Storing each blob at a counted index is worth 1.076× to 1.078× on the
instance references' encode, and leaves surge's encode of the row within the
band of the hand-written codec.

## Data

- The reference:
  [data/before-blob-store-by-index.md](data/before-blob-store-by-index.md)
  and
  [data/before-blob-store-by-index.tsv](data/before-blob-store-by-index.tsv),
  recorded at surge `324c701` and rbxts-transformer-surge `680cff4`.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `599f872`,
  recorded at surge `324c701` and rbxts-transformer-surge `7576b8a`.
- The figures above were computed from the two `.tsv` files, with the
  recorder's own median, spread and noise rule.
