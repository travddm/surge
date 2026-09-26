# One reservation for an array's elements

2026-09-26 · surge `32cf20d` · rbxts-transformer-surge `42ce64d` · Roblox
0.740.19.7400931

## Abstract

An array of fixed-size elements used to reserve each element's bytes inside
its loop. Transformer 5.18 reserves them all once, ahead of the loop. One full
catalog run before the change and one after, in the same session, were
compared on the five rows whose generated code changed, against eleven rows
whose generated code did not, which moved between 0.973× and 1.019×. Encode
ran 2.20× as fast on the thousand-element `u16` array, 1.34× on
`Blink: Booleans` and 1.09× on `Blink: Entities`, and decode 1.12× as fast on
the enum-heavy row. The unpacked `CFrame` array moved about as much as the
unchanged rows, so its per-element gap to hand-written Luau is not the
reservation.

## Background

The gap between surge's encode and a hand-written Luau codec has a part paid
once per call and a part paid per element, which is most of it on the
fifty-element `CFrame` array
([generated-code-against-hand-written.md](generated-code-against-hand-written.md)
and its correction). One candidate for the per-element part was the
reservation each element made. On the thousand-element `u16` array, the
generated `serialize()` wrote each element like this:

```luau
for _, item3 in arr1 do
    local pos4 = __surge_cursor
    __surge_cursor = pos4 + 2
    if __surge_cursor > __surge_capacity then
        __surge_scratch = __surge_grow(__surge_scratch, pos4, __surge_cursor)
        __surge_capacity = buffer.len(__surge_scratch)
    end
    buffer.writeu16(__surge_scratch, pos4, item3)
end
```

The cursor and the capacity are upvalues of the generated functions
(Transformer 5.3 in [specs/transformer.md](../specs/transformer.md)). The read
side moved the read cursor the same way, and under `readChecks` compared it
with the input's length, once per element. With Transformer 5.18, one
reservation of the count times the element's size comes before the loop, and
the loop moves a local of its own:

```luau
local element5 = pos4
for _, item3 in arr1 do
    buffer.writeu16(__surge_scratch, element5, item3)
    element5 += 2
end
```

## Method

**Builds.** The reference is surge `02efefc` and rbxts-transformer-surge
`125ed38`; the change is surge `32cf20d` and rbxts-transformer-surge
`42ce64d`. The benchmark catalog and the adapters are the same in both. Both
builds of `tests/` were compiled from scratch, and their compiled Luau
differs in five fixtures:

| Row               | Element                                     | Elements |
| ----------------- | ------------------------------------------- | -------- |
| large array       | `u16`                                       | 1000     |
| `Blink: Booleans` | `boolean`                                   | 1000     |
| `Blink: Entities` | an object of six `u8`                       | 100      |
| `CFrame` array    | an unpacked `CFrame`                        | 50       |
| enum-heavy        | an `Enum.Material`, beside two scalar enums | 100      |

surge's code on every other row is the same text in both builds. So is fbs's
and serio's on every row but the small flat struct, where their Flamework
transformer listed the struct's fields in a different order in the two builds.

**Runs.** One full invocation of `mise run bench:speed` per build, each two
Studio runs back to back with nine trials per cell per run, on 2026-09-26: the
reference from 02:50 to 02:58, the change from 03:05 to 03:14. No Studio
session or Roblox Player was open before either. Nothing else on the machine
was controlled, and nothing else was run during either invocation.

**Reading.** A cell's median, spread and noise mark are the recorder's. A
row's result is the change's surge median over the reference's, per half.
It is also read drift-adjusted: `D` is the median change-over-reference ratio
of the row's quiet control cells, and the adjusted ratio is the raw one over
`D`. Time saved per call is `1/reference − 1/change`, and per element that
over the element count. A cell marked noisy in either run is not read.

**Controls.** Two. The fbs, serio, Blink and baseline columns, which neither
change touches; fbs and serio are left out on the small flat struct, whose
code differs between the builds. And the eleven rows whose surge code is the
same in both builds, which are the floor: how far a surge cell moves between
these two invocations with no change to what it runs.

## Results

### The floor

The eleven unchanged rows, surge's change-over-reference ratio, from
`data/before-one-reservation-per-array.tsv` and the change's trials file:

| Half   | Rows     | Lowest | First quartile | Median | Third quartile | Highest |
| ------ | -------- | ------ | -------------- | ------ | -------------- | ------- |
| encode | 11 of 11 | 0.986  | 0.992          | 1.010  | 1.014          | 1.019   |
| decode | 11 of 11 | 0.973  | 0.994          | 1.001  | 1.006          | 1.016   |

Over every row, the quiet control cells read 1.002× on encode, quartiles
[0.994, 1.009] over 42 cells, and 0.995× on decode, [0.991, 1.001] over 42.
The column medians were fbs 1.008×, serio 1.001×, Blink 0.989× and the
baseline 1.003× on encode, and 0.996×, 0.998×, 0.995× and 0.989× on decode.

### The changed rows

Each cell is the median in values per second, with the middle half of its
trials as a fraction of it. `D` is the row's control drift, with the number
of control cells it is taken over.

Encode:

| Row               | Reference    | Change       | Ratio | `D`       | Adjusted | Saved per call | Per element |
| ----------------- | ------------ | ------------ | ----- | --------- | -------- | -------------- | ----------- |
| large array       | 124.1k ±2.2% | 272.4k ±2.8% | 2.195 | 0.994 (3) | 2.209    | 4.39 µs        | 4.4 ns      |
| `Blink: Booleans` | 133.3k ±2.0% | 178.3k ±4.3% | 1.337 | 1.000 (2) | 1.337    | 1.89 µs        | 1.9 ns      |
| `Blink: Entities` | 412.8k ±6.6% | 449.8k ±3.4% | 1.090 | 1.013 (3) | 1.075    | 0.20 µs        | 2.0 ns      |
| `CFrame` array    | 228.6k ±1.7% | 231.5k ±2.2% | 1.013 | 1.002 (4) | 1.011    | 0.05 µs        | 1.1 ns      |
| enum-heavy        | 278.9k ±2.2% | 286.2k ±1.6% | 1.026 | 0.995 (2) | 1.031    | 0.09 µs        | 0.9 ns      |

Decode:

| Row               | Reference    | Change       | Ratio  | `D`       | Adjusted | Saved per call | Per element |
| ----------------- | ------------ | ------------ | ------ | --------- | -------- | -------------- | ----------- |
| large array       | 59.6k ±9.4%  | 60.3k ±22.0% | 1.012† | 0.994 (3) | —        | —              | —           |
| `Blink: Booleans` | 58.4k ±6.4%  | 60.5k ±22.3% | 1.036† | 0.995 (3) | —        | —              | —           |
| `Blink: Entities` | 60.7k ±3.8%  | 60.9k ±2.6%  | 1.003  | 0.989 (3) | 1.015    | 0.05 µs        | 0.5 ns      |
| `CFrame` array    | 130.1k ±2.8% | 134.0k ±3.4% | 1.031  | 1.001 (4) | 1.030    | 0.23 µs        | 4.6 ns      |
| enum-heavy        | 447.9k ±2.6% | 499.4k ±1.8% | 1.115  | 0.980 (2) | 1.137    | 0.23 µs        | 2.3 ns      |

† the change's cell spread by more than 10%, and the row is not read. Time
saved is from the raw medians.

### The gap to hand-written Luau

On the `CFrame` array, the one changed row the baseline covers, the baseline
encoded 264.7k values per second in the reference and 265.4k in the change.
surge's encode trailed it by 0.60 µs per call before and 0.55 µs after.

## Discussion

Four readings are outside the floor. The large array and `Blink: Booleans`
encode by 2.20× and 1.34×, and `Blink: Entities` by 1.09×, where no unchanged
row moved past 1.019×. The enum-heavy decode, at 1.115×, is outside the
decode floor's 1.016× by as much. The enum-heavy encode, at 1.026×, is past
the floor's highest row by less than a point, which one invocation of each
build cannot separate from noise. Neither can the `CFrame` array's decode, at
1.031×.

What an element saves is not a constant. It is 4.4 ns on the `u16` array and
1.1 ns, within the floor, on the `CFrame` array's encode, although both
compiled loops lost the same reservation. The loop whose body is otherwise one
`buffer.writeu16` gains the most. An element that calls `ToAxisAngle` and
multiplies a `Vector3` gains nothing this run can see. The enum-heavy row's
encode looks each element's name up in a table, which the change leaves
alone, and its decode, which reads an index and indexes an array, gains more.

So the per-element part of the `CFrame` array's gap to hand-written Luau is
not the reservation: the gap moved by 0.05 µs of 0.60 µs, inside the floor.
What it is was not probed.

The two thousand-element decode rows cannot be read. Their cells spread by
22% in the change run, and the same two rows were the noisy decode rows in
[read-checks-cost.md](read-checks-cost.md).

What this does not reach:

- One invocation of each build, and no second reference. The eleven unchanged
  rows stand in for one: they ran the same code in both invocations, beside
  the rows that changed.
- The reference ran first and the change second. The control columns say the
  machine moved by under one percent between them.
- `readChecks` is not measured. Under it the change also removes a comparison
  per element on the read side, and the catalog has no checked column.
- The fixtures run native (Benchmark harness 4.6 in
  [specs/benchmark-harness.md](../specs/benchmark-harness.md)). What the
  change is worth interpreted was not run.
- A tuple's rest element still reserves per element, and no catalog row has
  one.

## Conclusion

Reserving an array's fixed-size elements once, ahead of the loop, made encode
2.20× as fast on a thousand `u16`s, 1.34× on a thousand booleans and 1.09× on
a hundred six-byte objects, and decode 1.12× as fast on a hundred enum items,
against a floor of 0.973× to 1.019× on the rows it did not change. The
unpacked `CFrame` array moved within the floor, so the per-element part of its
gap to hand-written Luau lies elsewhere.

## Data

- `data/before-one-reservation-per-array.md` and
  `data/before-one-reservation-per-array.tsv`: the reference, recorded at
  surge `02efefc` and rbxts-transformer-surge `125ed38`.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `92b1350`,
  recorded at surge `32cf20d` and rbxts-transformer-surge `42ce64d`.
- The figures above were computed from the two `.tsv` files, with the
  recorder's own median, spread and noise rule.
