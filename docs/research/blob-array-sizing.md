# An array of objects that hold a blob, sized by its count

2026-10-07 · surge `e17c7f2` · rbxts-transformer-surge `9056ffd` · Roblox
0.741.19.7411056

## Abstract

An object that holds a blob writes the same bytes for every value, but it had
no fixed size to the transformer, so an array of such objects kept the
scratch buffer. This change sizes such an array by its count times the
element's bytes, so its `serialize` creates its result at that size. On the
row of 50 `Instance` references, encode is 1.108× adjusted, 0.142 µs less a
call, and decode, whose code did not change, did not move. The hand-written
codec encodes that row 1.28× as fast as surge, where it was 1.44×. The change
is kept.

## Background

A blob reserves no bytes, and `fixedBytes` admits no blob: a fixed-size field
may share a run of Transformer 5.5 in
[specs/transformer.md](../specs/transformer.md), and a blob's push or read
would then be emitted inside the run. An object that holds a blob therefore
had no fixed size, and Transformer 5.20 sized an `array` only when its
element was fixed-size or a union. The instance references' `serialize` kept
the scratch buffer: a capacity check at each element's reservation, and
`finishWrite`'s copy at the end
([blob-channel-inline.md](blob-channel-inline.md) named this as what was left
of that row's encode gap).

With this change, an element of a constant size is one that is fixed-size, or
whose size reads nothing of its value, and an `array` of such elements is sized
by its count times that size (Transformer 5.20). The row's `serialize` now
starts with:

```luau
local arr1 = value.entries
local __surge_scratch = buffer.create(#arr1 * 2 + 4)
local __surge_cursor = 0
```

and no reservation checks the capacity. The exact form of an `array` and a
tuple's rest are sized the same way, and no catalog row has either. Among the
fixture modules, only the instance references' surge module changed, and
[benchmarks/code-size.md](../benchmarks/code-size.md) took it from 1,888 to
1,240 bytes of bytecode. Its `deserialize` is the same code, but for the
numbers in its locals' names.

## Method

**Builds.** The reference is surge `c9faf84` and rbxts-transformer-surge
`9cbe5e5`, which build the same code as the table committed at surge
`a6cd67d`. The change is surge `e17c7f2` and rbxts-transformer-surge
`9056ffd`. Each run's compiled instance references module was kept: the
reference's calls `grow`, and the change's does not.

**Runs.** Each is one full invocation of `mise run bench:speed`: two Studio
runs back to back, nine trials per cell per run. The reference ran from 09:22
to 09:32 UTC, and the change from 09:42 to 09:52 UTC. At each start no Roblox
process was running, and the CPU load, averaged over fifteen one-second
samples of `Get-Counter`, was 8% and 14%.

A first invocation of the change, from 09:32 to 09:41 UTC at a load of 12%,
is not read. In its second run, the hand-written codec's encode of the
instance references fell from 927.1k to 729.5k a second, and recovered to
876.1k and 872.3k in its last two trials. fbs's fell from 248.6k to 228.2k,
and surge's encode of the unpacked toggles, the wide struct and the tagged
union fell with them. surge's cell on the row was marked noisy. The invocation that
is read was taken next, under the same reading rule, fixed before it ran.

**Reading.** As in [size-reads-tag-once.md](size-reads-tag-once.md), with the
rule that the change stays unless the instance references are slower past
the band on either half.

**Controls.** The fbs, serio, Blink and baseline columns, and the sixteen rows
whose code did not change.

## Results

The instance references:

| Half   | Reference    | Change       | Ratio | `D`       | Adjusted | µs a call | Runs, reference | Runs, change   |
| ------ | ------------ | ------------ | ----- | --------- | -------- | --------- | --------------- | -------------- |
| encode | 648.8k ±1.3% | 714.8k ±2.1% | 1.102 | 0.994 (3) | 1.108    | −0.142    | 649.4k, 648.6k  | 712.2k, 720.0k |
| decode | 267.1k ±2.3% | 258.7k ±7.2% | 0.969 | 1.000 (3) | 0.968    | +0.122    | 265.9k, 271.3k  | 261.2k, 257.4k |

The other encode rows moved between 0.974× and 1.005× adjusted, but for
`Blink: Booleans`, which is marked noisy. The quiet control cells moved 0.994×
on encode, quartiles [0.983, 1.000] over 48. The other decode rows moved
between 0.963× and 1.007×, and the quiet control cells 0.989×, quartiles
[0.978, 0.997] over 51.

Against the hand-written codec, the instance references' encode is 1.28× in
the change's run, and 1.305× and 1.269× by run, where the reference had it at
1.44×, and 1.430× and 1.445× by run. Their decode is 1.03×, and 1.018× and
1.061× by run, where it was 1.03×, and 1.016× and 1.018× by run.

## Discussion

The row's encode moved in both runs, clear of both runs of the reference, and
no other encode row moved. The 0.142 µs a call is what the scratch path cost
this row: a capacity check at each of 50 reservations, the closure's scratch
state, and a copy of 104 bytes at the end.

The decode is the same code in both builds. Its 0.968× is inside the band of
26% that two invocations of unchanged code differ by on one cell
([noise-in-the-speed-tier.md](noise-in-the-speed-tier.md)), and the quiet
decode cells moved 0.989× in the same run, so it is read as no change.

What is left of the encode gap is not attributed. Two differences are known.
Each element moves the cursor for its two bytes, where the hand-written codec
writes at an offset it computes from the index. Each element appends its blob
with `table.insert` to a list created empty, where the hand-written codec
creates its list at the count and stores each blob at its index; it can,
because no element of its row is `nil`, and `table.insert` is what appends
nothing for `nil` (Wire format 6.7 in
[specs/wire-format.md](../specs/wire-format.md)).

## Conclusion

Sizing an array of objects that hold a blob by its count is worth 1.108× on
the instance references' encode. The hand-written codec is 1.28× ahead on
that row's encode, where it was 1.44×, and the decode did not change.

## Data

- The reference:
  [data/before-blob-array-sizing.md](data/before-blob-array-sizing.md) and
  [data/before-blob-array-sizing.tsv](data/before-blob-array-sizing.tsv),
  recorded at surge `c9faf84` and rbxts-transformer-surge `9cbe5e5`.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `f8bc11b`,
  recorded at surge `e17c7f2` and rbxts-transformer-surge `9056ffd`.
- The invocation not read:
  [data/blob-array-sizing-disturbed.md](data/blob-array-sizing-disturbed.md)
  and
  [data/blob-array-sizing-disturbed.tsv](data/blob-array-sizing-disturbed.tsv),
  recorded at the change's commits.
- The figures above were computed from the `.tsv` files, with the recorder's
  own median, spread and noise rule.
