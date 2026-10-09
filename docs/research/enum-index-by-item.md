# An enum's index keyed by the item

2026-10-09 · surge `a89553b` and `359c8e1` · Lune 0.10.5 · Roblox
0.742.0.7421053

## Abstract

The experimental Flamework 2 encoded the enum row 1.71× as fast as surge,
which wrote each item's index from a table keyed by the item's `Name`
([enum-and-cframe-rows.md](enum-and-cframe-rows.md)). This change keys the
table by the `EnumItem` itself, so the write reads no property of the item.
The row's encode is 3.709× adjusted, from 320.6k to 1.19M values a second,
2.28 µs less for each call of 102 items, and surge now encodes the row at
2.17× Flamework 2's throughput. No byte changed, and the row's module is 658
bytes of bytecode smaller. The change is kept.

## Background

surge writes an enum item as its index among the items in name order (Wire
format 4.12 in [specs/wire-format.md](../specs/wire-format.md)). At
`a89553b`, the write found the index in a table keyed by the item's `Name`,
written out in the module:

```luau
local surge_Material_1_index = {
	Air = 0,
	Asphalt = 1,
	-- one entry for each of the 45 items
}
-- in the write, for each item
local _exp = element7
local _name = item5.Name
buffer.writeu8(__surge_scratch, _exp, surge_Material_1_index[_name])
```

A table keyed by the item itself had not been tried, because under Lune, the
round-trip suite's runner, `Enum.X.Y` returns a new object on each access,
and a table keyed by one misses the next. Roblox gives each item one object.
A key of the item's `Value` had measured 0.934× on the row's encode
([enum-and-cframe-rows.md](enum-and-cframe-rows.md)).

Flamework 2 writes each item's `Value` as a u16, with no lookup: 205 bytes
on the row, where surge writes 103 ([benchmarks/size.md](../benchmarks/size.md)).

The change, `359c8e1` (Transformer 5.29 in
[specs/transformer.md](../specs/transformer.md)), keys the table by the item
and fills it from the module's list of the items as the module loads:

```luau
local surge_Material_1_index = {}
for i8 = 1, 45 do
	local _arg0 = surge_Material_1_items[i8]
	local _arg1 = i8 - 1
	surge_Material_1_index[_arg0] = _arg1
end
-- in the write, for each item
buffer.writeu8(__surge_scratch, element7, surge_Material_1_index[item5])
```

A union of more than one enum tells them apart by membership in each enum's
table, where it compared the item's `EnumType` (Transformer 4.4). Under
Lune, the round-trip suite runs under a stand-in `Enum` that gives each item
one object (Test harness 4.3 in
[specs/test-harness.md](../specs/test-harness.md)). In Roblox, the speed
tier now checks each cell's round trip before its trials, `a89553b`
(Benchmark harness 6.6 in
[specs/benchmark-harness.md](../specs/benchmark-harness.md)).

## Method

**Builds.** The reference is `a89553b`, which adds the speed tier's
round-trip check. The change is `359c8e1`. Among the benchmark's modules,
only the enum row's surge module differs between the two.

**Runs.** Each is one full invocation of `mise run bench:speed`: two Studio
runs back to back, nine trials per cell per run. The reference ran from 10:40
to 10:53 UTC, and the change from 10:54 to 11:08 UTC. At each start no Roblox
process was running, and the CPU load, averaged over fifteen one-second
samples of `Get-Counter`, was 7.2% and 6.7%.

**Reading.** The change stays if the enum row's encode is faster, with both
runs of the change above both runs of the reference, the cell is not marked
noisy, and the row's surge cell round-trips exactly in Roblox in both runs.

**Controls.** The fbs, serio, flamework2, Blink and hand-written columns,
whose code did not change, and the twenty rows whose surge code did not
change. `D` is the median ratio of the row's quiet control cells, with their
number, and the adjusted ratio is the ratio over `D`.

## Results

The enum row's surge cells. No cell here is marked noisy. A negative time a
call is time saved.

| Half   | Reference    | Change       | Ratio | `D`       | Adjusted | µs a call | Runs, reference | Runs, change   |
| ------ | ------------ | ------------ | ----- | --------- | -------- | --------- | --------------- | -------------- |
| encode | 320.6k ±1.1% | 1.19M ±1.9%  | 3.716 | 1.002 (3) | 3.709    | −2.280    | 319.9k, 322.3k  | 1.18M, 1.19M   |
| decode | 811.0k ±5.0% | 753.1k ±6.3% | 0.929 | 0.954 (3) | 0.974    | +0.095    | 830.2k, 792.3k  | 794.3k, 749.9k |

In both runs of both builds, every cell's round trip in Roblox was within
what [benchmarks/size.md](../benchmarks/size.md) records for it, and the
enum row's surge cell was exact.

The quiet control cells moved 0.994× on encode, quartiles [0.988, 1.000]
over 77, and 0.987× on decode, quartiles [0.977, 0.997] over 81. surge's
quiet rows whose code did not change moved between 0.965× and 1.017×
adjusted on encode, and between 0.969× and 1.013× on decode.

Flamework 2's throughput over surge's on the enum row:

| Half   | Reference | Change |
| ------ | --------- | ------ |
| encode | 1.71×     | 0.46×  |
| decode | 0.67×     | 0.68×  |

The row's bytes are unchanged, 103. Its surge module is 3,179 bytes of
bytecode, where the reference's is 3,837
([benchmarks/code-size.md](../benchmarks/code-size.md)).

## Discussion

- The change saved about 22 ns for each item, where Flamework 2's lead had
  been about 13 ns. The write still looks each item up in a table, by a
  userdata key where it was a string, so most of the 22 ns was the read of
  the item's `Name`. The run does not separate that read from a difference
  between the two lookups. Flamework 2's write reads each item's `Value`;
  the write by `Value`, a read of `Value` and a lookup by number, measured
  slower than a read of `Name` and a lookup by string.
- In the reference, roblox-ts bound the write's position and the item's
  `Name` to locals before the call; in the change it binds neither. The run
  does not separate their cost either.
- The decode's code is the same in the two builds; its 0.974× is within the
  row's spread, ±5.0% and ±6.3%.
- The table is filled from the items the type admits, in the order the
  module lists them, so each item's index is fixed when the module is
  compiled, as before.
- The write finds an item only where the runtime gives each item one object.
  Roblox does; the speed tier's check shows it for the items of
  `Enum.Material` and `Enum.HumanoidRigType` that the row writes. Lune does
  not: generated code run under Lune without the test suite's stand-in
  `Enum` finds no index for an item. The write raises, or, in a union of
  more than one enum, takes the union's last variant.
- The figures are from one machine and one Roblox version, with `--!native`
  and `--!optimize 2` on the generated modules.

## Conclusion

Keying an enum's index by the `EnumItem` itself, which removes the read of
each item's `Name`, is worth 3.709× on the enum row's encode, and leaves
surge encoding the row at 2.17× Flamework 2's throughput while writing half
its bytes.

## Data

- The reference:
  [data/before-enum-index-by-item.md](data/before-enum-index-by-item.md)
  and
  [data/before-enum-index-by-item.tsv](data/before-enum-index-by-item.tsv),
  recorded at `a89553b`.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed with this paper, recorded at
  `359c8e1`.
- The figures above were computed from the `.tsv` files, with the recorder's
  own median, spread and noise rule.
