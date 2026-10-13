# A string's reservation joined with the fixed-size bytes beside it

2026-10-13 · surge `88fe442` and `5c4da9a` · Lune 0.10.5 · Roblox
0.742.0.7421053

## Abstract

A `str` or a `buffer` with a count, and the run of fixed-size bytes next to
it, were two reservations, each moving the cursor and, on the scratch path,
checking the capacity. Joined into one, with the run reserved again on its
own beside the count's long form, they take 15 bytes off the tagged union's
module and add 13 to each of three others. In two pairs of scoped runs,
surge's own column on the three rows sized exactly moved within how far
unchanged code moved, but for one decode cell read through a reference
whose runs were 9% apart, and measured 1.003× and 1.021× on the large record's encode. The
leaderboard's cursor codec, which checks the capacity at each reservation,
measured 1.061× and 1.040× on encode, both runs above both of the reference
in each pair. No byte changed, the reading stated before the runs passed,
and the change is kept.

## Background

The change is in `5c4da9a` (Transformer 5.19 in
[specs/transformer.md](../specs/transformer.md)). A `str` or a `buffer` with
a count reserves its count and its bytes at once (5.19), and a run of
fixed-size properties of one object reserves its bytes at once (5.5). A
string next to a run was two reservations. At `88fe442`, each entry of the
leaderboard, a name, then a `u32` and an `f64`, was written as:

```luau
local s8 = item7.name
local len9 = #s8
if len9 < 254 then
	local pos10 = __surge_cursor
	__surge_cursor = pos10 + (len9 + 1)
	buffer.writeu8(__surge_scratch, pos10, len9)
	buffer.writestring(__surge_scratch, pos10 + 1, s8)
else
	__surge_cursor = __surge_writeLongString(__surge_scratch, __surge_cursor, s8, len9)
end
local pos11 = __surge_cursor
__surge_cursor = pos11 + 12
buffer.writeu32(__surge_scratch, pos11, item7.score)
local pos12 = pos11 + 4
buffer.writef64(__surge_scratch, pos12, item7.userId)
```

At `5c4da9a`, the count's one-byte form reserves the run with the string,
the long form reserves it on its own after its call, and the run starts 12
bytes before the cursor in either form:

```luau
if len9 < 254 then
	local pos10 = __surge_cursor
	__surge_cursor = pos10 + (len9 + 13)
	buffer.writeu8(__surge_scratch, pos10, len9)
	buffer.writestring(__surge_scratch, pos10 + 1, s8)
else
	__surge_cursor = __surge_writeLongString(__surge_scratch, __surge_cursor, s8, len9)
	local pos11 = __surge_cursor
	__surge_cursor = pos11 + 12
end
local pos12 = __surge_cursor - 12
buffer.writeu32(__surge_scratch, pos12, item7.score)
```

The read moves its cursor once, past the string and the run:

```luau
-- 88fe442
__surge_readCursor = at19 + len18
local pos20 = __surge_readCursor
__surge_readCursor = pos20 + 12
-- 5c4da9a
local pos18 = at21 + len20
__surge_readCursor = pos18 + 12
```

A run before the string, such as the tagged union's `chat` variant, its index
and `id`, then its `text`, is reserved from one position taken ahead of
both, and written after the string:

```luau
local s19 = item8.text
local len20 = #s19
local pos21 = __surge_cursor
if len20 < 254 then
	__surge_cursor = pos21 + (len20 + 6)
	buffer.writeu8(__surge_scratch, pos21 + 5, len20)
	buffer.writestring(__surge_scratch, pos21 + 6, s19)
else
	__surge_cursor = pos21 + 5
	__surge_cursor = __surge_writeLongString(__surge_scratch, __surge_cursor, s19, len20)
end
buffer.writeu8(__surge_scratch, pos21, 0)
local pos22 = pos21 + 1
buffer.writeu32(__surge_scratch, pos22, item8.id)
```

The same applies to a `dict`'s string key and its fixed-size value: the large
record's entries, a string key and a `u8`, which keep the scratch buffer and
check the capacity once where they checked it twice. Of the catalog, four
modules change: the leaderboard, the tagged union, the large record, and the
deeply nested object, whose `Leaf` is a name and an `f32`. Their cursor
codecs and their `readChecks` codecs change the same way. A cursor codec's
`write` keeps the scratch path, with a capacity check at each reservation,
whether or not its shape could be sized exactly (Transformer 5.3). Every
join in the catalog but the nested object's is inside a loop's body.

## Method

**Builds.** The reference is `88fe442`, the change of
[write-state-in-locals.md](write-state-in-locals.md), and the change
`5c4da9a`. Only the transformer differs.

**Runs.** Scoped runs (Benchmark harness 9 in
[specs/benchmark-harness.md](../specs/benchmark-harness.md)):
`mise run bench:speed:only leaderboard largerecord taggedunion nested`, both
halves, each invocation two Studio runs back to back, nine trials per cell
per run. `nested` also selects the nested arrays, whose surge code is the
same in both builds. Four invocations alternated between the builds, each on
a clean checkout of its commit. At each start no Roblox process was running,
and the CPU load, averaged over fifteen one-second samples of `Get-Counter`,
was the figure below. After each, the generated leaderboard module was
checked for its build's form.

| Pair | Build     | UTC           | Load  |
| ---- | --------- | ------------- | ----- |
| 1    | reference | 04:44 – 04:49 | 8.2%  |
| 1    | change    | 04:49 – 04:55 | 12.7% |
| 2    | reference | 04:55 – 05:01 | 10.4% |
| 2    | change    | 05:01 – 05:06 | 8.7%  |

**Code size.** `mise run bench:code` at each commit
([benchmarks/code-size.md](../benchmarks/code-size.md)), and
`mise run bench:size` at the change, against
[benchmarks/size.md](../benchmarks/size.md).

**Controls.** The fbs, serio, flamework2, Blink and hand-written columns.
`D` is the median ratio of the row's quiet control cells, and the adjusted
ratio is the ratio over `D`. The changed cells are surge's, surge
(cursor)'s and surge (readChecks)'s on the four rows. The nested arrays'
surge cells are a second measure of unchanged code.

**Reading.** Written before any run's result. The change makes three of the
four modules it touches larger, so it stays only if, in each pair, no changed
cell has an adjusted ratio below the lowest of how far unchanged code moved
in its half, and at least one has one above the highest of it, each read as
in [write-state-in-locals.md](write-state-in-locals.md). Otherwise it is
reverted. A changed cell whose two runs of the change are both below, or
both above, both runs of the reference is reported.

## Results

Bytecode of each surge module that changed, in bytes:

| Module           | Reference | Change | Change, bytes |
| ---------------- | --------- | ------ | ------------- |
| large-record     | 2,014     | 2,027  | +13           |
| leaderboard      | 2,050     | 2,063  | +13           |
| nested-object    | 2,316     | 2,329  | +13           |
| tagged-union     | 3,501     | 3,486  | −15           |
| total, every row | 60,880    | 60,904 | +24           |

The long form's own reservation of the run is the code the join adds. The
tagged union's run is before its string, where the long form reserves the
run with one move of the cursor from the position the join takes.
[benchmarks/size.md](../benchmarks/size.md) is unchanged. In
every run, each cell's round trip in Roblox was within what the size table
records for it (Benchmark harness 6.6 in
[specs/benchmark-harness.md](../specs/benchmark-harness.md)).

The changed cells, adjusted, as pair 1 / pair 2:

| Row                  | Half   | surge             | surge (cursor)    | surge (readChecks) |
| -------------------- | ------ | ----------------- | ----------------- | ------------------ |
| leaderboard          | encode | 0.998 / 1.001     | 1.061 ↑ / 1.040 ↑ |                    |
| large record         | encode | 1.003 / 1.021 ↑   | 1.024 / 1.001     |                    |
| tagged union         | encode | 0.998 ↓ / 1.018 ↑ | 1.022 / 0.981     |                    |
| deeply nested object | encode | 0.990 / 0.993     | 1.008 / 1.008     |                    |
| leaderboard          | decode | 0.988 / 1.067     | 1.012 / 1.012 ↑   | 1.005 / 1.000      |
| large record         | decode | 0.999 / 1.003     | 0.995 / 0.989 ↓   | 1.003 / 0.975      |
| tagged union         | decode | 0.996 † / 1.020 † | 0.980 / 0.994     | 0.993 / 1.001      |
| deeply nested object | decode | 1.007 / 0.982 ↓   | 0.998 / 1.005     | 1.033 ↑ / 1.003 ↑  |

↑ marks a cell whose two runs of the change are both above both runs of the
reference, ↓ one whose runs are both below, and † a cell marked noisy in a
run of the pair.

How far unchanged code moved, and the quiet control cells:

| Pair | Half   | Lowest | Highest | Quiet controls | Quartiles      | Cells |
| ---- | ------ | ------ | ------- | -------------- | -------------- | ----- |
| 1    | encode | 0.960  | 1.040   | 1.005×         | [0.992, 1.009] | 24    |
| 1    | decode | 0.980  | 1.013   | 1.005×         | [1.001, 1.009] | 23    |
| 2    | encode | 0.955  | 1.019   | 0.998×         | [0.993, 1.001] | 24    |
| 2    | decode | 0.971  | 1.027   | 0.997×         | [0.984, 1.006] | 23    |

The nested arrays' surge cells moved between 0.980 and 1.027 in pair 1, and
between 0.990 and 1.005 in pair 2. The leaderboard's cursor encode ran
762.2k and 763.7k values a second, then 843.9k and 812.0k, in pair 1, and
782.5k and 780.8k, then 814.8k and 808.7k, in pair 2.

## Discussion

- Each pair passed the reading through the same cell, the leaderboard's
  cursor encode, the one cell above the highest of unchanged code in both.
  The large record's surge encode was above it in pair 2 alone, and the
  nested object's `readChecks` decode in pair 1 alone.
- The lowest changed cell of pair 1, the tagged union's cursor decode at
  0.98025, was above the lowest of unchanged code, 0.97969, by less than the
  third decimal shows.
- On the three rows sized exactly, the join saves one move of the cursor per
  element in surge's own column, and that column moved within how far
  unchanged code moved there, but for the leaderboard's decode in pair 2,
  below. The cursor codec writes the same shapes through
  the scratch path, so there the join also saves a capacity check per
  element, which is where the leaderboard gained. The large record keeps
  the scratch buffer in surge's column too; its encode was above the highest
  of unchanged code in pair 2 alone.
- The leaderboard's surge decode measured 1.067 in pair 2 through a
  reference whose runs were 145.5k and 159.0k, and 0.988 in pair 1; it is not
  a measure of the change.
- Every join but the nested object's is inside a loop's body, where the fold
  of Transformer 5.30 is not applied. What the join does to a loop's body
  measured as no slower than unchanged code here, where folding the cursor in
  loop bodies had measured slower
  ([cursor-known-values.md](cursor-known-values.md)).
- The figures are from one machine and one Roblox version, with `--!native`
  and `--!optimize 2` on the generated modules.

## Conclusion

Joining a string's reservation with the fixed-size bytes beside it adds 24
bytes to the benchmark's surge modules, takes a capacity check per element
off a cursor codec's write, where it measured 1.061× and 1.040× on the
leaderboard's encode, and moves surge's own column on the rows sized exactly
within how far unchanged code moves, but for one cell read through a
reference whose runs were 9% apart. It passed the reading stated before
the runs, and is kept.

## Data

- The four scoped runs, each a `speed.md` and the trials behind it, under
  [data/joined-reservations/](data/joined-reservations/): `reference-1/`,
  `change-1/`, `reference-2/` and `change-2/`.
- The bytecode: `docs/benchmarks/code-size.md` as committed at `88fe442` and
  at `5c4da9a`.
- The figures above were computed from the `.tsv` files, with the recorder's
  own median, spread and noise rule.
