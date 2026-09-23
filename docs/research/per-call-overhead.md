# Per-call overhead in the generated code

2026-09-23 · surge `824a279` · rbxts-transformer-surge `aa6f04b` · Roblox
0.739.0.7390687

## Abstract

Two things surge's generated code did on every call regardless of the shape
were measured by probe against a catalog run of the same build: the blob side
channel's three cross-module calls and its table allocation, and
`finishWrite`'s copy of the written region into an exact-size result. The
channel costs a median 25.7 ns per encode call, constant across shapes, which
is 3.6% to 6.4% of a call on the five rows where one call takes under 0.6 µs
and a fraction of a percent elsewhere; the four untouched libraries in the
same run moved by at most 1.3%. The copy costs nothing — −14 ns, the sign
wrong for a cost, and no relation to the payload it copies. Per-call overhead
is therefore measurable and it is not one thing. An earlier measurement of
both, made before the speed suite yielded, put the channel at nothing.

## Background

surge's generated `serialize()` used to call `beginWriteBlobs()`, which
allocates a table, and `finishWriteBlobs()` on every call, and `deserialize()`
called `beginReadBlobs()`, whether or not the shape had a blob field. None of
the benchmark catalog's 16 rows has one. The transformer emits those entry
points only where the emitted body reaches `pushBlob` or `nextBlob` now
(`rbxts-transformer-surge` `d7af243`). `finishWrite` still runs on every call:
it allocates an exact-size buffer and copies the written region into it,
because the caller has to be handed a buffer of the right size.

Both were measured when they landed, at 0.997× and 1.007×, and
[generated-code-performance.md](../future-work/generated-code-performance.md)
concluded from the first that three cross-module calls and a table allocation
per call are not a cost this catalog can see. Both were measured in the mode
[frame-starvation.md](frame-starvation.md) describes, where a run that never
yields stops measuring what it thinks it measures about ten seconds in. The
rows where a per-call cost is a visible fraction of a call are the fastest
ones, and in that mode those were also the least readable cells: their trials
were five milliseconds long and spread by more than 10%. That is the reason to
measure again.

## Method

One reference run of the catalog at surge `824a279` and
rbxts-transformer-surge `aa6f04b`: two Studio runs back to back, nine trials
per cell, `docs/benchmarks/speed.md` as committed at surge `ed28683`.

Two probes, each a one-line change measured as its own full catalog run
against that reference:

- **Blob channel always on.** `usesBlobs` forced true where the transformer
  decides whether to emit the entry points, restoring the pre-`d7af243` shape.
  Verified in the compiled output: every fixture module carries
  `beginWriteBlobs` where the reference build has none in any of the sixteen.
- **`finishWrite` without the copy.** The exact-size buffer is still allocated
  and returned; `buffer.copy` is dropped. The result is a zero buffer, so only
  the encode half means anything. The decode half is reported only as evidence
  that the probe was in the build that was measured.

Each probe was reverted, not committed. The control in each run is the four
libraries it does not touch: anything run-wide lands on them too.

Results are read as nanoseconds added per call, `1/probe − 1/reference`,
because the cost under test is per call; a ratio makes a constant cost look
like a property of the row. Cells the recorder marks noisy are excluded.

**The floor.** Two runs of unchanged code — the previously committed run
against this reference, over the same 124 cells — differ by a median of
−13.0 ns per encode call for surge, with column medians between 0.995× and
1.033×. Two individual cells moved 0.74× and 0.79× with within-run spreads of
±2%, so no single cell is readable; only a median over many cells is.

## Results

### The blob side channel, always on

Nanoseconds added per call, median over the quiet cells of all 16 rows:

| Column   | Encode | Decode |
| -------- | ------ | ------ |
| surge    | +25.7  | +17.9  |
| fbs      | +1.2   | +15.5  |
| serio    | −4.5   | +26.4  |
| blink    | +1.5   | +4.3   |
| baseline | −0.3   | +8.9   |

The encode column separates: surge moved and the four controls did not. The
decode column does not — serio and fbs moved as far as surge, and a median in
nanoseconds over all rows is dominated by the slow rows, where a one-percent
wobble is tens of nanoseconds. The decode figure rests on the ratios below
instead.

The five rows where one encode call takes under 0.6 µs, which is where a
constant per-call cost is a visible fraction:

| Fixture              | Encode call | Encode ratio | Decode ratio |
| -------------------- | ----------- | ------------ | ------------ |
| small flat struct    | 0.372 µs    | 0.941×       | 0.915×       |
| toggles (packed)     | 0.426 µs    | 0.936×       | 0.974×       |
| toggles (unpacked)   | 0.450 µs    | 0.946×       | 0.973×       |
| deeply nested object | 0.452 µs    | 0.964×       | 0.963×       |
| wide struct          | 0.571 µs    | 0.943×       | 0.952×       |
| **median**           |             | **0.943×**   | **0.963×**   |

Controls on those same five rows: fbs 1.000× / 1.000×, serio 1.007× / 0.998×,
blink 0.987× / 0.990×, baseline 0.994× / 0.975×. The same five rows drift
1.019× / 1.026× between two runs of unchanged code, so the drift runs the
other way from the effect.

On the eleven rows where a call takes longer, the ratio median is 0.992×
encode and 0.993× decode — the same absolute cost, now too small to read.

### `finishWrite` without the copy

Nanoseconds added per encode call, median over quiet cells:

| Column   | Encode |
| -------- | ------ |
| surge    | −14.0  |
| fbs      | +12.2  |
| serio    | +13.5  |
| blink    | −1.5   |
| baseline | +2.0   |

Removing the copy did not make encoding faster. Surge's figure is the same
−13.0 ns the unchanged-code drift shows, and its sign is wrong for a cost
removed.

The copy's one claim to being different from the rest of the per-call list was
that it scales with the payload. Sorted by the payload each row copies:

| Fixture           | Bytes | Encode ratio without the copy |
| ----------------- | ----- | ----------------------------- |
| large array       | 2004  | 0.984×                        |
| CFrame array      | 1204  | 1.024×                        |
| deeply nested     | 24    | 1.009×                        |
| small flat struct | 17    | 1.063×                        |

The largest payload gained the least. On the five fastest rows the median is
1.030× encode, against 1.019× drift: nothing there either. The decode half
came back at a median of 36× and a maximum of 162×, which is meaningless —
it decodes zero buffers — and is reported only because it confirms the probe
was live in the build that was measured.

## Discussion

Per-call overhead is measurable in this catalog, which is what changes. The
blob channel's 25.7 ns is about twice the ±14 ns floor, and it is the same
25.7 ns on a row that encodes in 0.37 µs and on one that takes 8 µs — the
signature of a cost paid once per call. It reads as nothing when it is
averaged across a catalog whose rows differ by a factor of twenty in call
length, which is how it was read the first time.

It is not, however, large. Six percent of the fastest row's encode is the
worst case, and the decision it was measured for — emit the channel only where
a shape uses it — was right either way and is now better paid for than its
first measurement suggested.

The two probes disagree, and that is the more useful result. Both are per-call
work removed from every `serialize()`. One is a table allocation and three
cross-module calls and costs twenty-six nanoseconds; the other is a
`buffer.copy` of up to two kilobytes and costs nothing measurable. So "per-call
overhead does not matter" is the wrong generalization to draw from either of
them, and the earlier conclusion that the blob-channel result "settles the rest
of the per-call list, `finishWrite`'s copy included" does not follow — even
though `finishWrite`'s copy does independently measure at nothing, twice now.
What separates them is what the work is, not when it happens: allocation and
cross-module calls cost, and a `buffer.copy` between two buffers the engine
already has does not.

Against the gap this was measured to explain — surge's encode runs about
0.2 µs per call behind a hand-written Luau codec writing the same bytes — 26 ns
is roughly an eighth, and that eighth is already removed from the shipping
build. Per-call work accounts for part of that gap and not most of it.

What this does not show: the probes measure two specific pieces of per-call
work, not per-call work in general, and neither says what a third piece would
cost. The decode side of the blob probe does not separate from its controls in
absolute time and rests on five rows. The fast-row grouping is chosen after
seeing the data, which the constant-nanoseconds reading is meant to make
unnecessary rather than to justify. And every figure is one machine, one
Studio version, one day.

## Conclusion

A table allocation and three cross-module calls per `serialize()` cost
25.7 ns, which the catalog can see on its fastest rows and not on its slowest.
`finishWrite`'s copy costs nothing, at any payload size, measured twice. Per-call
overhead is worth measuring one piece at a time, because the two pieces
measured here differ by more than an order of magnitude.

## Data

- The reference run: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `ed28683`.
- The two probe runs, kept because nothing else records them:
  `data/blob-channel-always-on.md` and `data/finish-write-without-copy.md` in
  this directory. Neither probe is in any build that shipped.
- The drift figures: the run committed at surge `a878aac` against the
  reference, the same comparison
  [frame-starvation.md](frame-starvation.md) uses for its own control.
