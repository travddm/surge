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
[native-on-generated-code.md](native-on-generated-code.md) are read as medians
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
