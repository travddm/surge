# A scratch-path serialize's write state in locals

2026-10-13 · surge `5745202` and `88fe442` · Lune 0.10.5 · Roblox
0.742.0.7421053

## Abstract

A `serialize` that is not sized exactly kept its scratch buffer, capacity
and write cursor in the closure it is generated into, so each reservation
loaded and stored them as upvalues. Held in locals of `serialize`, copied from
the closure on entry and stored back before the return, they take 174 bytes
off the six modules that keep the scratch buffer. Against the reference, in
two pairs of scoped runs, the encode measured 1.544× and 1.556× adjusted on
the set, 1.618× and 1.664× on the tuples with a rest, 1.069× and 1.109× on
the sequences, and 1.079× and 1.085× on the large record. No byte of any
value changed, no changed cell was below how far unchanged code moved, and
the change is kept.

## Background

The change is in `88fe442` (Transformer 5.3 in
[specs/transformer.md](../specs/transformer.md)). A `serialize` that is not
sized exactly (Transformer 5.20) writes into a scratch buffer it keeps from
one call to the next. At `5745202`, the buffer, its capacity and the write
cursor were declared in the closure the serializer is generated into, so
each reservation loaded the cursor and the capacity, and stored the cursor,
as upvalues. The set row's `serialize`:

```luau
local serializer = (function()
	local __surge_scratch = buffer.create(64)
	local __surge_capacity = 64
	local __surge_cursor = 0
	return {
		serialize = function(value)
			__surge_cursor = 1
			local dict1 = value.ids
			local count3 = 0
			for k4 in dict1 do
				local pos5 = __surge_cursor
				__surge_cursor = pos5 + 2
				if __surge_cursor > __surge_capacity then
					__surge_scratch, __surge_capacity = __surge_grow(__surge_scratch, pos5, __surge_cursor)
				end
				buffer.writeu16(__surge_scratch, pos5, k4)
				count3 += 1
			end
			-- the count
			return __surge_finishWrite(__surge_scratch, __surge_cursor)
		end,
```

At `88fe442`, the closure keeps only the buffer and its capacity, under
other names. `serialize` copies them into locals on entry, starts its own
cursor, and stores both back before it returns, so that the next call starts
from the buffer it grew:

```luau
local serializer = (function()
	local __surge_keptScratch = buffer.create(64)
	local __surge_keptCapacity = 64
	return {
		serialize = function(value)
			local __surge_scratch = __surge_keptScratch
			local __surge_capacity = __surge_keptCapacity
			local __surge_cursor = 1
			-- the same body
			__surge_keptScratch = __surge_scratch
			__surge_keptCapacity = __surge_capacity
			return __surge_finishWrite(__surge_scratch, __surge_cursor)
		end,
```

A call that raises after a grow stores neither, and the closure keeps the
smaller buffer, which a later call grows again. A `serialize` that reaches a
recursion helper keeps the closure's state, since the helper reserves through
the closure's buffer and may grow it while its caller holds the old one. Of
the catalog, that is the tree. A cursor codec's `write` already held the
state in locals, and so did a `deserialize` its read state
([size-and-read-locals.md](size-and-read-locals.md)).

## Method

**Builds.** The reference is `5745202`, and the change `88fe442`. Only the
transformer differs. Six surge modules differ, which are seven rows of the
catalog: the string-heavy row, the large record, the set, the tuples with a
rest, the sequences, and both packed `CFrame` rows, which share one module.
Only their `serialize` differs. Their cursor codecs, which the surge (cursor)
column times, are the same in both builds.

**Runs.** Scoped runs (Benchmark harness 9 in
[specs/benchmark-harness.md](../specs/benchmark-harness.md)):
`mise run bench:speed:only string largerecord set rest sequences packed
halves=encode`, each invocation two Studio runs back to back, nine trials per
cell per run. The patterns also select both toggles rows, whose surge code is
the same in both builds. Four invocations alternated between the builds, each
on a clean checkout of its commit. At each start no Roblox process was
running, and the CPU load, averaged over fifteen one-second samples of
`Get-Counter`, was the figure below. After each, the generated string-heavy
module was checked for its build's form.

| Pair | Build     | UTC           | Load  |
| ---- | --------- | ------------- | ----- |
| 1    | reference | 04:28 – 04:31 | 11.5% |
| 1    | change    | 04:32 – 04:35 | 9.8%  |
| 2    | reference | 04:36 – 04:39 | 10.4% |
| 2    | change    | 04:40 – 04:43 | 8.7%  |

**Code size.** `mise run bench:code` at each commit
([benchmarks/code-size.md](../benchmarks/code-size.md)), and
`mise run bench:size` at the change, against
[benchmarks/size.md](../benchmarks/size.md).

**Controls.** The fbs, serio, flamework2, Blink and hand-written columns.
`D` is the median ratio of the row's quiet control cells, and the adjusted
ratio is the ratio over `D`. The toggles rows' surge cells, and every row's
surge (cursor) cell, run the same code in both builds, and are reported as a
second measure of unchanged code.

**Reading.** Written before any run's result: the change stays if the code
is smaller and, in each pair, no changed surge encode cell has an adjusted
ratio below the lowest of how far unchanged code moved, which is each quiet
control cell's ratio over the median ratio of the other quiet control cells
of its row, as in [cursor-known-values.md](cursor-known-values.md). If a cell
failed in exactly one pair, a third pair would decide. A changed cell whose
two runs of the change are both below, or both above, both runs of the
reference is reported.

## Results

Bytecode of each surge module that changed, in bytes:

| Module           | Reference | Change | Change, bytes |
| ---------------- | --------- | ------ | ------------- |
| cframes (packed) | 1,514     | 1,511  | −3            |
| id-set           | 1,626     | 1,608  | −18           |
| large-record     | 2,048     | 2,014  | −34           |
| sequences        | 3,344     | 3,289  | −55           |
| string-heavy     | 2,608     | 2,572  | −36           |
| tuple-rest       | 2,216     | 2,188  | −28           |
| total, every row | 61,054    | 60,880 | −174          |

[benchmarks/size.md](../benchmarks/size.md) is unchanged. In every run,
each cell's round trip in Roblox was within what the size table records for
it (Benchmark harness 6.6 in
[specs/benchmark-harness.md](../specs/benchmark-harness.md)).

surge's encode, adjusted, and the median of each run in values a second:

| Row                                 | Pair 1  | Pair 2  | Reference, pair 1 | Change, pair 1 | Reference, pair 2 | Change, pair 2 |
| ----------------------------------- | ------- | ------- | ----------------- | -------------- | ----------------- | -------------- |
| set                                 | 1.556 ↑ | 1.544 ↑ | 513.1k, 516.3k    | 793.5k, 809.0k | 514.3k, 518.2k    | 789.0k, 798.4k |
| tuples with a rest                  | 1.618 ↑ | 1.664 ↑ | 357.7k, 354.6k    | 576.5k, 573.7k | 355.8k, 354.8k    | 583.4k, 578.4k |
| sequences                           | 1.109 ↑ | 1.069 ↑ | 46.9k, 43.9k      | 49.7k, 49.4k   | 46.6k, 47.0k      | 49.9k, 49.9k   |
| large record                        | 1.079 ↑ | 1.085 ↑ | 122.6k, 124.4k    | 131.7k, 135.1k | 127.3k, 125.1k    | 135.8k, 137.3k |
| string-heavy                        | 1.031   | 1.026 ↑ | 199.7k, 195.5k    | 199.4k, 198.7k | 194.1k, 197.4k    | 201.7k, 201.2k |
| CFrame array (packed, axis-aligned) | 1.038 ↑ | 1.018   | 176.0k, 179.8k    | 181.5k, 184.8k | 182.0k, 175.7k    | 183.0k, 179.4k |
| CFrame array (packed, arbitrary)    | 1.009   | 1.029 ↑ | 131.1k, 129.9k    | 130.2k, 135.6k | 133.2k, 135.2k    | 135.6k, 136.4k |

↑ marks a cell whose two runs of the change are both above both runs of the
reference. No changed cell was marked noisy.

Unchanged code moved no lower than 0.965 and no higher than 1.036 in pair 1,
and between 0.961 and 1.040 in pair 2. The quiet control cells moved 0.995×,
quartiles [0.985, 1.001] over 27, in pair 1, and 0.997×, [0.988, 1.000] over
27, in pair 2. surge's quiet cells whose code did not change moved between
0.958 and 1.061 in pair 1, and between 0.974 and 1.021 in pair 2; the
unpacked toggles' surge cell, marked noisy in pair 1's reference, is left
out.

## Discussion

- Every changed cell is above how far unchanged code moved, in both pairs,
  and four of the seven are above the highest of it in both.
- The gain is largest where each element's write is one reservation of a few
  bytes: a `u16` for the set, and a `u8` for each sample of a tuple's rest.
  There the loads and stores of the cursor and the capacity were a large part
  of what each element ran. The string-heavy row writes strings of up to 40
  bytes, and each packed `CFrame` is a call into the package, so what the
  upvalues cost is a smaller part of each element there; the string-heavy
  cell's gain is within how far surge's unchanged cells moved in pair 1.
- The change adds two loads on entry and two stores before the return for
  each call. The rows measured run many reservations a call; what a call that
  makes one reservation pays is not measured.
- The cursor codec held this state in locals before the change. On the set,
  surge's encode was 0.51× the cursor codec's in pair 1's reference and 0.74×
  in its change; what remains is the result `finishWrite` creates and copies
  for each call, which the cursor codec does not
  ([per-call-overhead.md](per-call-overhead.md)).
- Pairs of scoped runs read only against each other: the reference and the
  change of each pair ran back to back, minutes apart, and each table is read
  against its controls in the same run.
- The figures are from one machine and one Roblox version, with `--!native`
  and `--!optimize 2` on the generated modules. How much of the gain is the
  native code generator's handling of upvalues is not separated.

## Conclusion

Holding a scratch-path `serialize`'s buffer, capacity and cursor in locals
takes 174 bytes off the six modules that keep the scratch buffer and speeds
up their encode by up to 1.66×, most on rows whose elements each reserve a
few bytes, with no cell slower than unchanged code moves. The change is kept.

## Data

- The four scoped runs, each a `speed.md` and the trials behind it, under
  [data/write-state-in-locals/](data/write-state-in-locals/):
  `reference-1/`, `change-1/`, `reference-2/` and `change-2/`.
- The bytecode: `docs/benchmarks/code-size.md` as committed at `5745202` and
  at `88fe442`.
- The figures above were computed from the `.tsv` files, with the recorder's
  own median, spread and noise rule.
