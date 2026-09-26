# Read tables created at their size

2026-09-26 · surge `cf9b740` · rbxts-transformer-surge `0c0f412` · Roblox
0.740.19.7400931

## Abstract

A generated `deserialize` read an array into an empty table and appended each
element with `table.insert`. Transformer 5.21 has the read create the table
with `table.create` at the count it has just read and store each element at
its index. Against a reference run of the build before it, taken after the
change in the same session, decode ran 1.03× to 1.48× as fast on the eight
readable rows the change reached. That is 4.9 to 10.3 ns less per element,
whatever the element. On the two thousand-element rows, where both reference
runs were too noisy to read, decode ran at least 1.47× as fast. The `CFrame`
array now decodes within 14 ns a call of a hand-written Luau codec, where it
was 494 ns behind. The same change fixes a tuple read: an absent element in
the middle of a tuple let the next element take its index.

## Background

The generated `deserialize()` of the large array, a thousand `u16`s, read
into a table that started empty:

```luau
local count7 = buffer.readu32(__surge_input, pos6)
local result8 = {}
-- ... one reservation for every element ...
for _i9 = 1, count7 do
    local _arg0 = buffer.readu16(__surge_input, element11)
    table.insert(result8, _arg0)
    element11 += 2
end
```

roblox-ts compiles an array's `push` to `table.insert`, so each element was a
call, and the table grew as it filled. With Transformer 5.21 in
[specs/transformer.md](../specs/transformer.md), the table is created at the
count, and each element is stored at the loop's index:

```luau
local result8 = table.create(count7)
-- ... the same reservation ...
for i9 = 1, count7 do
    result8[i9] = buffer.readu16(__surge_input, element11)
    element11 += 2
end
```

The emitter writes `new Array<T>(count)`, which roblox-ts compiles to
`table.create(count)`, and `result[i - 1] = element`, whose `- 1` roblox-ts
folds into the index it adds. A tuple's table is created at the number of its
fixed elements, and a sequence's keypoints at their count. The hand-written
codec in `tests/src/bench/baseline/codecs.luau` has read the `CFrame` array
this way from the start, and its comment names the empty table as part of the
decode gap on that row.

## Method

**Builds.** The reference is surge `44dcafd` and rbxts-transformer-surge
`3661ef7`; the change is surge `cf9b740` and rbxts-transformer-surge
`0c0f412`. The catalog and the adapters are the same in both. Both builds of
`tests/` were compiled from scratch, and the compiled fixture modules differ
only in the `deserialize` of ten rows: the large array, the string-heavy,
enum-heavy, tagged-union and guarded-union rows, the three `CFrame` arrays,
`Blink: Booleans` and `Blink: Entities`. Each of those reads one array in a
loop. The other six modules are the same text in both builds. surge's
`serialize` changed on no row, so the encode half is a control throughout.

**Runs.** Three full invocations of `mise run bench:speed` on 2026-09-26,
each two Studio runs back to back with nine trials per cell per run: the
reference from 06:29 to 06:38, the change from 06:42 to 06:50, and the
reference build again from 06:51 to 06:59. No Studio session or Roblox Player
was open before any of them, and nothing else was run during them.

**Reading.** As in [exact-sizing.md](exact-sizing.md): the recorder's median,
spread and noise mark, the change's surge median over the reference's, the
drift `D` over the row's quiet control cells, and time saved per call as
`1/reference − 1/change`, divided by the row's element count for time saved
per element. The change is read against the second reference.

**Controls.** The fbs, serio, Blink and baseline columns; the six rows whose
`deserialize` did not change, which are the floor; and surge's encode.

## Results

### The references and the floor

Over the quiet control cells, the change ran at 0.999× the first reference on
decode, quartiles [0.994, 1.006] over 44 cells, and at 1.001× the second,
[0.996, 1.005] over 44. The second reference ran at 0.999× the first on
decode and 0.995× on encode.

On decode, five of the six unchanged rows moved between 0.991× and 1.001×
against the second reference. The sixth, the unpacked toggles, moved 0.939×.
Its compiled code is the same text in both builds, and the change's first run
matched both references on it; its second run was 9.6% slower than its first,
just inside the recorder's 10% rule. On encode, where no row changed, the
fifteen quiet rows moved between 0.985× and 1.044×.

### The changed rows

Decode, from `data/before-sized-read-tables-second-run.tsv` and the change's
trials file:

| Row                                   | Elements | Reference    | Change       | Ratio | `D`       | Adjusted | Saved per call | Saved per element | Against the first reference |
| ------------------------------------- | -------- | ------------ | ------------ | ----- | --------- | -------- | -------------- | ----------------- | --------------------------- |
| string-heavy                          | 100      | 195.0k ±1.0% | 219.4k ±1.7% | 1.125 | 1.000 (3) | 1.125    | 0.57 µs        | 5.7 ns            | 1.131                       |
| enum-heavy                            | 100      | 508.9k ±2.2% | 753.6k ±2.4% | 1.481 | 1.006 (2) | 1.472    | 0.64 µs        | 6.4 ns            | 1.484                       |
| tagged union                          | 100      | 86.9k ±1.5%  | 92.2k ±2.2%  | 1.062 | 1.005 (3) | 1.056    | 0.67 µs        | 6.7 ns            | 1.087                       |
| guarded union                         | 100      | 276.4k ±1.1% | 336.2k ±2.2% | 1.216 | 0.995 (2) | 1.222    | 0.64 µs        | 6.4 ns            | 1.215                       |
| `CFrame` array                        | 50       | 135.5k ±2.5% | 144.4k ±1.6% | 1.066 | 0.997 (4) | 1.069    | 0.45 µs        | 9.1 ns            | 1.058                       |
| `CFrame` array (packed, axis-aligned) | 50       | 230.1k ±0.6% | 248.8k ±2.3% | 1.082 | 0.997 (2) | 1.085    | 0.33 µs        | 6.6 ns            | 1.081                       |
| `CFrame` array (packed, arbitrary)    | 50       | 116.8k ±1.9% | 120.2k ±1.3% | 1.029 | 0.995 (2) | 1.034    | 0.24 µs        | 4.9 ns            | 1.024                       |
| `Blink: Entities`                     | 100      | 61.4k ±2.6%  | 65.6k ±2.7%  | 1.067 | 1.001 (3) | 1.066    | 1.03 µs        | 10.3 ns           | 1.073                       |

Time saved is from the raw medians.

### The two thousand-element rows

The large array and `Blink: Booleans` each decode a thousand elements. Both
reference runs marked both rows as noise: 10.2% to 29.7% spread. Each such
cell is two Studio runs that disagree, not scattered trials. In both
references, the first run read the large array at 56.8k to 58.4k a second and
the second run at 64.6k to 75.2k, and `Blink: Booleans` split the same way.
The change's two runs agree: 111.0k and 110.2k on the large array, 112.3k and
108.6k on `Blink: Booleans`, with 4.0% and 3.4% spread.

Against each reference run on its own:

| Row               | Change | Against the slowest reference run  | Against the fastest reference run  |
| ----------------- | ------ | ---------------------------------- | ---------------------------------- |
| large array       | 110.5k | 1.947× (56.8k), 8.6 ns per element | 1.469× (75.2k), 4.2 ns per element |
| `Blink: Booleans` | 111.4k | 1.984× (56.1k), 8.8 ns per element | 1.475× (75.5k), 4.3 ns per element |

### The gap to hand-written Luau

surge's decode against the baseline column, on the three rows it covers:

| Row                  | Second reference: behind by | Change: behind by | Baseline over surge, before and after |
| -------------------- | --------------------------- | ----------------- | ------------------------------------- |
| small flat struct    | 3.1 ns                      | 3.5 ns            | 1.018× to 1.020×                      |
| deeply nested object | 18.0 ns                     | 26.6 ns           | 1.049× to 1.074×                      |
| `CFrame` array       | 494.3 ns                    | 13.6 ns           | 1.072× to 1.002×                      |

The first two rows read no array, and their code did not change.

### Against Blink

Blink's generated read of the same thousand `u16`s also creates its table with
`table.create`, then appends each element with `table.insert`. Blink's decode
over surge's, on the rows the change reached and Blink runs:

| Row               | First reference | Second reference | Change |
| ----------------- | --------------- | ---------------- | ------ |
| large array       | 1.255×          | 1.178×           | 0.701× |
| `Blink: Booleans` | 1.287×          | 1.147×           | 0.671× |
| string-heavy      | 1.162×          | 1.148×           | 1.028× |
| tagged union      | 0.689×          | 0.670×           | 0.624× |
| `CFrame` array    | 0.799×          | 0.810×           | 0.761× |
| `Blink: Entities` | 0.621×          | 0.620×           | 0.581× |

## Discussion

Every readable changed row is past the decode floor, whose highest row is
1.001×; the lowest, the arbitrary packed `CFrame` array, by 2.8 points.
What each row saved per element falls between 4.9 and 10.3 ns, on elements as
different as a `u16`, an enum item, a string, a union variant and a `CFrame`.
That is what a call to `table.insert`, and the growth of a table filled one
append at a time, cost against a store into a table of the right size. How the
saving divides between the call and the growth was not probed.

Blink creates its table at its size, as surge now does, but appends. surge
decoded the two thousand-element rows 1.15× to 1.29× slower than Blink before
the change, and 1.43× to 1.49× faster after it. This does not separate the
store from the size either: Blink's loop also reads its table out of the
result object on every append.

The two thousand-element rows are the ones where appending grew a table the
most, and they are the two whose reference runs disagreed between Studio
processes. After the change, their runs agree. Why an appending read's speed
depends on the process was not probed.

The hand-written codec reads the `CFrame` array with `table.create` and a
store. With the same read in surge, what is left of that row's decode gap is
13.6 ns a call.

A table created at its size also moves where a large count allocates. Under
`readChecks`, the count is bounded before the table is created (Transformer
5.10), so an element with a minimum size admits no larger a table than the
input's bytes. An element that reads no bytes is still capped at 2^24, as
before, and that table is now created at once rather than grown by the loop.
Without `readChecks`, a count read from bytes no `serialize` wrote sizes the
table before any element is read, which
[errors-and-guarantees.md](../errors-and-guarantees.md) already allows.

The store fixed a read that appending had wrong. `table.insert(t, nil)` adds
nothing, so an absent element in the middle of a tuple, such as `[1,
undefined, 3]`, read back as `[1, 3]`. A store leaves the index empty and the
next element keeps its own. The array case differs: the write side's generic
`for` skips a `nil` element while its count includes it, so an array with a
hole in it is still not supported
([errors-and-guarantees.md](../errors-and-guarantees.md)).

What this does not reach:

- No catalog row reads a tuple or a sequence, so the change is unmeasured on
  both.
- A `dict` is read into a `Map` or a `Set`, whose size `table.create` cannot
  give, and it was not changed.
- The fixtures run native. What the change is worth interpreted was not run.

## Conclusion

Creating a read's table at its size and storing each element at its index
made decode 1.03× to 1.48× as fast on the eight readable rows it reached, and
at least 1.47× on the two thousand-element rows, 4 to 10 ns per element. It
closed the `CFrame` array's decode gap to hand-written Luau from 494 ns to 14
ns a call, and put surge ahead of Blink on the two rows where Blink decoded
faster.

## Data

- `data/before-sized-read-tables.md` and `.tsv`: the first reference, at
  surge `44dcafd` and rbxts-transformer-surge `3661ef7`.
- `data/before-sized-read-tables-second-run.md` and `.tsv`: the second
  reference, at the same commits.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `66a9ff6`,
  recorded at surge `cf9b740` and rbxts-transformer-surge `0c0f412`.
- The figures above were computed from the three `.tsv` files, with the
  recorder's own median, spread and noise rule.
