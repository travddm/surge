# What readChecks costs

2026-09-25 · surge `c295e5b` · rbxts-transformer-surge `ac69b4d` · Roblox
0.740.19.7400931

## Abstract

`readChecks` bounds every read of an untrusted input, and was documented as
costing a branch per read, unmeasured. One full speed invocation drove every
catalog row through a second surge codec built with `readChecks: true`,
beside the unchecked one. Over the 14 rows quiet enough to read, checked
decode ran at 0.957× the unchecked throughput, and between 0.922× and 0.991×
per row. The encode halves, which run the same generated code in both
columns, read 1.001×, and between 0.965× and 1.024× per row, which is how far
one row's ratio moves with no change at all. On the four rows that decode in
under 1 µs, the checks added 11 to 35 ns per call.

## Background

With `readChecks`, a generated `deserialize` takes `unknown` and checks the
input's shape before it reads, takes one `buffer.len` per call, bounds every
read-side reservation against it, and bounds the count ahead of an `array`,
a `dict` or a tuple's rest, an `enum` index and a packed `CFrame` header
(Transformer 5.10, 5.12 and 5.17 in
[specs/transformer.md](../specs/transformer.md)). It is meant for a server
reading what clients send ([errors-and-guarantees.md](../errors-and-guarantees.md)),
and whether it was worth its cost there had no number behind it.

## Method

**Harness.** The speed tier as it stood at surge `c295e5b`, which gave every
catalog row a `surge (readChecks)` column: the row's surge declaration again,
through `createCodec<T>({ readChecks: true })` and surge's adapter, taking its
turn among the row's columns like any other (Benchmark harness 4.9 in
[specs/benchmark-harness.md](../specs/benchmark-harness.md) at that commit).

**Run.** One invocation, `mise run bench:speed`: two Studio runs back to back,
nine trials per cell per run, on 2026-09-25, with neither tree changed and no
Studio session open beforehand. Nothing else on the machine was controlled.

**Reading.** A row's cost is the checked column's median over surge's, per
half, with medians, spreads and the noise rule as the recorder computes them.
A row whose cell is marked noisy in either column is left out, and the figure
over rows is the geometric mean. On the rows where an unchecked decode takes
under 1 µs, the cost is also read as nanoseconds added per call,
`1/checked − 1/unchecked`.

**Control.** The encode half. `readChecks` changes only the read side, so the
two columns' encode runs identical generated code, and their ratio shows how
far a ratio moves within one run when nothing changed.

## Results

Decode, from `data/read-checks-column.tsv`. Each cell is the median in values
per second, with the middle half of its trials as a fraction of it.

| Row                                 | unchecked     | checked       | ratio  | added per call |
| ----------------------------------- | ------------- | ------------- | ------ | -------------- |
| small flat struct                   | 5481.0k ±2.8% | 5162.3k ±2.7% | 0.942  | 11.3 ns        |
| deeply nested object                | 2448.7k ±1.9% | 2256.7k ±1.4% | 0.922  | 34.8 ns        |
| wide struct                         | 698.0k ±2.0%  | 686.3k ±1.4%  | 0.983  | —              |
| large array                         | 57.3k ±15.8%  | 56.2k ±15.4%  | 0.980† | —              |
| large record                        | 71.2k ±0.8%   | 66.2k ±0.8%   | 0.930  | —              |
| string-heavy                        | 183.0k ±1.1%  | 173.7k ±0.9%  | 0.949  | —              |
| enum-heavy                          | 437.9k ±2.7%  | 412.5k ±3.0%  | 0.942  | —              |
| tagged union                        | 83.8k ±1.8%   | 81.9k ±1.3%   | 0.978  | —              |
| guarded union                       | 269.2k ±1.3%  | 260.0k ±2.0%  | 0.966  | —              |
| toggles (unpacked)                  | 2731.7k ±2.4% | 2594.9k ±2.0% | 0.950  | 19.3 ns        |
| toggles (packed)                    | 1543.8k ±1.4% | 1497.3k ±3.8% | 0.970  | 20.1 ns        |
| CFrame array                        | 127.5k ±2.3%  | 126.4k ±1.8%  | 0.991  | —              |
| CFrame array (packed, axis-aligned) | 220.9k ±1.4%  | 205.4k ±1.0%  | 0.930  | —              |
| CFrame array (packed, arbitrary)    | 112.1k ±2.3%  | 107.6k ±1.3%  | 0.960  | —              |
| Blink: Booleans                     | 56.1k ±17.7%  | 54.3k ±19.4%  | 0.967† | —              |
| Blink: Entities                     | 57.7k ±4.8%   | 56.9k ±6.3%   | 0.986  | —              |

† a cell spread or drifted by more than 10%, and the row is left out of the
mean. `—` in the last column is a row whose unchecked decode takes 1 µs or
more.

| Half   | Geometric mean | Rows     | Lowest row | Highest row |
| ------ | -------------- | -------- | ---------- | ----------- |
| decode | 0.957×         | 14 of 16 | 0.922×     | 0.991×      |
| encode | 1.001×         | 15 of 16 | 0.965×     | 1.024×      |

The encode row is the control. Its one noisy row is `Blink: Booleans`, whose
checked encode spread by 15.4%.

## Discussion

Every row's decode reads below 1.00×, and the mean, 0.957×, sits well outside
the control's 1.001×: `readChecks` costs about 4% of a decode on this
catalog. A single row is weaker evidence. The control moves one row by as much
as 3.5% with no change, so a row's decode from about 0.965× upward cannot be
told from no cost on its own. The eight rows below it show it alone: the flat
struct, the nested object, the large record, `string-heavy`, the enum-heavy
row, the unpacked toggles and both packed `CFrame` rows. On the four fast
rows the cost is 11 to 35 ns a call, a size consistent with one shape check,
one `buffer.len` and a compare per reservation.

What this does not reach:

- The inputs are valid. It measures what the checks cost on the path that
  accepts, not a rejection, which ends a call early.
- One invocation on one machine. The figure's own spread is the control's.
- The fixtures run native (Benchmark harness 4.6). What the checks cost
  interpreted was not run.
- `writeChecks` is not measured. No catalog row has a narrowed or exact
  `DataType.Length` or a `DataType.Range`, so `writeChecks` would generate
  nothing on any of them.
- The catalog's shapes are not a game's, and what the checks add depends on
  how many reservations and counts a shape reads.

## Conclusion

On the benchmark catalog, `readChecks` costs a decode about 4%, between
0.922× and 0.991× of the unchecked throughput per row, and 11 to 35 ns a call
where a decode takes under 1 µs. Encode is unaffected. The speed tier carries
no checked column after this run, so this is the measurement.

## Data

- `data/read-checks-column.md` and `data/read-checks-column.tsv`: the table
  and every trial behind it, as recorded at surge `c295e5b` and
  rbxts-transformer-surge `ac69b4d` and committed at surge `e931e1b` as
  `docs/benchmarks/speed.md` and `docs/benchmarks/speed-trials.tsv`.
- The figures above were computed from the `.tsv`, with the recorder's own
  median, spread and noise rule.
