# Frame starvation in a Studio benchmark run

2026-09-23 · surge `0b4a259` → `a878aac` · rbxts-transformer-surge `14d9e27` →
`fcebbd6` · Roblox 0.739.0.7390687

## Abstract

The speed tier's timing loops did not yield, and `run-in-roblox` calls the
injected script on Studio's plugin thread, so a full catalog run held that
thread with no frame in it. About ten seconds in, every path that allocates
per call slowed by close to an order of magnitude and did not recover over
the remaining minutes of the run. A scoped A/B on one row isolates the yield
as the cause. Re-recording the catalog with the loops yielding moved 105 of
its 124 cells by more than 1.2×, the largest by 19.62×, while the 18 cells
that had been measured before the onset moved 0.99× to 1.21×. The mechanism
behind the slowdown is not established here.

## Background

`mise run bench:speed` builds the tests place and runs it through
`run-in-roblox`, which injects one Script and ends the run when that script
returns. The suite measured the catalog's encode half as one runit `@Fact`
and its decode half as another, in catalog order, five trials of 10,000 calls
per cell after 1,000 warm-up calls.

Nothing in it yielded, by design and for a stated reason: runit starts every
fact at once and awaits them together, so a yield would interleave the two
halves, and `runBenchmarks` did not await the promise its run returned, so a
yield would let that function return — closing Studio under `run-in-roblox` —
before the last row was measured. The hazard checked before relying on that
was the engine's script-timeout watchdog, which does not fire on a loop of
this kind. The allocator was not checked.

Studio raised its "plugin has stopped responding" prompt over a full run,
which is how the question came to be asked. The prompt is not the damage:
every speed figure the repository had was measured this way.

## Method

Two measurements, one controlled and narrow, one broad and confounded.

**The A/B.** One scoped run of the large record row, once with the yield
disabled and once with it enabled, reading serio's decode across its five
trials. This varies the yield and nothing else.

**The catalog.** `docs/benchmarks/speed.md` as recorded before the change
against the same file recorded after it: 124 cells each, 16 fixtures by up to
five libraries by two halves, on the same machine, the same day, and the same
Roblox and library versions. A cell's ratio is its new throughput over its
old one.

That comparison varies more than the yield. The same change made a trial a
length of time (0.2 s) rather than 10,000 calls, raised trials per cell from
5 to 9, made the libraries within a row take turns, and put three idle frames
between rows. The control for all of it is the group of cells that ran before
the onset — the encode cells of the first four fixtures — which the protocol
change reaches and starvation does not.

**The onset** is estimated from the old run's own trials file. A cell's
measured seconds are its warm-up plus five trials of 10,000 calls, taking the
recorded slowest and fastest trials as two of the five and the median for the
other three. It counts measured calls only, so it is a lower bound on elapsed
time: the harness also builds each sample value and prints each row.

## Results

### The A/B, scoped to one row

| Yield    | serio decode, trial 1 | trial 5         |
| -------- | --------------------- | --------------- |
| disabled | 24,000 values/s       | 1,900 values/s  |
| enabled  | 24,000 values/s       | 24,000 values/s |

The three trials in between, and the run's output, were not kept; these are
the figures as recorded at the time.

### The catalog, by group

| Group                                | Cells | Median | Range          |
| ------------------------------------ | ----- | ------ | -------------- |
| Control: encode, first four fixtures | 18    | 1.03×  | 0.99× – 1.21×  |
| Every other cell                     | 106   | 5.89×  | 1.06× – 19.62× |

The geometric mean over the 106 is 5.79×. Two of them are at or below 1.2×,
and both are in the row the onset falls inside. Across the whole file, 105 of
the 124 cells moved by more than 1.2×; the largest is fbs's encode on
`Blink: Entities`, at 19.62×.

### Where the two groups divide

Median ratio over the libraries of each row, in the order the encode half
measured them. The decode half ran after all sixteen, and its median ratio is
5.31× over 62 cells, with no row below 3.01×.

| #   | Fixture                             | Encode ratio | Old run reached |
| --- | ----------------------------------- | ------------ | --------------- |
| 1   | small flat struct                   | 1.06×        | 0.14 s          |
| 2   | deeply nested object                | 1.01×        | 0.35 s          |
| 3   | wide struct                         | 1.04×        | 0.93 s          |
| 4   | large array                         | 1.02×        | 9.10 s          |
| 5   | large record                        | 5.37×        | see below       |
| 6   | string-heavy                        | 8.33×        |                 |
| 7   | enum-heavy                          | 5.05×        |                 |
| 8   | tagged union                        | 7.96×        |                 |
| 9   | guarded union                       | 9.05×        |                 |
| 10  | toggles (unpacked)                  | 6.79×        |                 |
| 11  | toggles (packed)                    | 7.61×        |                 |
| 12  | CFrame array                        | 4.43×        |                 |
| 13  | CFrame array (packed, axis-aligned) | 8.54×        |                 |
| 14  | CFrame array (packed, arbitrary)    | 7.36×        |                 |
| 15  | Blink: Booleans                     | 16.13×       |                 |
| 16  | Blink: Entities                     | 8.35×        |                 |

A row past the onset has no meaningful clock: the rates the estimate divides
by are the depressed ones, so it inflates with them.

### Inside the row it divides

The large record's encode cells, in the order the old run measured them.

| Cell  | Old median | Old slowest trial | Ratio  | Ran over       |
| ----- | ---------- | ----------------- | ------ | -------------- |
| surge | 122.4k/s   | 117.7k/s          | 1.07×  | 9.10 – 9.51 s  |
| fbs   | 87.8k/s    | 6.9k/s            | 1.06×  | 9.51 – 11.43 s |
| serio | 1.2k/s     | 0.7k/s            | 9.67×  | after it       |
| blink | 4.9k/s     | 4.8k/s            | 12.84× | after it       |

Everything that finished by 9.51 s is within 1.21× of its yielding value.
The 104 cells that began after 11.43 s are 1.33× to 19.62× of theirs, with a
median of 5.92×.
Between the two lies one cell holding one slow trial. fbs's median and its
fastest trial are within 1% of each other, so three of its five ran at about
88k values a second, and its slowest ran at 6.9k — which is why its median
survived while its spread was ±93%. The onset is therefore bracketed at 9.5 s
to 11.4 s of measured calls. The file records only each cell's median,
slowest, and fastest, so nothing here pins it inside that.

## Discussion

The effect is real, large, and not a property of any one library: it reaches
every column, including the hand-written Luau baseline: its two encode cells
before the onset are 0.99× and 1.03×, and its four cells after it are 2.66× to
5.51×. It falls hardest
where a call allocates most — decodes, which build a value per call, and
serio, which allocates per field — and least where a call allocates least. It
does not recover: the run went on for minutes of measured calls after the
onset, and no later row returned to its yielding value.

What this does not show is why. A per-frame garbage-collection step, starved
of frames until allocation is what the loop measures, fits the shape of the
result, but nothing here tests it: no heap size was read, no collector setting
was varied, and the onset was not scanned against allocation rate. Nor does it
show whether the onset is a fixed time or a threshold a run reaches sooner
when it allocates faster; the A/B varied the yield, not the clock. And it says
nothing about Roblox outside `run-in-roblox`'s plugin thread.

Three threats to what it does show. The catalog comparison changes the
protocol as well as the yield, which the control bounds rather than removes:
18 cells that starvation cannot reach moved 0.99× to 1.21×, so a difference
under about 1.2× says nothing here, and the two cells at 1.06× and 1.07×
inside the onset row sit at that floor. Both runs were recorded with
uncommitted changes in surge, which both files state and neither identifies;
the affected cells span every library, including the four the transformer
never touches, so this does not bear on the result. And the A/B is one row of
one library, with its intermediate trials unrecorded.

The practical consequence is not in these numbers but in the ones they
invalidate. Every ratio the repository quoted from a full run before this was
read from cells in the affected region, at a factor that differs per cell and
falls hardest on allocation — so a change that removed allocations would have
read larger than it is, and a null result on a per-call allocation would have
read as null under a penalty that should have exposed it.
The conclusions it reaches have since been re-measured; see the other
papers in [this directory](README.md).

## Conclusion

A benchmark loop that never yields under `run-in-roblox` measures its first
ten seconds and then measures something else. The suite yields now: every call
is timed inside a chunk of 250, the loop yields between chunks once a quarter
second of measured work has passed, never inside a timed chunk, and three idle
frames separate one row from the next. The two run-structure reasons the old
suite gave for not yielding were real, and are met another way — the two
halves are one fact, and `runBenchmarks` waits for runit's verdict before it
returns.

## Data

- `docs/benchmarks/speed.md` and `docs/benchmarks/speed-trials.tsv` at
  `fcdd3f5^` (before) and `fcdd3f5` (after) in this repository's history. The
  group, row, and cell figures above are computed from those two pairs.
- The A/B's run output was not kept. Its two figures are as recorded at the
  time, in `tests/src/bench/speed.spec.ts` and `docs/testing.md` at
  `fcdd3f5`.
