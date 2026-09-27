# A nested object's value read once

2026-09-27 · surge `44a6d4a` · rbxts-transformer-surge `fcc7a9c` · Roblox
0.740.19.7400931

## Abstract

A generated `serialize` wrote each property of a nested object through the
whole path of property reads from the value it was given, so a property three
objects deep read four properties before its own. Transformer 5.23 has an
object of more than one property read its value once into a local. Against a
reference run of the build before it, taken after the change in the same
session, the deeply nested object's encode ran 1.050× as fast, 11 ns less per
call, the only row the change reached. Its gap to a hand-written Luau codec
writing the same bytes went from 26.4 ns to 17.1 ns a call.

## Background

The generated `serialize()` of the deeply nested object read every property
from `value`:

```luau
buffer.writeu16(__surge_scratch, pos1, value.root.inner.count)
-- ...
buffer.writeu8(__surge_scratch, pos2, if value.root.inner.inner.flag then 1 else 0)
local s3 = value.root.inner.inner.leaf.name
-- ...
buffer.writef32(__surge_scratch, pos6, value.root.inner.inner.leaf.weight)
local s7 = value.root.label
```

Its writes made 20 property reads a call. The hand-written codec in
`tests/src/bench/baseline/codecs.luau` binds `root`, `second`, `third` and
`leaf` once and makes 10. With Transformer 5.23 in
[specs/transformer.md](../specs/transformer.md), each nested object of more
than one property reads its value once:

```luau
local obj1 = value.root
local obj2 = obj1.inner
-- ...
buffer.writeu16(__surge_scratch, pos3, obj2.count)
local obj4 = obj2.inner
-- ...
buffer.writeu8(__surge_scratch, pos5, if obj4.flag then 1 else 0)
local obj6 = obj4.leaf
```

The writes now make 10 property reads, as the hand-written codec's do. The
size expression that creates the result (Transformer 5.20) still reads its two
strings through the whole path, seven property reads, before the writes. A
nested object in a run of fixed-size properties (Transformer 5.5) binds
nothing, since a run's locals are counted by property.

## Method

**Builds.** The reference is surge `2310f16` and rbxts-transformer-surge
`5c41f27`; the change is surge `44a6d4a` and rbxts-transformer-surge `fcc7a9c`.
Each build of `tests/` was compiled from scratch, and the compiled fixture
modules differ only in `nested-object.luau`, and in it only in `serialize`. No
other row's code changed, so the other fifteen encode rows and every decode
row are controls.

**Runs.** Three full invocations of `mise run bench:speed` on 2026-09-27,
each two Studio runs back to back with nine trials per cell per run: the
reference from 02:06 to 02:14, the change from 02:14 to 02:23, and the
reference build again from 02:23 to 02:32. The CPU load before each was 2% to
5%, and no other game or Studio session was open.

**Reading.** As in [exact-sizing.md](exact-sizing.md): the recorder's median,
spread and noise mark, the change's surge median over the reference's, the
drift `D` over the row's quiet control cells, and time saved per call as
`1/reference − 1/change`. The change is read against the second reference.

## Results

### The references and the floor

The second reference ran at 0.989× the first on the quiet control cells on
encode, and 0.987× on decode: the machine ran about 1% slower after the first
run. The change ran at 0.999× the second reference on encode, quartiles
[0.993, 1.007] over 43 cells, and 1.001× on decode, [0.991, 1.004] over 42.

The fourteen readable encode rows the change did not reach moved between
0.952× and 1.028× against the second reference, quartiles [0.999, 1.006]. The
bottom is `Blink: Entities`, whose change cell spread 6.6%, and the top the
small flat struct. `Blink: Booleans` is not read
([per-element-encode.md](per-element-encode.md)). On decode, where no row
changed, the fifteen quiet rows moved between 0.980× and 1.011×.

### The changed row

Encode, from `data/before-nested-object-values-second-run.tsv` and the
change's trials file:

| Row                  | Reference     | Change        | Ratio | `D`       | Adjusted | Saved per call | Against the first reference |
| -------------------- | ------------- | ------------- | ----- | --------- | -------- | -------------- | --------------------------- |
| deeply nested object | 4211.8k ±1.5% | 4421.4k ±1.9% | 1.050 | 1.010 (4) | 1.039    | 11.3 ns        | 1.049                       |

Time saved is from the raw medians. The row's decode, which did not change,
moved 0.991×.

### The gap to hand-written Luau

surge's encode against the baseline column on that row:

| Run              | Behind the baseline by | Baseline over surge |
| ---------------- | ---------------------- | ------------------- |
| First reference  | 27.6 ns                | 1.132×              |
| Second reference | 26.4 ns                | 1.125×              |
| Change           | 17.1 ns                | 1.082×              |

## Discussion

The row is the highest readable one, 2.2 points past the top of its floor and
4.4 past the floor's upper quartile. The change removed ten property reads a
call, and saved 11 ns, about one nanosecond a read.

What is left of the gap, 17 ns, is in what surge still does and the
hand-written codec does not:

- the size expression reads the two strings through the whole path, seven
  property reads, and takes their lengths, which the writes take again;
- six reservations, each a read and a move of the cursor, where the
  hand-written codec writes at offsets it computes from the two lengths.

Binding the object locals before the size, so the size reads them, would
remove the seven reads. It moves the bindings ahead of the result's creation,
which is a larger change to how `serialize` is laid out. It was not tried.

What this does not reach:

- A nested object inside a run still reads its path per property, and what
  binding it would be worth was not measured.
- The fixtures run native. What the change is worth interpreted was not run.

## Conclusion

Reading a nested object's value once made the deeply nested object's encode
1.050× as fast, 11 ns a call, and brought it from 26 ns to 17 ns a call behind
hand-written Luau writing the same bytes.

## Data

- `data/before-nested-object-values.md` and `.tsv`: the first reference, at
  surge `2310f16` and rbxts-transformer-surge `5c41f27`.
- `data/before-nested-object-values-second-run.md` and `.tsv`: the second
  reference, at the same commits.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `6e62961`,
  recorded at surge `44a6d4a` and rbxts-transformer-surge `fcc7a9c`.
- The figures above were computed from the three `.tsv` files, with the
  recorder's own median, spread and noise rule.
