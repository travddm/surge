# Noise in the speed tier

2026-09-23 · surge `824a279` · rbxts-transformer-surge `aa6f04b` · Roblox
0.739.0.7390687

## Abstract

The speed tier's trials used to carry a long tail: of 124 cells, 11 spread by
more than three tenths of their median between their slowest and fastest
trial and four by more than a whole median, concentrated in encode on the
rows that run fastest. On the yielding, time-based protocol that tail is
gone — no cell spreads by more than a quarter, none by more than three
tenths, and encode and decode are equally quiet — while the count of cells
spreading by more than a tenth is about what it was. The spread within a cell
is now the smaller of the two noises that matter. Two separate invocations of
the same unchanged code agree to within 3% on a column median but differ by
up to 26% on an individual cell, which is the band any comparison between two
runs has to be read against.

## Background

Each cell of the catalog was five trials of 10,000 calls. On the fastest rows
that is about five milliseconds of work, and those cells spread widely; the
recorded reading was that the noise was concentrated in encode on the rows
that run fastest, with 27 of 124 cells spreading more than a tenth of their
median, 11 more than three tenths, and four more than a whole median, all 11
of them on the flat struct, the nested object, the wide struct, or the large
array.

The protocol changed for a different reason — the suite did not yield, which
[frame-starvation.md](frame-starvation.md) is about — and the two changes
landed together. A trial is now at least 0.2 s of calls rather than a fixed
count, there are nine trials per cell rather than five, the libraries of a row
take turns, three idle frames separate rows, and a full invocation is two runs
back to back.

## Method

Two questions, two data sets.

**Within a cell.** `docs/benchmarks/speed-trials.tsv` as committed at surge
`ed28683`: 124 cells, 18 trials each (nine per run, two runs). Spread is
computed two ways — the slowest-to-fastest range over the median, which is the
statistic the recorded claim used, and the interquartile range over the
median, which is what `speed.md` prints as `±`.

**Between invocations.** The run committed at surge `a878aac` against the
reference committed at `ed28683`, over the same 124 cells. The generated code
is identical between them: the emitter split that landed in between was gated
on an identical printed corpus, and the `checks` option emits nothing when a
call site does not ask for it. So any difference is the machine, the Studio
session, or the harness.

One bias worth naming: the slowest-to-fastest range is taken over 18 trials
here and over 5 before, and a range grows with the number of samples. The
comparison therefore understates the improvement rather than flattering it.

## Results

### Within a cell

| Spread of a cell's trials   | Before | Now |
| --------------------------- | ------ | --- |
| More than a tenth of median | 27     | 24  |
| More than three tenths      | 11     | 0   |
| More than a whole median    | 4      | 0   |

Median spread is now 0.065 by slowest-to-fastest and 0.023 by interquartile
range, and the widest cell of the 124 is 0.242 — the hand-written baseline's
encode on the smallest row. No cell exceeds a quarter.

The concentration is gone with the tail. Encode's median spread is 0.064 and
decode's 0.065. The four rows the recorded claim named as carrying all
eleven of the worst cells have a median spread of 0.075 against 0.063 for
every other row, which is no longer a distinction worth drawing.

### Between two invocations of unchanged code

Column medians, later run over earlier:

| Column   | Encode | Decode |
| -------- | ------ | ------ |
| surge    | 1.019× | 1.023× |
| fbs      | 1.017× | 1.022× |
| serio    | 1.021× | 1.033× |
| blink    | 0.995× | 1.028× |
| baseline | 1.025× | 1.029× |

Every column moved the same way by about the same amount, which is a property
of the machine on the day and not of any codec. Within that, two individual
cells moved much further: blink's encode on `Blink: Booleans` at 0.74× and
surge's encode on `Blink: Entities` at 0.79×, both with within-run spreads of
±2% in both files, and neither flagged by the recorder.

## Discussion

The two noises are different in kind and the smaller one is the one the file
reports. A cell's `±` says how much its own trials disagreed inside one
invocation, and that is now 2.3% at the median. It says nothing about whether
the same cell measured tomorrow will land in the same place, and the answer is
that a column will, to about 3%, and a cell may not, to 26%.

That is what makes a per-cell before-and-after ratio unreadable below roughly
1.3× from one pair of invocations, and it is why the probes in
[per-call-overhead.md](per-call-overhead.md) and
[file-directives-on-generated-code.md](file-directives-on-generated-code.md) are read as medians
over many cells with the untouched libraries as controls in the same run. A
control column is the only thing that separates a change from the day.

Two cells moving 26% while their own trials agreed to 2% is the part with no
explanation here. It is not trial noise, because the trials are tight on both
sides; it looks like a per-session state — a different inlining decision, a
different heap layout — that holds for a whole invocation. Nothing was varied
to test that, and both cells are Blink rows, which is either a clue or a
coincidence.

What this does not show: one machine, one Studio version, two invocations.
The between-invocation figure rests on a single pair of runs, so it is an
existence proof for cells that move by a quarter, not an estimate of how often
they do.

## Conclusion

The protocol change removed the tail of the within-cell distribution: no cell
now spreads by more than a quarter of its median where four spread by more
than a whole median, and the spread no longer depends on whether a row is
fast or on which half is being measured. What is left is a median 2.3%
interquartile spread within an invocation, and a larger, less tractable
disagreement between invocations that only a control column in the same run
can separate a real change from.

## Data

- `docs/benchmarks/speed-trials.tsv` and `docs/benchmarks/speed.md` as
  committed at surge `ed28683`, for the within-cell figures and the later side
  of the between-invocation comparison.
- `docs/benchmarks/speed.md` as committed at surge `a878aac`, for the earlier
  side.
- The recorded before figures are from
  [benchmark-tooling.md](../future-work/benchmark-tooling.md), which read them
  from a run whose trials were not kept.

## Correction, 2026-09-23

This corrects seven statements.

- **The earlier run.** Method: "The run committed at surge `a878aac`"; Data: "`speed.md` as
  committed at surge `a878aac`". At `a878aac` the committed `speed.md` is the pre-yield run. The
  between-invocation figures are read from the printed medians of `speed.md` as committed at surge
  `6dff513` against the reference. That run was recorded at `e98cb8c` with uncommitted changes and
  rbxts-transformer-surge `fcebbd6`. Besides the emitter split and the `checks` option, the
  transformer commits between that run and the reference include `ce7b615`, whose message states
  that every existing emitter snapshot is unmoved.
- **The interquartile median.** Results: "0.023 by interquartile range"; Discussion: "2.3% at the
  median"; Conclusion: "median 2.3%". The statistic `speed.md` prints as `±`, recomputed from the
  trials at `ed28683` with the recorder's own quartile positions, has a median of 0.022. 0.023
  comes from a different quartile method. The statements should have said 0.022, or 2.2%.
- **Column agreement.** Abstract: "agree to within 3% on a column median". The largest column
  median is serio's decode, at 1.033×, so the columns agree to within 3.3%. Results: "Every column
  moved the same way". Nine of the ten column medians rose, by 1.7% to 3.3%, and blink's encode
  fell, to 0.995×.
- **The two cells' spreads.** Results: "within-run spreads of ±2% in both files". surge's encode on
  `Blink: Entities` prints ±5% in the reference and ±2% at `6dff513`. blink's encode on
  `Blink: Booleans` prints ±2% in both. Neither cell is flagged, and neither spread approaches its
  move.
- **The readable threshold.** Discussion: "unreadable below roughly 1.3×". blink's encode on
  `Blink: Booleans` moved 0.742×, which is 1.35× read earlier over later. The band this pair of
  invocations shows reaches 1.35×, so a per-cell ratio below that is not readable from one pair.
- **The before counts.** Background and Results: 27, 11 and 4 cells, "all 11 of them on the flat
  struct, the nested object, the wide struct, or the large array". These come from a run whose
  trials were not kept. Two pre-yield runs did keep each cell's slowest and fastest trial. By the
  same statistic over five trials, `speed-trials.tsv` at surge `4afeaca` gives 33, 13 and 5, and
  at `afde7bc` it gives 28, 15 and 4. In both, cells over three tenths fall on the large record
  row and none on the large array, and at `afde7bc` three of the 15 are decode cells. Against
  either run, no cell spreads by more than three tenths now.
- **The cited document.** Data: "The recorded before figures are from benchmark-tooling.md". That
  passage has since been removed from the document. It is in
  `docs/future-work/benchmark-tooling.md` as committed at surge `3bb0a57`.
