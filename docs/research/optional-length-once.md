# An optional string's value and length read once

2026-10-10 · surge `db9b531` and `0615ba4` · Lune 0.10.5 · Roblox
0.742.0.7421053

## Abstract

The size of a `serialize` written exactly read an optional `str`'s value and
its length three times each, in one expression, and the write read both
again. Bound once ahead of the result, as a `str`'s that is not optional
are, they take 40 bytes off each of the two modules that hold one, 80 of the
46,320 bytes of the benchmark's surge modules. The packed toggles' encode
measured 1.041× adjusted, with both runs above both runs of the reference;
the unpacked toggles', 1.171×, through a reference cell marked noisy. No
byte changed. The change is kept.

## Background

The change is in `0615ba4` (Transformer 5.20 in
[specs/transformer.md](../specs/transformer.md)). At `db9b531`, the size of
the unpacked toggles, whose `label` is an optional string, was:

```luau
local __surge_scratch = buffer.create((if value.label ~= nil then (if #value.label < 254 then 1 elseif #value.label <= 65535 then 3 else 5) + #value.label else 0) + (if value.offset ~= nil then 2 else 0) + 13)
```

and the write bound the value, and then its string and length, again:

```luau
local opt11 = value.label
-- ...
if opt11 ~= nil then
	local s13 = opt11
	local len14 = #s13
```

The size reads inside the optional's branch, where it binds nothing
(Transformer 5.20), so it read the value's path and its length for each term.
At `0615ba4`, the size binds the value, and its length or 0 where it is
absent, ahead of the result:

```luau
local opt1 = value.label
local len2 = if opt1 ~= nil then #opt1 else 0
local __surge_scratch = buffer.create((if opt1 ~= nil then (if len2 < 254 then 1 elseif len2 <= 65535 then 3 else 5) + len2 else 0) + (if value.offset ~= nil then 2 else 0) + 13)
```

and the write tests `opt1` and writes `len2`, binding neither. It applies to
an optional `str` or `buffer` with a variable-length count, whether its
presence is a flag byte or a bit of a packed region, outside a loop or a
branch. Of the catalog, the packed and the unpacked toggles have one.

## Method

**Builds.** The reference is `db9b531`, and the change `0615ba4`. Only the
two toggles modules differ, and of those only the write: their reads differ
in the names of locals, which the bytecode at debug level 1 does not hold.

**Runs.** Each is one full invocation of `mise run bench:speed`: two Studio
runs back to back, nine trials per cell per run. The reference ran from
10:29 to 10:43 UTC, and the change from 10:44 to 10:58 UTC. At each start no
Roblox process was running, and the CPU load, averaged over fifteen
one-second samples of `Get-Counter`, was 11.6% and 12.2%.

**Code size.** `mise run bench:code` at each commit
([benchmarks/code-size.md](../benchmarks/code-size.md)), and
`mise run bench:size` at the change, against
[benchmarks/size.md](../benchmarks/size.md).

**Controls.** The fbs, serio, flamework2, Blink and hand-written columns.
`D` is the median ratio of the row's quiet control cells, the hand-written
cell included, and the adjusted ratio is the ratio over `D`. Every surge cell
but the two toggles encodes runs the same code in both builds, and is
reported as a second measure of unchanged code.

**Reading.** Written before any run's result: the change stays if the code
is smaller and neither toggles encode cell's adjusted ratio is below the
lowest of how far unchanged code moved, which is each quiet control cell's
ratio over the median ratio of the other quiet control cells of its row, as
in [cursor-known-values.md](cursor-known-values.md). A toggles encode cell
whose two runs of the change are both below both runs of the reference is
reported.

## Results

| Module                   | Reference | Change | Change, bytes |
| ------------------------ | --------- | ------ | ------------- |
| packed-struct (packed)   | 2,925     | 2,885  | −40           |
| packed-struct (unpacked) | 3,403     | 3,363  | −40           |
| total, every module      | 46,320    | 46,240 | −80           |

[benchmarks/size.md](../benchmarks/size.md) is unchanged. In both runs of
both builds, every cell's round trip in Roblox was within what the size
table records for it (Benchmark harness 6.6 in
[specs/benchmark-harness.md](../specs/benchmark-harness.md)).

| Cell                    | Adjusted | Reference | Change | Runs of the reference | Runs of the change |
| ----------------------- | -------- | --------- | ------ | --------------------- | ------------------ |
| packed toggles encode   | 1.041    | 4.19M     | 4.41M  | 4.24M, 4.11M          | 4.43M, 4.40M       |
| unpacked toggles encode | 1.171    | 3.60M†    | 4.19M  | 4.03M, 3.28M          | 4.22M, 4.16M       |
| packed toggles decode   | 0.997    | 3.09M     | 3.07M  | 3.10M, 3.06M          | 3.10M, 3.06M       |
| unpacked toggles decode | 0.998    | 2.80M     | 2.80M  | 2.81M, 2.79M          | 2.81M, 2.79M       |

A cell marked † moved by more than 10% between its runs. The quiet control
cells moved 1.002× on encode, quartiles [0.994, 1.015] over 78, and 1.000×
on decode, [0.991, 1.010] over 81; unchanged code moved no lower than 0.972
on encode and 0.947 on decode. Surge's quiet cells whose code did not
change moved between 0.978 and 1.034 on encode, and between 0.968 and 1.047
on decode.

## Discussion

- The packed toggles' encode is above every surge encode whose code did not
  change, by a little, with both runs above both of the reference's. The
  unpacked toggles' reference moved 21% between its runs, 4.03M and 3.28M,
  so its 1.171× is not a measure of the change; against the reference's
  first run alone, the change's 4.19M is 1.04×.
- The size reads the value's path once where it read it three times, and
  the length once where it read it three times; the write reads neither
  again. Both rows write the 7-byte `label` `"toggles"`, so the count's long
  form is not reached.
- The reads are the same code in both builds, and moved 0.997× and 0.998×.
- The figures are from one machine and one Roblox version, with `--!native`
  and `--!optimize 2` on the generated modules.

## Conclusion

Binding an optional string's value and length ahead of the result takes 40
bytes off each module that holds one, and measured 1.041× on the packed
toggles' encode, with no cell slower than unchanged code moves.

## Data

- The reference:
  [data/optional-length-once-reference.md](data/optional-length-once-reference.md)
  and
  [data/optional-length-once-reference.tsv](data/optional-length-once-reference.tsv),
  recorded at `db9b531`.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed with this paper, recorded
  at `0615ba4`.
- The bytecode: `docs/benchmarks/code-size.md` as committed at `c9a8a6a` and
  with this paper.
- The figures above were computed from the `.tsv` files, with the recorder's
  own median, spread and noise rule.
