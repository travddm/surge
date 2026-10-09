# Smaller generated code from its cold paths

2026-10-09 · surge `766cb9a` and `dd1056e` · Lune 0.10.5 · Roblox
0.742.0.7421053

## Abstract

Four changes to the generated code make it smaller where it runs rarely or
once: a variable-length count's long form, with a string's or a buffer's
bytes after it, is one call into the package; a reservation that grows the
scratch buffer takes the new capacity from `grow`; and an enum of more than
five items fills its item list from one string of names as the module loads.
The bytecode of the twenty surge modules of the benchmark falls by 2,933
bytes, 5.7%, and by 23.0% and 20.0% on the enum and string-heavy rows. No
byte changed. No row's encode or decode moved further than rows whose code
did not change moved between the same two runs. The changes are kept.

## Background

Each change is in `dd1056e` (Transformer 5.28 and 5.29 in
[specs/transformer.md](../specs/transformer.md), and Runtime API 5.1 in
[specs/runtime-api.md](../specs/runtime-api.md)).

**A string's long form.** A string writes its count in one byte below 254
bytes, and in a long form above (Wire format 6.9 in
[specs/wire-format.md](../specs/wire-format.md)). At `766cb9a`, each string
of the scratch path wrote both forms inline:

```luau
else
	local pos4 = __surge_cursor
	__surge_cursor = pos4 + (len2 + (if len2 <= 65535 then 3 else 5))
	if __surge_cursor > __surge_capacity then
		__surge_scratch = __surge_grow(__surge_scratch, pos4, __surge_cursor)
		__surge_capacity = buffer.len(__surge_scratch)
	end
	__surge_writeLongCount(__surge_scratch, pos4, len2)
	buffer.writestring(__surge_scratch, pos4 + (if len2 <= 65535 then 3 else 5), s1)
end
```

At `dd1056e`, the long form is one call, which reserves, grows, and writes
the count and the bytes:

```luau
else
	__surge_scratch, __surge_capacity, __surge_cursor = __surge_growLongString(__surge_scratch, __surge_capacity, __surge_cursor, s1, len2)
end
```

Into a buffer sized for the whole value, the call is
`__surge_cursor = __surge_writeLongString(__surge_scratch, __surge_cursor, s1, len2)`.
A `buffer` takes `growLongBuffer` and `writeLongBuffer`, and the count of an
`array` or a tuple's rest `growLongCount` and `writeLongCount`, which now
returns the offset after the count. The one-byte form is unchanged.

**Growth.** Each reservation of the scratch path reads its capacity after a
growth from `grow`, which now returns it:

```luau
if __surge_cursor > __surge_capacity then
	__surge_scratch, __surge_capacity = __surge_grow(__surge_scratch, pos3, __surge_cursor)
end
```

**An enum's names.** An enum of more than five items fills its item list and
its index from one string, where it listed `Enum.Material.Air` and each item
after it:

```luau
local surge_Material_1_items = {}
local surge_Material_1_index = {}
for name2 in string.gmatch("Air Asphalt Basalt ... WoodPlanks", "%S+") do
	local item3 = (Enum.Material)[name2]
	local _arg1 = #surge_Material_1_items
	surge_Material_1_index[item3] = _arg1
	table.insert(surge_Material_1_items, item3)
end
```

The bound of five is where `luau.compile` under Lune made the string the
smaller of the two forms, at six items, in modules written for the
comparison (`ENUM_LISTED_ITEMS` in
`rbxts-transformer-surge/src/emit/constants.ts`).

No `deserialize` changed. Among the timed `serialize` calls, those of the
large array and of `Blink: Booleans`, each a count of 1,000, take a long
form; every other count and string of the catalog is below 254.

## Method

**Builds.** The reference is `766cb9a`, and the change `dd1056e`.

**Runs.** Each is one full invocation of `mise run bench:speed`: two Studio
runs back to back, nine trials per cell per run. The reference ran from 12:20
to 12:33 UTC, and the change from 12:34 to 12:47 UTC. At each start no Roblox
process was running, and the CPU load, averaged over fifteen one-second
samples of `Get-Counter`, was 4.6% and 5.0%.

**Code size.** `mise run bench:code` at each commit
([benchmarks/code-size.md](../benchmarks/code-size.md)).

**Reading.** The changes stay if the code is smaller and no row's encode is
slower by more than the cells whose code did not change move between the
same two runs. Every decode is such a cell, and so are the encodes of the
small flat struct and the wide struct, whose modules did not change.

**Controls.** The fbs, serio, flamework2, Blink and hand-written columns, and
every decode. `D` is the median ratio of the row's quiet control cells, and
the adjusted ratio is the ratio over `D`.

## Results

Bytecode of each surge module, in bytes:

| Module                   | Reference | Change | Change, bytes | Change, % |
| ------------------------ | --------- | ------ | ------------- | --------- |
| blink-benches (booleans) | 1,442     | 1,403  | −39           | −2.7      |
| blink-benches (entities) | 2,109     | 2,070  | −39           | −1.8      |
| cframes                  | 2,407     | 2,368  | −39           | −1.6      |
| cframes (packed)         | 1,776     | 1,611  | −165          | −9.3      |
| enum-heavy               | 3,179     | 2,447  | −732          | −23.0     |
| guarded-union            | 2,510     | 2,412  | −98           | −3.9      |
| instance-refs            | 1,873     | 1,834  | −39           | −2.1      |
| large-array              | 1,454     | 1,415  | −39           | −2.7      |
| large-record             | 2,349     | 2,134  | −215          | −9.2      |
| leaderboard              | 2,220     | 2,121  | −99           | −4.5      |
| nested-arrays            | 1,923     | 1,845  | −78           | −4.1      |
| nested-object            | 2,667     | 2,465  | −202          | −7.6      |
| packed-struct (packed)   | 3,117     | 3,018  | −99           | −3.2      |
| packed-struct (unpacked) | 3,891     | 3,791  | −100          | −2.6      |
| small-flat-struct        | 1,130     | 1,130  | 0             | 0.0       |
| string-heavy             | 3,298     | 2,637  | −661          | −20.0     |
| tagged-union             | 3,669     | 3,574  | −95           | −2.6      |
| tree                     | 2,031     | 1,876  | −155          | −7.6      |
| tuples                   | 1,728     | 1,689  | −39           | −2.3      |
| wide-struct              | 6,845     | 6,845  | 0             | 0.0       |
| total                    | 51,618    | 48,685 | −2,933        | −5.7      |

Flamework 2's module is now larger than surge's on every row both have but
the wide struct, where it was smaller on the enum and string-heavy rows as
well. [benchmarks/size.md](../benchmarks/size.md) is unchanged.

In both runs of both builds, every cell's round trip in Roblox was within
what the size table records for it (Benchmark harness 6.6 in
[specs/benchmark-harness.md](../specs/benchmark-harness.md)).

The quiet control cells moved 1.004× on encode, quartiles [0.997, 1.012]
over 75, and 1.008× on decode, quartiles [1.000, 1.019] over 79. surge's
cells, adjusted, against the reference:

| Cells                                         | Lowest | Highest |
| --------------------------------------------- | ------ | ------- |
| encode, the nineteen rows whose code changed  | 0.970  | 1.073   |
| encode, the two rows whose code did not       | 0.947  | 0.989   |
| decode, every row, none of whose code changed | 0.979  | 1.020   |

These leave out the cells marked noisy in a run: the large record's encode
and `Blink: Booleans`' encode, in the reference. The large array's encode,
which takes `writeLongCount` in each call, is 1.006×: 303.8k ±1.6% and
305.0k ±1.7%, with runs of 304.9k and 301.0k, and 306.5k and 304.5k.
`Blink: Booleans`' encode, which does too, is 0.944× adjusted: 194.2k
±11.9%† and 181.5k ±1.7%, with runs of 184.2k and 207.3k, and 183.0k and
179.8k. The cell was marked noisy in each of the four full runs before this
change, recorded at `89c2a85`, `a89553b`, `359c8e1` and `766cb9a`.

Two encode cells have both runs of the change below both runs of the
reference: `Blink: Booleans`', above, and the string-heavy row's, at 0.985× adjusted, 308.6k ±1.5% and
304.8k ±1.3%, with runs of 308.8k and 307.1k, and 306.1k and 302.2k. Three
decode cells, whose code is the same in both builds, have both runs below
too: the tree's, the packed toggles', and `Blink: Booleans`'. The tree's is
0.981× adjusted.

## Discussion

- The string-heavy row's encode slowed by about as much as the tree's
  decode, which runs the same code in both builds, so the run does not
  separate it from the drift between two runs. The string-heavy row's strings
  are each under 254 bytes, and their one-byte form is the same code in both
  builds; what changed in its `serialize` is the code of the long forms and
  of growth, which its calls do not reach once the scratch buffer has grown.
- The large array's encode calls `writeLongCount` in both builds; what moved
  into the package is the reservation of the long form.
- The enum's string of names runs once, as the module loads, and its item
  list and index hold the same items in the same order as before.
- The largest cuts are where a module holds many strings, or an enum of many
  items. The wide struct, fifty `f32` fields, holds none of what changed.
- The figures are from one machine and one Roblox version, with `--!native`
  and `--!optimize 2` on the generated modules.

## Conclusion

The four changes take 5.7% off the bytecode of the benchmark's surge modules,
and 23.0% and 20.0% off the enum and string-heavy rows, with no row's speed
moving further than unchanged code moves between two runs.

## Data

- The reference:
  [data/before-cold-paths-in-one-call.md](data/before-cold-paths-in-one-call.md)
  and
  [data/before-cold-paths-in-one-call.tsv](data/before-cold-paths-in-one-call.tsv),
  recorded at `766cb9a`.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed with this paper, recorded at
  `dd1056e`.
- The bytecode: `docs/benchmarks/code-size.md` as committed at `766cb9a` and
  with this paper.
- The figures above were computed from the `.tsv` files, with the recorder's
  own median, spread and noise rule.
