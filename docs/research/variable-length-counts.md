# A variable-length count by default

2026-10-09 · surge `ca5e2ba` and `4885713` · Lune 0.10.5 · Roblox
0.742.0.7421053

## Abstract

surge wrote every unbranded count as a `u32`, where the experimental
Flamework 2 writes a varint, and Flamework 2's bytes were smaller on 13 of
the 18 rows both express ([flamework2-column.md](flamework2-column.md)).
This measures surge with a variable-length count as the default: one byte
below 254, the byte 254 and a `u16` up to 65535, and the byte 255 and a
`u32` above (Wire format 6.9 in [specs/wire-format.md](../specs/wire-format.md)).
Against Flamework 2, surge's bytes are now
equal on 11 of those rows, smaller on 5, and one byte larger on 2. No decode
moved by more than the noise, and encode slowed by 2.7% to 6.0% on six rows,
where the generated code reads a string's length or compares a count twice.

## Background

Before this change, a string, a buffer, an array, a tuple's rest and a
dictionary wrote a four-byte count unless `DataType.Length<T, L>` gave it a
narrower width. Flamework 2 writes a LEB128 varint: one byte below 128, two
below 16384. Blink and Zap default to a `u16`. A default changes the bytes
of every game that serializes a container, so it can change cheaply only
before the first release, which has not been made.

The form was chosen over LEB128 because its read of a short count is one
`readu8` and one comparison with no loop, and its long forms are surge's
existing `u16` and `u32` widths. It holds one byte up to 253 where LEB128
holds one up to 127, and takes three bytes from 254 to 16383 where LEB128
takes two.

The generated code writes and reads the one-byte form inline, and calls the
package's `writeLongCount` and `readLongCount` for a long form (Transformer
5.28 in [specs/transformer.md](../specs/transformer.md)). A string's write,
for one:

```luau
local head3 = (if len2 < 254 then 1 elseif len2 <= 65535 then 3 else 5)
local pos4 = __surge_cursor
__surge_cursor = pos4 + (len2 + head3)
if len2 < 254 then
	buffer.writeu8(__surge_scratch, pos4, len2)
else
	__surge_writeLongCount(__surge_scratch, pos4, len2)
end
buffer.writestring(__surge_scratch, pos4 + head3, s1)
```

A size computed ahead of the result adds the same conditional for each
count (Transformer 5.20). A dictionary, whose count is reserved before its
entries are counted, reserves one byte, and moves its entries along to make
room where the count needs a long form (Transformer 5.6). The hand-written
codec writes surge's bytes (Benchmark harness 4.5 in
[specs/benchmark-harness.md](../specs/benchmark-harness.md)), so it changed
in the same commit, with the one-byte form inline and the long forms through
two local functions.

## Method

**Builds.** The reference is `ca5e2ba`, whose tables were recorded at
`14137cb` ([baseline-cframe-read.md](baseline-cframe-read.md)). The change
is `4885713`. The two differ in the count of every container in surge's
generated code and in the hand-written codec.

**Bytes and bytecode.** `mise run bench:size` and `mise run bench:code` ran
under Lune 0.10.5 at each commit. Both are deterministic.

**Runs.** Each speed run is one full invocation of `mise run bench:speed`:
two Studio runs back to back, nine trials per cell per run. The reference
ran from 07:21 to 07:35 UTC, and the change from 08:30
to 08:44 UTC. At each
start no Roblox process was running, and the CPU load, averaged over fifteen
one-second samples of `Get-Counter`, was 12.7% and 5.9%.

**Reading.** The default is a decision made before the run, so no speed
result reverses it here. Each row's surge cell is read against the
reference, and a row that slowed is reported as such.

**Controls.** The fbs, serio, flamework2 and Blink columns, whose code did
not change. The hand-written codec changed with surge, so it is not a
control. Every surge row whose shape holds a count changed, which is all but
the small flat struct and the wide struct. `D` is the median ratio of the
row's quiet control cells, with their number, and the adjusted ratio is the
ratio over `D`.

## Results

### Bytes

From [benchmarks/size.md](../benchmarks/size.md) at each commit. Every row
that writes a count lost three bytes for each count below 254, and the large
array and `Blink: Booleans`, whose 1,000 elements take the `u16` form, lost
one. The small flat struct and the wide struct write no count. Every cell
round-trips as it did.

| Row                                 | surge, before | surge, after | Flamework 2 | Blink | Zap  |
| ----------------------------------- | ------------- | ------------ | ----------- | ----- | ---- |
| small flat struct                   | 17            | 17           | 17          | 17    | 17   |
| deeply nested object                | 24            | 18           | 18          | 20    | 20   |
| wide struct                         | 200           | 200          | 200         | 200   | 200  |
| large array                         | 2004          | 2003         | 2002        | 2002  | 2002 |
| nested arrays                       | 446           | 383          | 383         | 404   | 404  |
| tuples                              | 504           | 501          | 501         | —     | —    |
| large record                        | 2096          | 1493         | 1494        | 1694  | 1695 |
| string-heavy                        | 2390          | 2081         | 2081        | 2184  | 2184 |
| leaderboard                         | 1218          | 1065         | 1065        | 1116  | 1116 |
| enum-heavy                          | 106           | 103          | 205         | —     | —    |
| tagged union                        | 1274          | 1205         | 1205        | 1228  | 1228 |
| guarded union                       | 849           | 750          | 777         | —     | 783  |
| tree                                | 510           | 255          | 255         | —     | —    |
| instance references                 | 104           | 101          | 301         | —     | —    |
| toggles (unpacked)                  | 26            | 23           | 23          | 24    | —    |
| toggles (packed)                    | 16            | 13           | —           | —     | 14   |
| CFrame array                        | 1204          | 1201         | 2401        | 1202  | 1202 |
| CFrame array (packed, axis-aligned) | 654           | 651          | —           | —     | —    |
| CFrame array (packed, arbitrary)    | 1254          | 1251         | —           | —     | —    |
| Blink: Booleans                     | 1004          | 1003         | 1002        | 1002  | 1002 |
| Blink: Entities                     | 604           | 601          | 601         | 602   | 602  |

Against Flamework 2, surge's bytes are now equal on 11 of the 18 rows both
express, smaller on 5, and larger on 2, the large array and
`Blink: Booleans`, by one byte each. Against Blink and Zap, surge is larger
on the same two rows, by one byte, and equal or smaller on the rest.

### Bytecode

From [benchmarks/code-size.md](../benchmarks/code-size.md) at each commit.
The small flat struct's and the wide struct's modules did not change. Every
other module grew, by 242 to 937 bytes. Part of that is fixed per module: a
module that imported nothing from the package now imports `writeLongCount`
and `readLongCount`. The tree's and the packed `CFrame` array's modules,
which imported from it already, grew by 242 bytes each. The hand-written
codec's module grew from 13,258 to 23,366 bytes.

### Speed

surge's cells, against the reference. "Both runs" names the rows where both
runs of the change are below, or above, both runs of the reference. A cell
marked † is noisy in one of the two runs.

| Row                                 | Encode | `D`       | Adjusted | Both runs | Decode | `D`       | Adjusted | Both runs |
| ----------------------------------- | ------ | --------- | -------- | --------- | ------ | --------- | -------- | --------- |
| small flat struct                   | 1.006  | 0.994 (4) | 1.012    |           | 0.992  | 1.001 (4) | 0.991    |           |
| deeply nested object                | 0.972  | 0.998 (4) | 0.973    | below     | 1.001  | 0.999 (4) | 1.002    |           |
| wide struct                         | 1.011  | 1.005 (4) | 1.007    |           | 1.009  | 1.006 (4) | 1.003    |           |
| large array                         | 0.994  | 0.987 (4) | 1.007    |           | 1.016  | 1.003 (4) | 1.014    |           |
| nested arrays                       | 0.982  | 0.974 (4) | 1.008    | below     | 1.031  | 1.027 (4) | 1.004    | above     |
| tuples                              | 1.002  | 0.993 (3) | 1.009    |           | 1.022  | 1.005 (3) | 1.017    | above     |
| large record                        | 1.011  | 0.984 (4) | 1.028    |           | 0.994  | 1.008 (4) | 0.986    |           |
| string-heavy                        | 0.949  | 0.985 (3) | 0.964    | below     | 0.977  | 1.003 (4) | 0.974    | below     |
| leaderboard                         | 0.913  | 0.972 (3) | 0.940    | below     | 0.996  | 1.003 (4) | 0.993    | below     |
| enum-heavy                          | 1.008  | 1.000 (3) | 1.008    |           | 1.010  | 1.020 (3) | 0.990    |           |
| tagged union                        | 0.977† | 0.990 (4) | 0.987    |           | 1.031  | 1.007 (4) | 1.023    |           |
| guarded union                       | 0.958  | 1.009 (3) | 0.949    | below     | 0.981  | 1.005 (3) | 0.976    |           |
| tree                                | 0.951  | 0.987 (1) | 0.964    | below     | 1.003  | 1.005 (1) | 0.998    |           |
| instance references                 | 0.976  | 0.978 (3) | 0.998    |           | 0.999  | 0.987 (3) | 1.012    |           |
| toggles (unpacked)                  | 0.990  | 0.990 (4) | 1.000    |           | 0.995  | 1.000 (4) | 0.995    |           |
| toggles (packed)                    | 0.974  | 0.959 (1) | 1.015    | below     | 0.995  | 1.000 (2) | 0.995    |           |
| CFrame array                        | 0.996  | 0.982 (4) | 1.014    |           | 1.009  | 1.013 (4) | 0.996    |           |
| CFrame array (packed, axis-aligned) | 0.987  | 0.990 (2) | 0.997    |           | 1.027  | 1.003 (2) | 1.023    | above     |
| CFrame array (packed, arbitrary)    | 0.986  | 1.016 (2) | 0.970    | below     | 1.005  | 1.006 (2) | 0.999    |           |
| Blink: Booleans                     | 1.075† | 0.995 (3) | 1.081    |           | 0.998  | 1.010 (4) | 0.989    |           |
| Blink: Entities                     | 1.010  | 1.004 (4) | 1.006    |           | 1.010  | 0.996 (4) | 1.014    |           |

The quiet control cells moved 0.991× on encode, quartiles [0.977, 1.003]
over 67, and 1.004× on decode, quartiles [0.997, 1.011] over 71.

The hand-written codec's encode against surge's, its throughput over
surge's, on its ten rows:

| Row                  | Reference | Change |
| -------------------- | --------- | ------ |
| small flat struct    | 1.038     | 1.023  |
| deeply nested object | 0.992     | 1.034  |
| nested arrays        | 1.084     | 1.047  |
| tuples               | 0.986     | 1.012  |
| leaderboard          | 1.006     | 1.098  |
| tagged union         | 0.986     | 1.045  |
| tree                 | 0.964     | 1.055  |
| instance references  | 0.948     | 0.953  |
| toggles (packed)     | 1.013     | 1.032  |
| CFrame array         | 1.009     | 0.987  |

Its decode is within 1.04× of surge's in both runs on each of them but the
`CFrame` array, where it is 1.060× and 1.053× ahead, as it was
([baseline-cframe-read.md](baseline-cframe-read.md)).

## Discussion

- Decode did not slow on any row by more than the noise, and sped up on the
  nested arrays, the tuples and the axis-aligned packed `CFrame`s, whose
  count reads one byte where it read four.
- Encode slowed on the leaderboard, the guarded union, the tree, the
  string-heavy row, the arbitrary packed `CFrame` array and the deeply nested
  object, by 2.7% to 6.0% adjusted, with both runs of the change below both
  runs of the reference. The hand-written codec, which writes the same bytes,
  did not slow on the three of these rows it covers, so there the cost is in
  surge's code and not in the format.
- Two differences between the two are in the code, and neither was probed
  alone. A size computed by a loop reads a string's length twice for each
  element, once to compare it and once to add it, where it read it once, and
  the hand-written codec reads it into a local once. The leaderboard, the
  guarded union and the string-heavy row are sized by such a loop. And a
  write compares a count with 254 twice, once for the bytes it takes and once
  to choose the form, where the hand-written codec compares it once. The tree
  writes a count for each node, and the deeply nested object has two strings.
- The long forms are timed only on the large array and `Blink: Booleans`,
  whose 1,000 elements take the `u16` form; neither moved. No row times the
  `u32` form, or a `dict` whose count moves its entries along.
- `readChecks` is not timed, and adds one comparison to each long form's
  read.
- The figures are from one machine and one Roblox version, with `--!native`
  and `--!optimize 2` on the generated modules and the hand-written codec.

## Conclusion

A variable-length count makes surge's bytes equal to Flamework 2's or smaller
on 16 of the 18 rows both express, and larger by one byte on the two whose
count is 1,000. It changed no decode by more than the noise, and slowed
encode by 2.7% to 6.0% on six rows. On the three of them the hand-written
codec covers, it writes the same bytes and did not slow, and the generated
code reads a length or compares a count twice where it does once.

## Data

- Bytes: `docs/benchmarks/size.md` as committed at `ca5e2ba` and at
  `4885713`.
- Bytecode: `docs/benchmarks/code-size.md` as committed at `ca5e2ba` and at
  `4885713`.
- The reference run: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at `ca5e2ba`, recorded at
  `14137cb`.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed with this paper, recorded
  at `4885713`.
- The figures above were computed from the two `.tsv` files, with the
  recorder's own median, spread and noise rule.
