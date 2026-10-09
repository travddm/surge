# The tagged union's gap, attributed

2026-10-07 · surge `df898a6` to `cfb4aa5` (branch `probe-tagged-union-variants`)
· rbxts-transformer-surge `da35c52` · Roblox 0.741.19.7411056

## Abstract

The hand-written codec encodes the tagged union row about 1.05× as fast as
surge, steadily: from 1.014× to 1.073× in each of the 22 runs of the
unchanged code on 2026-10-07. No change measured against a reference in
another invocation could resolve where that 5% goes. This attributes it
within one process instead, by giving the hand-written codec's columns
variants that each differ from it in one way surge's code does. surge's own
generated `serialize`, pasted into the hand-written codec's module, runs at
surge's speed, so the gap is in the code. Two differences account for it: a
`spawn` event's `at` read once for each component, about 2% to 3%, and the
size loop's form, `(if … else 16) + 1` for each event, about 1% to 2.5%. A
`chat` event's second cursor move costs nothing measurable. Nothing in surge
changed here.

## Background

surge's write of the row
([data/tagged-union-variants/writers.luau](data/tagged-union-variants/writers.luau),
`writeTaggedUnionAsSurge`) and the hand-written codec's (`writeTaggedUnion`)
size the result by a loop over the events, then write each event in a branch
on its tag. They differ in three known ways:

- the size loop: surge adds `(if … then … elseif … else 16) + 1` for each
  event, where the hand-written codec adds the variant bytes once, as the
  count, and each event's bytes in an `if`/`elseif` statement;
- a `spawn` event: surge reads `item.at` once for each of its three
  components, where the hand-written codec reads it into a local once;
- a `chat` event: surge moves its cursor twice, once past the index and id and
  once past the string, where the hand-written codec moves its offset once.

Reading `at` once was tried in surge and measured as 1.027× adjusted, with
one run of the change below both runs of the reference and one above them
([datatype-values.md](datatype-values.md)), and cursor moves measured as no
change on the variant index
([variant-index-reservation.md](variant-index-reservation.md)).

## Method

**Variants.** Each is a Luau function in the hand-written codec's module,
`tests/src/bench/baseline/codecs.luau`, which carries `--!native` and
`--!optimize 2` as surge's fixtures do. All are in
[data/tagged-union-variants/writers.luau](data/tagged-union-variants/writers.luau):

| Variant | Function                         | Differs from the hand-written codec                           |
| ------- | -------------------------------- | ------------------------------------------------------------- |
| B0′     | `writeTaggedUnionCopy`           | not at all                                                    |
| B4      | `writeTaggedUnionAsSurge`        | is surge's generated `serialize` for the row, line for line   |
| size    | `writeTaggedUnionSizeAsSurge`    | the size loop in surge's form                                 |
| at      | `writeTaggedUnionAtPerComponent` | `at` read once for each component                             |
| chat    | `writeTaggedUnionChatTwice`      | a `chat` event's offset moved twice                           |
| expr    | `writeTaggedUnionSizeExpression` | the size loop as one if-expression, variant bytes added ahead |
| +1      | `writeTaggedUnionSizePlusOne`    | the size loop's statements each adding the variant byte       |

**Columns.** On a branch, `probe-tagged-union-variants`, the tagged union
fixture gave its `fbs`, `serio` and `blink` columns to variants, through the
hand-written codec's adapter, and kept surge and the hand-written codec, B0,
as they are. In the data files, those three column names therefore carry
hand-written variants, not the libraries:

| Design | surge commit | `fbs` | `serio` | `blink` |
| ------ | ------------ | ----- | ------- | ------- |
| 1      | `df898a6`    | B0′   | B4      | Blink   |
| 2      | `cde3625`    | B0′   | size    | at      |
| 3      | `23f8cf8`    | B0′   | chat    | B4      |
| 4      | `cfb4aa5`    | B0′   | expr    | +1      |

**Runs.** Each design ran twice as a scoped run, `mise run bench:speed:only
tagged`: one Studio run of the one row, nine trials per cell, the columns
taking turns one trial each. All eight ran between 21:24 and 21:40 UTC, at
rbxts-transformer-surge `da35c52`. At each start no Roblox process was
running, both trees were clean, and the CPU load, averaged over fifteen
one-second samples of `Get-Counter`, was between 5% and 10%.

**Reading.** Fixed before the first run. A variant's cost is its median encode
rate against B0's in the same run. B0′ against B0 is the floor: what two
copies of the same code differ by in one run. A difference is attributed only
if its sign is the same in both runs of its design and its size exceeds the
floor in each. B4 decides the rest: at surge's speed, the gap is in the code;
at B0's, it is in what surrounds the code, and the variants would not find it.

## Results

Each column's median encode rate against B0's in the same run:

| Design | Run | surge | B0′ (floor) | `serio`    | `blink`  |
| ------ | --- | ----- | ----------- | ---------- | -------- |
| 1      | 1   | 0.923 | 0.980       | B4 0.929   | —        |
| 1      | 2   | 0.955 | 0.989       | B4 0.935   | —        |
| 2      | 1   | 0.930 | 1.002       | size 0.991 | at 0.967 |
| 2      | 2   | 0.932 | 0.984       | size 0.974 | at 0.982 |
| 3      | 1   | 0.929 | 0.985       | chat 1.006 | B4 0.955 |
| 3      | 2   | 0.949 | 1.012       | chat 1.013 | B4 0.957 |
| 4      | 1   | 0.938 | 0.994       | expr 0.999 | +1 0.995 |
| 4      | 2   | 0.954 | 1.001       | expr 1.017 | +1 1.009 |

The floor was between 0.1% and 2.0%. Against it:

- B4 ran within 3% of surge in all four runs that had it, and between 4.3% and
  7.1% below B0.
- `at` was 3.3% and 1.8% below B0, against floors of 0.2% and 1.6%:
  attributed.
- `size` was 0.9% and 2.6% below B0, against floors of 0.2% and 1.6%:
  attributed.
- `chat` was above B0 in both runs: not a cost.
- `expr` and `+1`, the two halves of `size`, were within their floor in the
  first run and above B0 in the second: neither is a cost alone.

## Discussion

The gap is in surge's code and not in its module, its closure or its
adapter: the same code, in the hand-written codec's module and driven by its
adapter, is as slow as surge. Two of the three known differences are
attributed, and together they are about the size of the gap.

Reading `at` once for its three components is worth 2% to 3% on this row.
[datatype-values.md](datatype-values.md) read the same change in surge as no
change, because two invocations disagree by more than that on one cell; one
process resolves it. That change was withdrawn for the locals it added
inside a run of shared reservations, which pushed a shape of 16 strings and 31
`CFrame`s past Luau's 200 locals. Taking it up again needs those locals
counted where a run's locals are counted.

The size loop costs in surge's exact form, an if-expression with the variant
byte added to it, and in neither half alone. The form that ran at B0's speed
in both runs adds the variant bytes once, ahead of the loop, and the
if-expression's value alone in it. Why the combination costs and its halves
do not was not probed.

A second cursor move in a `chat` event costs nothing measurable, as cursor
moves did on the variant index.

What this method can resolve is bounded by its floor: two copies of the same
code differed by up to 2% in one run.

## Conclusion

Of the tagged union's 1.05× gap to the hand-written codec, about 2% to 3% is
a `spawn` event's `at` read once for each component and about 1% to 2.5% is
the size loop's form. Both are changes to the generated code that a full
invocation pair can now read together.

## Data

- [data/tagged-union-variants/](data/tagged-union-variants/): the result lines
  of each scoped run, `design-<n>-run-<m>.txt`, and the writers that ran,
  `writers.luau`.
- The figures above were computed from those lines: each cell's median of its
  nine trials.
- The branch `probe-tagged-union-variants` holds the four commits named above
  in the surge repository's local history; it is not merged.

## Correction, 2026-10-08

This corrects the last line of the Data. The branch
`probe-tagged-union-variants` is not kept, so the four commits it held are in
no history of the repository. The code the runs used is kept in this paper
and its data: `writers.luau` in
[data/tagged-union-variants/](data/tagged-union-variants/) holds every writer
that ran, and the table under Columns names the column each one ran in for
each design.
