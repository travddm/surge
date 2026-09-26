# Exact sizing

2026-09-26 · surge `df1d04a` · rbxts-transformer-surge `015e1f3` · Roblox
0.740.19.7400931

## Abstract

A `serialize` wrote into a scratch buffer that the serializer keeps, checked
its capacity at every reservation, and copied the result out with
`finishWrite`. Transformer 5.20 has a shape that can be sized without a loop
create its result at its size and write into it. Against a reference run of
the build before it, taken after the change in the same session, encode ran
1.13× to 1.23× as fast on seven of the ten catalog rows the change reached,
31 to 75 ns less per call on the five that take under 0.5 µs, and 1.01× to
1.02× on two whose elements dominate a call; the rows it did not reach moved
between 0.977× and 0.998×. The small flat struct's encode is now 3.7 ns per
call behind a hand-written Luau codec writing the same bytes, where it was
38.8 ns behind.

## Background

The generated `serialize()` of the small flat struct wrote into the
serializer's scratch buffer and copied the result out:

```luau
serialize = function(value)
    __surge_cursor = 0
    local pos1 = __surge_cursor
    __surge_cursor = pos1 + 17
    if __surge_cursor > __surge_capacity then
        __surge_scratch = __surge_grow(__surge_scratch, pos1, __surge_cursor)
        __surge_capacity = buffer.len(__surge_scratch)
    end
    buffer.writeu8(__surge_scratch, pos1, if value.active then 1 else 0)
    -- ... four more writes at pos1 + 1 to pos1 + 13 ...
    return __surge_finishWrite(__surge_scratch, __surge_cursor)
```

The scratch buffer, its capacity and the cursor are upvalues of the function
(Transformer 5.3 in [specs/transformer.md](../specs/transformer.md)). With
Transformer 5.20, the same shape is created at its size, its buffer and cursor
are locals, no reservation checks the capacity, and the buffer written is the
one returned:

```luau
serialize = function(value)
    local __surge_scratch = buffer.create(17)
    local __surge_cursor = 0
    local pos1 = __surge_cursor
    __surge_cursor = pos1 + 17
    buffer.writeu8(__surge_scratch, pos1, if value.active then 1 else 0)
    -- ... the same four writes ...
    return __surge_scratch
```

A shape with a string or an array computes its size from the value first,
such as `#value.name + (if value.nickname ~= nil then #value.nickname + 4 else 0) + 14`.
The copy, the capacity check and the scratch state in the closure were the
three candidates [tables-around-serialize.md](tables-around-serialize.md)
left for what remained of the per-call gap once the tables around the result
were gone.

## Method

**Builds.** The reference is surge `bea5fc0` and rbxts-transformer-surge
`ba1331a`; the change is surge `df1d04a` and rbxts-transformer-surge
`015e1f3`. The catalog and the adapters are the same in both. Both builds of
`tests/` were compiled from scratch, and fbs's, serio's and Blink's code is the
same text in both. surge's `serialize` changed on ten rows, whose shapes can
be sized without a loop: the small flat struct, the deeply nested object, the
wide struct, the large array, the enum-heavy row, both toggles rows, the
unpacked `CFrame` array, `Blink: Booleans` and `Blink: Entities`. It did not
change on the other six, which hold an array of strings, a dictionary, an
array of union variants, or packed `CFrame`s. surge's `deserialize` changed on
no row, so the decode half is a control throughout.

**Runs.** Three full invocations of `mise run bench:speed` on 2026-09-26,
each two Studio runs back to back with nine trials per cell per run: the
reference from 04:45 to 04:53, the change from 05:06 to 05:15, and the
reference build again from 05:15 to 05:23. No Studio session or Roblox Player
was open before any of them, and nothing else was run during them.

**Reading.** As in [one-reservation-per-string.md](one-reservation-per-string.md):
the recorder's median, spread and noise mark, the change's surge median over
the reference's, the drift `D` over the row's quiet control cells, and time
saved per call as `1/reference − 1/change`. The change is read against the
second reference, whose control cells sit closest to the change's.

**Controls.** The fbs, serio, Blink and baseline columns; the six rows whose
`serialize` did not change, which are the floor; and surge's decode.

## Results

### The references and the floor

Over the quiet control cells, the change ran at 1.012× the first reference on
encode, quartiles [1.007, 1.019] over 41 cells, and at 1.001× the second,
[0.993, 1.008] over 41. The second reference ran at 1.011× the first. On
encode, the six unchanged rows moved between 0.977× and 0.998× against the
second reference, median 0.990×. On decode, where no row changed, the fourteen
quiet rows moved between 0.988× and 1.025×.

### The changed rows

Encode, from `data/before-exact-sizing-second-run.tsv` and the change's
trials file:

| Row                  | Reference     | Change        | Ratio  | `D`       | Adjusted | Saved per call | Against the first reference |
| -------------------- | ------------- | ------------- | ------ | --------- | -------- | -------------- | --------------------------- |
| small flat struct    | 4913.0k ±3.5% | 6026.5k ±3.8% | 1.227  | 1.024 (2) | 1.198    | 38 ns          | 1.246                       |
| deeply nested object | 3699.0k ±2.1% | 4183.6k ±1.5% | 1.131  | 0.997 (4) | 1.134    | 31 ns          | 1.148                       |
| wide struct          | 2522.7k ±3.5% | 3110.4k ±1.2% | 1.233  | 0.996 (2) | 1.238    | 75 ns          | 1.238                       |
| large array          | 272.9k ±1.7%  | 329.7k ±2.3%  | 1.208  | 1.008 (2) | 1.199    | 0.63 µs        | 1.230                       |
| enum-heavy           | 289.3k ±1.8%  | 293.0k ±1.5%  | 1.013  | 0.997 (2) | 1.017    | 45 ns          | 1.030                       |
| toggles (unpacked)   | 3787.6k ±2.8% | 4487.7k ±2.5% | 1.185  | 1.006 (3) | 1.178    | 41 ns          | 1.198                       |
| toggles (packed)     | 4065.2k ±2.6% | 4781.9k ±1.8% | 1.176  | 0.998 (2) | 1.178    | 37 ns          | 1.181                       |
| `CFrame` array       | 232.3k ±1.5%  | 237.7k ±2.2%  | 1.023  | 0.997 (4) | 1.027    | 98 ns          | 1.032                       |
| `Blink: Booleans`    | 171.1k ±1.9%  | 200.9k ±24.2% | 1.174† | 1.002 (2) | —        | —              | 1.130†                      |
| `Blink: Entities`    | 457.8k ±1.3%  | 549.7k ±1.3%  | 1.201  | 0.984 (3) | 1.220    | 0.37 µs        | 1.274                       |

† the change's cell spread by more than 10%, and the row is not read. Time
saved is from the raw medians.

### The gap to hand-written Luau

surge's encode against the baseline column, the hand-written codec, on the
three rows it covers:

| Row                  | Second reference: behind by | Change: behind by | Baseline over surge, before and after |
| -------------------- | --------------------------- | ----------------- | ------------------------------------- |
| small flat struct    | 38.8 ns                     | 3.7 ns            | 1.235× to 1.023×                      |
| deeply nested object | 55.7 ns                     | 28.4 ns           | 1.259× to 1.135×                      |
| `CFrame` array       | 599.3 ns                    | 474.4 ns          | 1.162× to 1.127×                      |

## Discussion

Seven rows are well outside the floor, whose highest row is 0.998×: every row
whose `serialize` changed but the `CFrame` array, the enum-heavy row, and
`Blink: Booleans`, which cannot be read. Those two moved 1.023× and 1.013×,
past the floor by one and a half to two and a half points. Their per-call
work is dominated by the elements, a `ToAxisAngle` and an enum's name lookup
each, which the change does not touch.

On the five rows that take under 0.5 µs, the change saved 31 to 75 ns a
call. Most
of the flat struct's gap to hand-written Luau was this: what is left, 3.7 ns,
is inside what two runs of one build disagree by. The nested object keeps
28.4 ns of its gap, where it still makes six reservations and reads two
strings' lengths twice, once for the size. The `CFrame` array keeps most of
its gap, which is per element
([one-reservation-per-array.md](one-reservation-per-array.md)).

The large array saved 0.63 µs a call. The reservation per element was already
gone
([one-reservation-per-array.md](one-reservation-per-array.md)), so what the
change removed there is per call: the copy of two kilobytes, the call to
`finishWrite`, and the scratch state's upvalues. Which of them the 0.63 µs is
was not probed, but it bounds what a copy of that size costs, a question
[per-call-overhead.md](per-call-overhead.md) left open.

What the change adds, a size read from the value before the writes, costs
nothing this run can separate: no changed row slowed, and the rows that read
the most for their size, the nested object and the toggles, still gained 13%
to 19%.

What this does not reach:

- The six rows whose shape needs a loop to size keep the scratch buffer, and
  nothing here says what a second traversal would cost them.
- The fixtures run native. What the change is worth interpreted was not run.
- The generated `serialize` still moves its cursor past the last reservation,
  where nothing reads it again, and the enum-heavy and `CFrame` rows' changes
  are within two and a half points of the floor, which one change run cannot
  settle.

## Conclusion

Creating the result at its exact size, where a shape can be sized without a
loop, made encode 1.13× to 1.23× as fast on seven of the rows it reached, 31
to 75 ns a call on the small shapes, and moved no row it did not reach out of the band
two runs of one build share. The flat struct now encodes within 4 ns a call
of a hand-written codec writing the same bytes.

## Data

- `data/before-exact-sizing.md` and `.tsv`: the first reference, at surge
  `bea5fc0` and rbxts-transformer-surge `ba1331a`.
- `data/before-exact-sizing-second-run.md` and `.tsv`: the second reference,
  at the same commits.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `c819d35`,
  recorded at surge `df1d04a` and rbxts-transformer-surge `015e1f3`.
- The figures above were computed from the three `.tsv` files, with the
  recorder's own median, spread and noise rule.
