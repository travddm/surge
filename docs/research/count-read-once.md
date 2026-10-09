# A variable-length count read once and compared once

2026-10-09 · surge `8b1ac9b` and `89c2a85` · Lune 0.10.5 · Roblox
0.742.0.7421053

## Abstract

With a variable-length count by default, surge's encode slowed by 2.7% to
6.0% on six rows, where a size computed by a loop read each element's length
twice and each write compared its count with 254 twice
([variable-length-counts.md](variable-length-counts.md)). This change reads
the length into a local once in a loop's body, and has the write compare the
count once, with one reservation in each of the two branches. Encode is 1.019×
to 1.097× adjusted on the six rows that slowed, with both runs of the change
above both runs of the reference on five of them, and the hand-written
codec, which writes the same bytes, is within 1.04× of surge's encode on each
of its ten rows. Against the run before the variable-length count, every
row's encode is within the noise or faster. The change is kept.

## Background

[variable-length-counts.md](variable-length-counts.md) found the hand-written
codec, writing the same bytes, ahead of surge's encode on four of its ten
rows, and named two differences in the code. Both are changed here
(Transformer 5.20 and 5.28 in [specs/transformer.md](../specs/transformer.md)).

In a loop's body, and in a branch inside one, a size reads a count's length
into a local ahead of the terms that read it, as it reads a tag. The
leaderboard's size, for one, was:

```luau
for _, item3 in arr1 do
	size4 += (if #item3.name < 254 then 1 elseif #item3.name <= 65535 then 3 else 5) + #item3.name
end
```

and is now:

```luau
for _, item3 in arr1 do
	local len4 = #item3.name
	size5 += (if len4 < 254 then 1 elseif len4 <= 65535 then 3 else 5) + len4
end
```

A union in a loop's body whose variant declares such a local is sized by an
if chain, where it was one expression. Outside a loop, a branch still reads
the length for each term.

A write compares a variable-length count with 254 once, and each branch
reserves its own bytes, where it bound the count's bytes to a local, reserved
them, and compared the count again to choose its form:

```luau
if len8 < 254 then
	local pos9 = __surge_cursor
	__surge_cursor = pos9 + (len8 + 1)
	buffer.writeu8(__surge_scratch, pos9, len8)
	buffer.writestring(__surge_scratch, pos9 + 1, s7)
else
	-- the long form's reservation, `writeLongCount`, and the bytes
end
```

No byte changed. [benchmarks/code-size.md](../benchmarks/code-size.md) moved
each module by −21 to +471 bytes of bytecode, the most on the string-heavy
row, whose strings each write both branches. No `deserialize` changed.

## Method

**Builds.** The reference is `8b1ac9b`, whose tables were recorded at
`4885713`. The change is `89c2a85`.

**Runs.** Each is one full invocation of `mise run bench:speed`: two Studio
runs back to back, nine trials per cell per run. The reference ran from 08:30
to 08:44 UTC, and the change from 09:08 to 09:21 UTC. At each start no Roblox
process was running, and the CPU load, averaged over fifteen one-second
samples of `Get-Counter`, was 5.9% and 5.7%.

**Reading.** The change stays if the encode of the rows that slowed is
faster, with both runs of the change above both runs of the reference, and
no row is slower with both runs of the change below both runs of the
reference.

**Controls.** The fbs, serio, flamework2, Blink and hand-written columns,
whose code did not change, and every row's decode. `D` is the median ratio
of the row's quiet control cells, with their number, and the adjusted ratio
is the ratio over `D`.

## Results

surge's encode, against the reference. A cell marked † is noisy in one of
the two runs.

| Row                                 | Reference    | Change         | Ratio  | `D`       | Adjusted | Runs, reference | Runs, change   |
| ----------------------------------- | ------------ | -------------- | ------ | --------- | -------- | --------------- | -------------- |
| small flat struct                   | 5.88M ±3.8%  | 5.78M ±4.9%    | 0.984  | 0.998 (5) | 0.986    | 5.80M, 5.96M    | 5.79M, 5.77M   |
| deeply nested object                | 4.48M ±3.7%  | 4.63M ±2.3%    | 1.034  | 1.015 (5) | 1.019    | 4.43M, 4.58M    | 4.56M, 4.67M   |
| wide struct                         | 3.10M ±1.8%  | 3.09M ±2.4%    | 0.998  | 1.002 (4) | 0.996    | 3.06M, 3.10M    | 3.09M, 3.10M   |
| large array                         | 298.4k ±3.7% | 330.1k ±1.2%   | 1.106  | 1.061 (4) | 1.042    | 297.3k, 302.9k  | 329.8k, 330.6k |
| nested arrays                       | 849.4k ±2.6% | 918.9k ±2.3%   | 1.082  | 1.001 (5) | 1.081    | 845.8k, 854.9k  | 928.4k, 913.6k |
| tuples                              | 1.42M ±2.8%  | 1.45M ±2.1%    | 1.022  | 1.020 (4) | 1.002    | 1.40M, 1.44M    | 1.43M, 1.46M   |
| large record                        | 157.9k ±2.5% | 163.7k ±1.0%   | 1.037  | 1.005 (4) | 1.031    | 155.2k, 159.2k  | 164.7k, 163.3k |
| string-heavy                        | 283.8k ±5.2% | 303.2k ±2.0%   | 1.069  | 1.012 (3) | 1.056    | 279.8k, 294.5k  | 304.2k, 303.0k |
| leaderboard                         | 446.0k ±4.2% | 493.6k ±2.2%   | 1.107  | 1.009 (5) | 1.097    | 440.4k, 459.2k  | 496.2k, 488.3k |
| enum-heavy                          | 319.7k ±2.4% | 324.2k ±2.1%   | 1.014  | 1.005 (3) | 1.009    | 315.2k, 322.7k  | 325.5k, 318.8k |
| tagged union                        | 352.9k ±2.2% | 364.0k ±4.4%   | 1.031  | 1.006 (5) | 1.025    | 355.8k, 349.6k  | 357.1k, 373.1k |
| guarded union                       | 607.3k ±2.1% | 639.2k ±3.5%   | 1.053  | 1.001 (3) | 1.051    | 604.0k, 616.8k  | 642.5k, 621.0k |
| tree                                | 443.5k ±2.3% | 471.8k ±2.8%   | 1.064  | 0.997 (2) | 1.068    | 439.4k, 449.8k  | 468.1k, 481.4k |
| instance references                 | 977.7k ±4.4% | 1.03M ±4.9%    | 1.052  | 1.027 (4) | 1.024    | 969.7k, 1.01M   | 1.05M, 995.4k  |
| toggles (unpacked)                  | 4.44M ±2.9%  | 4.50M ±1.4%    | 1.014  | 1.014 (4) | 1.000    | 4.38M, 4.50M    | 4.51M, 4.50M   |
| toggles (packed)                    | 4.63M ±1.1%  | 4.71M ±2.1%    | 1.016  | 1.013 (3) | 1.002    | 4.63M, 4.64M    | 4.71M, 4.69M   |
| CFrame array                        | 274.0k ±2.2% | 273.0k ±0.7%   | 0.996  | 1.012 (5) | 0.985    | 271.0k, 275.5k  | 274.3k, 272.9k |
| CFrame array (packed, axis-aligned) | 187.1k ±3.0% | 189.9k ±1.9%   | 1.015  | 1.007 (2) | 1.008    | 184.4k, 190.0k  | 189.3k, 192.7k |
| CFrame array (packed, arbitrary)    | 146.1k ±1.7% | 150.0k ±1.0%   | 1.027  | 1.006 (2) | 1.021    | 145.0k, 147.1k  | 149.4k, 150.6k |
| Blink: Booleans                     | 208.5k ±2.5% | 196.1k ±13.6%† | 0.940† | 1.025 (2) | 0.917    | 206.3k, 211.6k  | 182.7k, 209.3k |
| Blink: Entities                     | 554.7k ±1.6% | 549.2k ±0.6%   | 0.990  | 1.001 (4) | 0.989    | 550.7k, 559.4k  | 551.0k, 548.5k |

Of the six rows that slowed, the leaderboard, the guarded union, the tree,
the string-heavy row and the arbitrary packed `CFrame` array have both runs
of the change above both runs of the reference; the deeply nested object has
one run of the change above both runs of the reference and one between them.
The nested arrays, the large array and the large record, which did not slow,
moved up in both runs as well. No row has both runs below both runs of the
reference but the small flat struct, by 0.2% at the closer pair, whose code
did not change. `Blink: Booleans` is noisy in the change.

The quiet control cells moved 1.008× on encode, quartiles [1.000, 1.018] over
78, and 1.001× on decode, quartiles [0.992, 1.008] over 81. surge's decode,
whose code did not change, moved between 0.948× and 1.046× by row: the
leaderboard's and the tagged union's both runs were below both runs of the
reference, at 0.948× and 0.963×.

The hand-written codec's throughput over surge's in the change's run, on its
ten rows:

| Row                  | Encode | Decode |
| -------------------- | ------ | ------ |
| small flat struct    | 1.038  | 0.996  |
| deeply nested object | 1.021  | 1.003  |
| nested arrays        | 0.949  | 1.012  |
| tuples               | 1.001  | 0.973  |
| leaderboard          | 1.015  | 0.994  |
| tagged union         | 1.002  | 1.000  |
| tree                 | 0.972  | 1.042  |
| instance references  | 0.947  | 1.026  |
| toggles (packed)     | 1.030  | 1.005  |
| CFrame array         | 1.008  | 1.055  |

Against the run before the variable-length count, recorded at `14137cb`
([variable-length-counts.md](variable-length-counts.md)), surge's encode in
this run is 0.987× to 1.065× adjusted by row: faster on the nested arrays,
1.065×, the large record, 1.056×, and the large array, 1.050×, with both
runs above, and between 0.987× and 1.033× elsewhere. Its decode is 0.956× to
1.030×, the lowest the leaderboard's and the string-heavy row's, whose code
did not change between the two later runs.

## Discussion

- The rows that slowed recovered by about what they had lost, and the rows
  with the most counts a call, the nested arrays and the large record, moved
  past the reference of the `u32` count. The run does not separate the size
  loop's local from the single comparison: the tree has no size loop and
  recovered, and the leaderboard has both.
- The decode's code is the same in the two builds, so its 0.948× on the
  leaderboard and 0.963× on the tagged union are a measure of the run, not of
  the change. Against the run before the variable-length count, the
  leaderboard's decode was 0.993× adjusted in the reference of this paper and
  0.956× in this run, on the same code.
- A union in a loop's body is now an if chain where a variant holds a string.
  The tagged union and the guarded union, which are, did not slow.
- The figures are from one machine and one Roblox version, with `--!native`
  and `--!optimize 2` on the generated modules and the hand-written codec.

## Conclusion

Reading a count's length once in a size loop and comparing a count once in
its write is worth 1.019× to 1.097× on the encode of the rows a
variable-length count had slowed, leaves the hand-written codec within 1.04×
of surge's encode on each of its ten rows, and leaves no row's encode slower
than with a `u32` count.

## Data

- The reference: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at `8b1ac9b`, recorded at
  `4885713`.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed with this paper, recorded at
  `89c2a85`.
- The run before the variable-length count: the same two files as committed
  at `ca5e2ba`, recorded at `14137cb`.
- The figures above were computed from the `.tsv` files, with the recorder's
  own median, spread and noise rule.
