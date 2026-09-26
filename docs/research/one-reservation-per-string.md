# One reservation for a string's count and bytes

2026-09-26 · surge `9105932` · rbxts-transformer-surge `ba1331a` · Roblox
0.740.19.7400931

## Abstract

A `str` or a `buffer` with a count reserved the count and then its bytes, two
reservations where one covers both; Transformer 5.19 makes one. A full
catalog run of the change was read against a reference run of the build
before it, taken after the change in the same session, on the seven rows
whose generated code changed; the rows whose code did not change moved
between 0.976× and 1.005×. Encode ran 1.155× as fast on the large record, a
dictionary of 200 string keys, 1.124× on `string-heavy` and 1.074× on the
guarded union: 3.5 to 4.8 ns per string on every row with more than one.
Decode gained 1.014× to 1.033× on the same three rows, 1.2 to 2.2 ns per
string. A first reference, taken before the change, ran about 3% slower on
every column, including those the change did not touch.

## Background

The generated `serialize()` wrote a counted string like this, on `Basic.name`:

```luau
local s3 = value.name
local pos4 = __surge_cursor
__surge_cursor = pos4 + 4
if __surge_cursor > __surge_capacity then
    __surge_scratch = __surge_grow(__surge_scratch, pos4, __surge_cursor)
    __surge_capacity = buffer.len(__surge_scratch)
end
buffer.writeu32(__surge_scratch, pos4, #s3)
local pos5 = __surge_cursor
__surge_cursor = pos5 + #s3
if __surge_cursor > __surge_capacity then
    __surge_scratch = __surge_grow(__surge_scratch, pos5, __surge_cursor)
    __surge_capacity = buffer.len(__surge_scratch)
end
buffer.writestring(__surge_scratch, pos5, s3)
```

With Transformer 5.19 in [specs/transformer.md](../specs/transformer.md), the
length is taken once and one reservation covers the count and the bytes:

```luau
local s3 = value.name
local len4 = #s3
local pos5 = __surge_cursor
__surge_cursor = pos5 + (len4 + 4)
if __surge_cursor > __surge_capacity then
    __surge_scratch = __surge_grow(__surge_scratch, pos5, __surge_cursor)
    __surge_capacity = buffer.len(__surge_scratch)
end
buffer.writeu32(__surge_scratch, pos5, len4)
buffer.writestring(__surge_scratch, pos5 + 4, s3)
```

The read side cannot size the bytes before it reads the count, so it keeps two
steps, but it moves the read cursor once, to `pos + 4 + len`, where it moved
it twice.

## Method

**Builds.** The reference is surge `f2d6437` and rbxts-transformer-surge
`b6f19d1`; the change is surge `9105932` and rbxts-transformer-surge
`ba1331a`. The catalog and the adapters are the same in both. Both builds of
`tests/` were compiled from scratch. surge's code differs between them in
seven rows, and fbs's, serio's and Blink's in none:

| Row                  | Strings in the value                  |
| -------------------- | ------------------------------------- |
| deeply nested object | 2                                     |
| `string-heavy`       | 102: a title, an author and 100 lines |
| large record         | 200: the dictionary's keys            |
| tagged union         | 22: the `chat` events among 100       |
| guarded union        | 32: the string members among 100      |
| toggles (unpacked)   | 1: the optional `label`               |
| toggles (packed)     | 1: the optional `label`               |

The two unions' counts were found by replaying the fixtures' seeded
generator, and the tagged union's replay predicts its recorded size in
[benchmarks/size.md](../benchmarks/size.md) to the byte.

**Runs.** Three full invocations of `mise run bench:speed` on 2026-09-26,
each two Studio runs back to back with nine trials per cell per run: the
reference from 03:50 to 03:58, the change from 04:06 to 04:14, and the
reference build again from 04:15 to 04:23. No Studio session or Roblox Player
was open before any of them, and nothing else was run during them.

**Reading.** As in [one-reservation-per-array.md](one-reservation-per-array.md):
the recorder's median, spread and noise mark, the change's surge median over
the reference's, the drift `D` over the row's quiet control cells, and time
saved per call as `1/reference − 1/change`, here also per string.

**Controls.** The fbs, serio, Blink and baseline columns, and the nine rows
whose surge code is the same in both builds, which are the floor.

## Results

### The two references

The second reference over the first, from
`data/before-one-reservation-per-string.tsv` and
`data/before-one-reservation-per-string-second-run.tsv`:

| Half   | Quiet control cells        | Unchanged surge rows, lowest to highest |
| ------ | -------------------------- | --------------------------------------- |
| encode | 1.026× [1.019, 1.035] (43) | 1.011× to 1.052×, median 1.033× (15)    |
| decode | 1.039× [1.031, 1.050] (44) | 1.034× to 1.074×, median 1.055× (14)    |

The same build ran about 3% faster in the second reference than in the
first, on every library's column. The change's run sits with the second: its
quiet control cells read 0.998× of the second reference's on both halves,
[0.989, 1.007] over 43 cells on encode and [0.992, 1.004] over 44 on decode.
The results below are read against the second reference.

### The floor

The nine unchanged rows, the change over the second reference, noisy cells
left out:

| Half   | Rows   | Lowest | First quartile | Median | Third quartile | Highest |
| ------ | ------ | ------ | -------------- | ------ | -------------- | ------- |
| encode | 7 of 9 | 0.976  | 0.989          | 0.995  | 0.997          | 1.004   |
| decode | 7 of 9 | 0.985  | 0.986          | 0.988  | 0.995          | 1.005   |

`Blink: Booleans` is noisy in both halves, `Blink: Entities` in encode and the
large array in decode.

### The changed rows

Encode:

| Row                  | Reference     | Change        | Ratio | `D`       | Adjusted | Saved per call | Per string |
| -------------------- | ------------- | ------------- | ----- | --------- | -------- | -------------- | ---------- |
| deeply nested object | 3594.9k ±1.8% | 3706.0k ±2.8% | 1.031 | 1.004 (4) | 1.026    | 8 ns           | 4.2 ns     |
| large record         | 144.0k ±2.7%  | 166.4k ±1.4%  | 1.155 | 0.987 (3) | 1.171    | 0.93 µs        | 4.7 ns     |
| `string-heavy`       | 276.5k ±1.6%  | 310.7k ±2.2%  | 1.124 | 0.998 (3) | 1.126    | 0.40 µs        | 3.9 ns     |
| tagged union         | 292.5k ±1.4%  | 299.3k ±3.4%  | 1.023 | 0.997 (3) | 1.027    | 78 ns          | 3.5 ns     |
| guarded union        | 448.7k ±2.2%  | 481.8k ±5.7%  | 1.074 | 0.995 (1) | 1.079    | 0.15 µs        | 4.8 ns     |
| toggles (unpacked)   | 3741.6k ±2.3% | 3755.5k ±2.1% | 1.004 | 1.000 (3) | 1.004    | 1 ns           | 1.0 ns     |
| toggles (packed)     | 4072.1k ±2.5% | 4071.4k ±1.7% | 1.000 | 1.000 (2) | 0.999    | 0 ns           | 0.0 ns     |

Decode:

| Row                  | Reference     | Change        | Ratio | `D`       | Adjusted | Saved per call | Per string |
| -------------------- | ------------- | ------------- | ----- | --------- | -------- | -------------- | ---------- |
| deeply nested object | 2513.1k ±1.9% | 2554.0k ±3.5% | 1.016 | 0.997 (4) | 1.020    | 6 ns           | 3.2 ns     |
| large record         | 72.4k ±1.6%   | 74.8k ±1.8%   | 1.033 | 0.999 (3) | 1.034    | 0.44 µs        | 2.2 ns     |
| `string-heavy`       | 188.0k ±1.1%  | 192.4k ±1.4%  | 1.024 | 1.001 (3) | 1.022    | 0.12 µs        | 1.2 ns     |
| tagged union         | 84.6k ±2.0%   | 84.7k ±3.5%   | 1.001 | 0.992 (3) | 1.010    | 16 ns          | 0.7 ns     |
| guarded union        | 271.7k ±3.1%  | 275.4k ±1.9%  | 1.014 | 1.008 (2) | 1.006    | 50 ns          | 1.6 ns     |
| toggles (unpacked)   | 2765.9k ±2.2% | 2797.0k ±3.4% | 1.011 | 1.003 (3) | 1.008    | 4 ns           | 4.0 ns     |
| toggles (packed)     | 1571.4k ±1.5% | 1589.6k ±2.1% | 1.012 | 1.001 (2) | 1.010    | 7 ns           | 7.3 ns     |

Time saved is from the raw medians.

## Discussion

On encode, the three rows with the most strings are well outside the floor,
whose highest row is 1.004×, and the nested object and the tagged union, at
1.031× and 1.023×, are outside it by two to three points. A string saved
3.5 to 4.8 ns on each of the five rows with more than one: the second
reservation's capacity check and its round trip through the cursor. The
toggles rows write one string and cannot show 4 ns against a call of about
0.25 µs.

On decode the effect is smaller, as the read side keeps both of its steps and
loses only one move of the cursor. The large record, `string-heavy`, the
nested object and the guarded union read from 1.014× to 1.033×, above the
floor's 1.005×, at 1.2 to 3.2 ns per string. The tagged union's decode, at
1.001×, is within the floor, and so are the toggles rows, whose 1.011× and
1.012× are single strings in a call of under 0.7 µs.

The first reference, taken before the change, ran slower on every column,
including the libraries and the rows the change did not touch. Read against
it, the change would have claimed about 3% it did not earn. The second
reference was taken to separate the two, and the change's run agrees with it
on the controls to within 0.2%. Which of the two references was the outlier
cannot be told from three runs; the change and the reference it is read
against sit together.

What this does not reach:

- `readChecks` is not measured. Under it the read side keeps its two bounds,
  so the change moves one cursor write and nothing else there.
- The fixtures run native. What the change is worth interpreted was not run.
- A `buffer` with a count has no catalog row. It takes the same path as a
  `str` on both sides.
- The exact form, `DataType.Length<string, N>`, was already one reservation
  and did not change.

## Conclusion

Reserving a string's count and bytes at once saved 3.5 to 4.8 ns per string
on encode and up to 3.2 ns on decode. That made the encode of a 200-key
dictionary 1.155× as fast and of a hundred-line record 1.124×. The rows whose
code it did not change moved within 0.976× and 1.005×. A reference taken before the change, in
the same session, ran 3% slower throughout, and a second reference after it
is what the result is read against.

## Data

- `data/before-one-reservation-per-string.md` and `.tsv`: the first
  reference, at surge `f2d6437` and rbxts-transformer-surge `b6f19d1`.
- `data/before-one-reservation-per-string-second-run.md` and `.tsv`: the
  second reference, at the same commits.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `8e67dc8`,
  recorded at surge `9105932` and rbxts-transformer-surge `ba1331a`.
- The figures above were computed from the three `.tsv` files, with the
  recorder's own median, spread and noise rule.
