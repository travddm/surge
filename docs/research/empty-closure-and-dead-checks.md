# An empty closure, capacity checks that cannot fire, and a fixed-size optional read once

2026-10-11 · surge `3f90aff` and `7532ee9` · Lune 0.10.5 · Roblox
0.742.0.7421053

## Abstract

Three changes to the generated code, measured together, take 904 of the
46,240 bytes of the benchmark's surge modules, 2.0%. A call site whose
closure would declare nothing is replaced by its functions alone, which
takes 36 to 57 bytes off each of 15 modules. In a `serialize` that keeps the
scratch buffer, a reservation known to end within the 64 bytes the buffer is
created with checks no capacity, which takes 55 and 56 bytes off the two
modules that had such a check. An optional whose value has a fixed size is
read once, ahead of the result, which takes another 30 and 10 bytes off the
two toggles modules. No byte of any value changed. Every cell of a changed
module was within how far unchanged code moved, and the changes are kept.

## Background

The changes are in `7532ee9` (Transformer 5.1, 5.20 and 5.30 in
[specs/transformer.md](../specs/transformer.md)).

**The closure.** The transformer replaces a factory's call with a function
it calls at once. That closure declares what 5.2, 5.3, 5.9 and 5.29 place in
it: a scratch buffer, a recursion helper and its state, the blob channel's
state, and an enum's tables. It then returns the functions. At `3f90aff`, a
shape that needs none of them still had it:

```luau
local serializer = (function()
	return {
		serialize = function(value)
```

At `7532ee9`, the call site is the table alone:

```luau
local serializer = {
	serialize = function(value)
```

The functions are the same, and each is created once, as the module loads,
either way. 15 of the 20 modules lose the closure. The enum row's, the
string-heavy row's, the large record's, the packed `CFrame` array's and the
tree's keep it.

**The capacity check.** A `serialize` that keeps the scratch buffer checks
the capacity after each reservation (Transformer 5.4). Where the fold knows
the cursor as a number (5.30), the check compares a number. The scratch
buffer is created at 64 bytes, and `grow` only enlarges it, so a check
against a number of at most 64 cannot fire. The large record had one, ahead
of its dictionary:

```luau
__surge_cursor = 1
local dict1 = value.entries
if 1 > __surge_capacity then
	__surge_scratch, __surge_capacity = __surge_grow(__surge_scratch, 0, 1)
end
```

The packed `CFrame` array had one on its count's one-byte form. At
`7532ee9`, the fold drops such a check, in `serialize` only: a cursor
codec's `write` checks against its caller's buffer, which may hold fewer
bytes.

**The optional.** [optional-length-once.md](optional-length-once.md) bound
an optional string's value and length ahead of the result. An optional of a
fixed size, the toggles' `offset?: DataType.i16`, still read its path in the
size, in the write, and, packed, in its presence bit. The packed `label`'s
presence bit read `value.label` although the size had bound it. At
`7532ee9`, the size binds the value, and the presence bit and the write read
that local. On the packed toggles:

```luau
local opt1 = value.label
local len2 = if opt1 ~= nil then #opt1 else 0
local opt3 = value.offset
-- ...
buffer.writeu8(__surge_scratch, 1, (if value.i then 1 else 0) + (if value.j then 2 else 0) + (if opt1 ~= nil then 4 else 0) + (if opt3 ~= nil then 8 else 0))
```

## Method

**Builds.** The reference is `3f90aff`, and the change `7532ee9`. Only the
transformer differs. The enum row's, the string-heavy row's and the tree's
modules are the same in both. The other 17 modules differ, which are 18 rows
of the catalog: both packed `CFrame` rows share one module.

**Runs.** Each is one full invocation of `mise run bench:speed`, on a clean
checkout of its commit: two Studio runs back to back, nine trials per cell
per run. The reference is the change's run of
[packed-cframe-quaternion.md](packed-cframe-quaternion.md), from 22:52 to
23:06 UTC, and the change ran from 23:07 to 23:21 UTC. At each start no
Roblox process was running, and the CPU load, averaged over fifteen
one-second samples of `Get-Counter`, was 4.6% and 4.5%.

**Code size.** `mise run bench:code` at each commit
([benchmarks/code-size.md](../benchmarks/code-size.md)), and
`mise run bench:size` at the change, against
[benchmarks/size.md](../benchmarks/size.md).

**Controls.** The fbs, serio, flamework2, Blink and hand-written columns.
`D` is the median ratio of the row's quiet control cells, and the adjusted
ratio is the ratio over `D`.

**Reading.** Written before any run's result: the changes stay if the code
is smaller and no surge cell whose module changed has an adjusted ratio
below the lowest of how far unchanged code moved in its half. That is each
quiet control cell's ratio over the median ratio of the other quiet control
cells of its row, as in [cursor-known-values.md](cursor-known-values.md). A
changed cell whose two runs of the change are both below both runs of the
reference is reported. If a cell fails, the three changes are split and each
is measured on its own.

**A pair set aside.** A first pair of these runs, on 2026-10-10, was set
aside because processes that should not have been running were. In it, the
Blink: Booleans encode measured 0.873 adjusted, below the lowest of 0.962
for unchanged code. That cell was marked noisy, and its module changed only
by its closure. Every other changed cell was above that line. In that set's
runs of `8a300ac` and `3f90aff`, which hold the same code for that row, the
cell ran 195k and 144k, then 140k and 197k.

## Results

| Module                   | Change            | Reference | Change, bytes | Row                                 | Encode  | Decode  |
| ------------------------ | ----------------- | --------- | ------------- | ----------------------------------- | ------- | ------- |
| small-flat-struct        | closure           | 958       | −36           | small flat struct                   | 1.002   | 0.993   |
| nested-object            | closure           | 2,367     | −51           | deeply nested object                | 1.011   | 0.996 ↓ |
| wide-struct              | closure           | 5,670     | −36           | wide struct                         | 1.008 ↑ | 0.996   |
| large-array              | closure           | 1,363     | −51           | large array                         | 1.017 ↑ | 1.012   |
| nested-arrays            | closure           | 1,831     | −51           | nested arrays                       | 0.963 ↓ | 1.014   |
| tuples                   | closure           | 1,637     | −51           | tuples                              | 0.993 ↓ | 1.016   |
| large-record             | capacity check    | 2,104     | −56           | large record                        | 0.992   | 0.991   |
| leaderboard              | closure           | 2,107     | −57           | leaderboard                         | 1.016 ↑ | 0.995   |
| tagged-union             | closure           | 3,558     | −57           | tagged union                        | 0.997   | 0.998   |
| guarded-union            | closure           | 2,398     | −57           | guarded union                       | 0.978 ↓ | 0.978   |
| instance-refs            | closure           | 1,820     | −51           | instance references                 | 1.006   | 0.990 ↓ |
| packed-struct (unpacked) | closure, optional | 3,363     | −61           | toggles (unpacked)                  | 0.992   | 1.003 ↓ |
| packed-struct (packed)   | closure, optional | 2,885     | −81           | toggles (packed)                    | 0.998   | 1.005 ↓ |
| cframes                  | closure           | 2,315     | −51           | CFrame array                        | 0.996   | 1.006   |
| cframes (packed)         | capacity check    | 1,569     | −55           | CFrame array (packed, axis-aligned) | 0.984 ↓ | 1.029 ↑ |
|                          |                   |           |               | CFrame array (packed, arbitrary)    | 0.983 ↓ | 1.002   |
| blink-benches (booleans) | closure           | 1,370     | −51           | Blink: Booleans                     | 1.076   | 1.044 † |
| blink-benches (entities) | closure           | 2,036     | −51           | Blink: Entities                     | 0.998   | 0.992   |
| total, every module      |                   | 46,240    | −904          |                                     |         |         |

The encode and decode columns are adjusted ratios. ↓ marks a cell whose two
runs of the change are both below both runs of the reference, ↑ one whose
runs are both above, and † a cell that moved by more than 10% between its
runs. [benchmarks/size.md](../benchmarks/size.md) is unchanged.

The quiet control cells moved 0.996× on encode, quartiles [0.990, 1.009]
over 80, and 0.995× on decode, [0.988, 1.007] over 79. Unchanged code moved
no lower than 0.942 on encode and 0.965 on decode. Surge's three rows whose
code did not change moved between 0.988 and 1.013 on encode, and between
0.992 and 1.037 on decode.

## Discussion

- Every changed cell is above how far unchanged code moved. The lowest are
  the nested arrays' encode, 0.963 against 0.942, and the guarded union's
  decode, 0.978 against 0.965.
- Nine changed cells have both runs of the change below both runs of the
  reference. Five of them are on rows where the closure is the only change,
  and it changes no instruction of `serialize` or `deserialize`. Unchanged
  code does this on this machine: between the reference and the change of
  [packed-cframe-quaternion.md](packed-cframe-quaternion.md), fourteen surge
  cells that ran the same code in both did, eleven of them on decode.
- The Blink: Booleans cell that the set-aside pair read at 0.873 measured
  1.076 on encode here. Between the reference and the change of
  [packed-cframe-quaternion.md](packed-cframe-quaternion.md), with the same
  code, it moved 0.917.
- The capacity check removes one compare for each value, and the optional
  one to three table reads. The encodes of the rows they touch moved between
  0.983 and 0.998. What so few instructions cost is below what this measures.
- The figures are from one machine and one Roblox version, with `--!native`
  and `--!optimize 2` on the generated modules.

## Conclusion

Dropping a closure that declares nothing, capacity checks that cannot fire,
and the repeated reads of a fixed-size optional takes 904 bytes, 2.0%, off
the benchmark's surge modules, with no cell slower than unchanged code
moves. The changes are kept.

## Data

- The reference:
  [data/empty-closure-and-dead-checks-reference.md](data/empty-closure-and-dead-checks-reference.md)
  and
  [data/empty-closure-and-dead-checks-reference.tsv](data/empty-closure-and-dead-checks-reference.tsv),
  recorded at `3f90aff`, the same run as the change of
  [packed-cframe-quaternion.md](packed-cframe-quaternion.md).
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed with this paper, recorded
  at `7532ee9`.
- The bytecode: `docs/benchmarks/code-size.md` as committed at `8a300ac` and
  with this paper.
- The figures above were computed from the `.tsv` files, with the recorder's
  own median, spread and noise rule.
