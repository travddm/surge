# Per-element encode

2026-09-27 · surge `b8c3206` and `e2deaf7` · rbxts-transformer-surge `2ac49da`
and `ff2f6ec` · Roblox 0.740.19.7400931

## Abstract

Two changes to the work an array's encode does per element, each measured on
its own. Reading a `CFrame`'s `Position` once per element, rather than once
for each of its three components, made the `CFrame` array's encode 1.107× as
fast against a reference run of the build before it, 8.0 ns less per element.
That row now encodes within 12 ns a call of a hand-written Luau codec writing
the same bytes, where it was 463 ns behind. Writing an array with a numeric
`for` that reads each element at its index, rather than a generic `for`, made
the large array's encode 0.887× as fast and `Blink: Entities` 0.943×, and
moved no row beyond noise the other way. The first change stays; the second
was reverted.

## Background

The generated `serialize()` of the `CFrame` array wrote each element's
position by reading `Position` three times:

```luau
for _, item3 in arr1 do
    buffer.writef32(__surge_scratch, element5, item3.Position.X)
    buffer.writef32(__surge_scratch, element5 + 4, item3.Position.Y)
    buffer.writef32(__surge_scratch, element5 + 8, item3.Position.Z)
    local axis6, angle7 = item3:ToAxisAngle()
    -- ... the rotation ...
```

The hand-written codec in `tests/src/bench/baseline/codecs.luau` reads it once
into a local, and walks the array with a numeric `for`. Those were the two
differences
[generated-code-performance.md](../future-work/generated-code-performance.md)
named as the candidates for the per-element gap on this row, once the
reservation per element had been ruled out
([one-reservation-per-array.md](one-reservation-per-array.md)).

The first change, A, reads the position into a local:

```luau
local position7 = item4.Position
buffer.writef32(__surge_scratch, element6, position7.X)
buffer.writef32(__surge_scratch, element6 + 4, position7.Y)
buffer.writef32(__surge_scratch, element6 + 8, position7.Z)
```

The second, B, took the array's length once and wrote the elements by index,
as the hand-written codec does:

```luau
local len2 = #arr1
-- ... the count and the reservation, from len2 ...
for i3 = 1, len2 do
    local item4 = arr1[i3]
```

## Method

**Builds.** The reference is surge `9e1b56c` and rbxts-transformer-surge
`1fd8950`. A is surge `b8c3206` and rbxts-transformer-surge `2ac49da`. A and
B together are surge `e2deaf7` and rbxts-transformer-surge `ff2f6ec`. Each
build of `tests/` was compiled from scratch, and the compiled fixture modules
were compared file by file. A changed one module, and in it only the
`serialize` of the unpacked `CFrame` array. B changed the `serialize` of ten
rows: the large array, the string-heavy, enum-heavy, tagged-union and
guarded-union rows, the three `CFrame` arrays, `Blink: Booleans` and
`Blink: Entities`. Neither changed a `deserialize`.

**Runs.** Four full invocations of `mise run bench:speed` on 2026-09-27, each
two Studio runs back to back with nine trials per cell per run: the
reference from 00:53 to 01:02, A from 01:02 to 01:10, A and B from 01:11 to
01:19, and the reference build again from 01:19 to 01:28. The CPU load
between runs was 3% to 4%, and no other game or Studio session was open.
An earlier attempt at the same four runs was discarded after its second
run: a game running alongside it held 42% of the CPU, and the two Studio runs
of one invocation disagreed by 17% on every column, the untouched libraries
too.

**Reading.** As in [exact-sizing.md](exact-sizing.md): the recorder's median,
spread and noise mark, the change's surge median over the reference's, the
drift `D` over the row's quiet control cells, and time saved per call as
`1/reference − 1/change`. A is read against the second reference. B is read
against A, the run next to it that differs from it only by B, with the second
reference as a check.

**Controls.** The fbs, serio, Blink and baseline columns; for each change, the
encode rows it did not change, which are its floor; and surge's decode.

## Results

### The references and the floors

The second reference ran at 0.998× the first on the quiet control cells on
encode, and 1.002× on decode. A ran at 0.997× the second reference on encode,
quartiles [0.991, 1.006] over 43 cells, and B at 0.999× A, [0.993, 1.008] over 43.

A's floor: the fourteen readable encode rows it did not change moved between
0.962× and 1.039× against the second reference. The top is `Blink: Entities`,
whose reference cell spread 7.6%, and the bottom the arbitrary packed `CFrame`
array. B's floor: the six encode rows it did not change moved between 0.985×
and 1.015× against A.

### A: the position read once

Encode, from `data/before-per-element-encode-second-run.tsv` and A's trials
file:

| Row            | Elements | Reference    | A            | Ratio | `D`       | Adjusted | Saved per call | Saved per element | Against the first reference |
| -------------- | -------- | ------------ | ------------ | ----- | --------- | -------- | -------------- | ----------------- | --------------------------- |
| `CFrame` array | 50       | 243.9k ±1.3% | 270.2k ±0.6% | 1.107 | 0.986 (4) | 1.124    | 0.40 µs        | 8.0 ns            | 1.098                       |

surge's encode against the baseline column on that row:

| Run              | Behind the baseline by | Baseline over surge |
| ---------------- | ---------------------- | ------------------- |
| First reference  | 354.8 ns               | 1.096×              |
| Second reference | 462.6 ns               | 1.127×              |
| A                | 11.6 ns                | 1.003×              |

### B: the loop by index

Encode against A, from A's trials file and
`data/per-element-encode-index-loop.tsv`:

| Row                                   | Elements | A             | A and B      | Ratio  | `D`       | Adjusted | Per call | Against the second reference |
| ------------------------------------- | -------- | ------------- | ------------ | ------ | --------- | -------- | -------- | ---------------------------- |
| large array                           | 1000     | 332.7k ±1.9%  | 295.2k ±5.7% | 0.887  | 1.001 (3) | 0.887    | +0.38 µs | 0.881                        |
| `Blink: Entities`                     | 100      | 559.1k ±2.7%  | 527.3k ±1.1% | 0.943  | 1.007 (3) | 0.936    | +0.11 µs | 0.980                        |
| tagged union                          | 100      | 306.2k ±1.8%  | 300.4k ±2.5% | 0.981  | 1.004 (3) | 0.977    | +0.06 µs | 1.006                        |
| string-heavy                          | 100      | 314.3k ±1.8%  | 311.7k ±1.0% | 0.992  | 0.994 (3) | 0.998    | +0.03 µs | 0.988                        |
| enum-heavy                            | 100      | 290.3k ±2.3%  | 293.3k ±2.5% | 1.010  | 0.997 (2) | 1.014    | −0.03 µs | 1.002                        |
| guarded union                         | 100      | 491.7k ±1.9%  | 500.5k ±1.8% | 1.018  | 0.999 (2) | 1.019    | −0.04 µs | 1.028                        |
| `CFrame` array                        | 50       | 270.2k ±0.6%  | 273.1k ±1.2% | 1.011  | 1.001 (4) | 1.010    | −0.04 µs | 1.119                        |
| `CFrame` array (packed, axis-aligned) | 50       | 195.2k ±0.8%  | 195.5k ±2.1% | 1.002  | 1.007 (2) | 0.995    | −0.01 µs | 1.007                        |
| `CFrame` array (packed, arbitrary)    | 50       | 140.7k ±1.0%  | 142.3k ±1.8% | 1.012  | 1.005 (2) | 1.006    | −0.08 µs | 0.973                        |
| `Blink: Booleans`                     | 1000     | 185.1k ±28.3% | 159.0k ±2.8% | 0.859† | 1.003 (2) | —        | —        | 0.822†                       |

Per call is the time the change added, from the raw medians. The large
array's two Studio runs agree: 337k and 332k a second with A, 295k and 294k
with A and B. The column against the second reference includes A on the
`CFrame` array.

† `Blink: Booleans` is not read. Its encode lands in one of two modes per
Studio run, about 157k to 177k a second or about 215k: the first reference
ran one of each, A one of each, the second reference one of each, and A and B
the lower mode twice. A cell that pools a run of each mode is past the
recorder's spread rule, which is also why cells of this row's encode were
marked in the last two rounds.

## Discussion

A is past its floor, whose top is 1.039×, by seven points, and it is the only
row A changed. What it removed is two reads of `Position` per element, a
property of a Roblox userdata that the engine answers on every read, and the
two came to 8 ns an element. With them gone, the `CFrame` array's encode is
within 0.3% of the hand-written codec's, where that codec's own cell moved 2%
between the two references.

B made two rows slower, both outside its floor: the large array, a thousand
`u16`s, by 0.38 ns an element, and `Blink: Entities`, a hundred structs of six
`u8`s, by 1.1 ns an element. Both are rows whose element write is a few
buffer writes. On rows whose element costs more, a string, an enum's index,
a union's branch or a `CFrame`, B's difference is inside the floor. A generic
`for` over a plain array runs faster in native code than a numeric `for` that
indexes it, where the element is cheap, and the numeric `for` gained nothing
where it is not. The hand-written codec's numeric `for` was not what put it
ahead of surge on the `CFrame` array: the position reads were.

B was reverted, and with it two things it carried:

- It wrote an array whose length includes a `nil` element, which the generic
  `for` skips while the count includes it. An array with a hole in it stays
  unsupported ([errors-and-guarantees.md](../errors-and-guarantees.md)), and
  the loop by index that would support it costs the 12% above on a thousand
  `u16`s.
- It took the array's length once for the count, the reservation and the
  loop. That was measured only together with the loop.

What B also carried, and what stays, is a cast of an element read at an index
to its type, on the exact form of an `array` (Transformer 5.22 in
[specs/transformer.md](../specs/transformer.md)). It changes no Luau, and it
fixes a type error the exact form's generated code had under a consumer's
`noUncheckedIndexedAccess`.

What this does not reach:

- The fixtures run native. Interpreted, the generic `for` and the numeric one
  may compare differently, and that was not run.
- `Blink: Booleans`, whose encode no run here can read.

## Conclusion

Reading a `CFrame`'s position once per element made the `CFrame` array's
encode 1.107× as fast and closed its gap to hand-written Luau from 463 ns to
12 ns a call. Writing an array by index instead of with a generic `for` made
encode slower where the element is cheap, up to 0.887× on a thousand `u16`s,
and was reverted.

## Data

- `data/before-per-element-encode.md` and `.tsv`: the first reference, at
  surge `9e1b56c` and rbxts-transformer-surge `1fd8950`.
- `data/before-per-element-encode-second-run.md` and `.tsv`: the second
  reference, at the same commits.
- A: `docs/benchmarks/speed.md` and `docs/benchmarks/speed-trials.tsv` as
  committed at surge `1cf1b3d`, recorded at surge `b8c3206` and
  rbxts-transformer-surge `2ac49da`. The build at surge `8f841e0` and
  rbxts-transformer-surge `3260841`, after the revert, compiles every fixture
  module to the same bytes.
- A and B: `data/per-element-encode-index-loop.md` and `.tsv`, at surge
  `e2deaf7` and rbxts-transformer-surge `ff2f6ec`, which the next commits of
  both repositories revert.
- The figures above were computed from the four `.tsv` files, with the
  recorder's own median, spread and noise rule.
