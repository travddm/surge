# The cost of generated serializer code against hand-written Luau

2026-09-23 · surge `824a279` · rbxts-transformer-surge `aa6f04b` · Roblox
0.739.0.7390687

## Abstract

Reserving bytes inline in the generated code, instead of calling into the
package for each reservation, is worth a median 1.538× on encode and 1.134× on
decode across the catalog, where it was recorded at 4.15× and 2.48× before the
speed suite yielded. It is above 1.00× on every encode row and readable on
fifteen of the sixteen; the wide struct's 1.048× sits inside the band two runs
of unchanged code differ by. On the three rows where the calls can be counted
and the gain read, each `alloc` call it removed saved about 22 to 27 ns,
whether the row made one such call per `serialize()`, eight, or a thousand. What it left is a gap to a hand-written Luau codec
writing the same bytes that is small on a large payload and large on a small
one — 1.22× on the `CFrame` array's encode, 2.20× on the flat struct's — which
is the shape of a cost paid once per call. The generated `serialize()` makes
two table allocations per call that the hand-written codec does not; whether
they account for the gap is not tested here.

## Background

The benchmark's hand-written baseline is a Luau codec over three rows that
writes surge's exact bytes, so its lead over surge is what the generated code
costs and not a difference of format. Before the inline reservation, the
generated code called `alloc` in the package once per reservation — per field
until the shared reservation, per run of fields after it — and each call
crossed a module boundary. The inline reservation replaced each call with four
instructions local to the serializer's own closure (`rbxts-transformer-surge`
`7f46c81`, surge `91310ea`):

```luau
local pos1 = __surge_cursor
__surge_cursor = pos1 + 17
if __surge_cursor > __surge_capacity then
    __surge_scratch = __surge_grow(__surge_scratch, pos1, __surge_cursor)
end
```

It was recorded at 4.15× on encode and 2.48× on decode, the largest result the
performance work produced, and it and the gap it was written to close were
both read from full runs made before the suite yielded
([frame-starvation.md](frame-starvation.md)).

## Method

The after side is the committed reference run at surge `824a279` and
rbxts-transformer-surge `aa6f04b`: two Studio runs back to back, nine trials
per cell.

The before side is a mixed tree, because neither repository's history holds a
state that is both the previous shape and measurable on today's harness. A
transformer-only checkout cannot build today's tests place: its round-trip
suites use `DataType.Length<T, L>` and the `checks` option, which the earlier
transformer predates, and it misreads `Length<string, 5>` as a function type.
So the before side is the transformer at `35253a6`, the last commit before the
inline reservation; surge's `src/` at `17876b6`, the last commit before the
package side of the same change; today's benchmark suite, fixtures, adapters
and recorder, so that the run yields; and the round-trip suites removed, since
the speed tier never runs them and the earlier transformer cannot compile them.

Three checks on that build:

- **The shape is the old one.** The compiled flat struct reserves with
  `local buf1, pos2 = __surge_alloc(17)`, a call into the package, where
  today's inlines the four lines above and calls nothing.
- **No encoding moved.** `docs/benchmarks/size.md` at surge `91310ea` and at
  the reference agree on every byte count of every library in all sixteen
  rows, so the Tier B commits missing from the earlier transformer changed no
  default width, and the reservation shape is the only difference in the
  emitted code.
- **Nothing run-wide moved.** The four untouched columns are the control, and
  removing the round-trip suites from the place changes modules the speed tier
  never loads.

Ratios are the reference over the before side, so above 1.00× is what the
inline reservation bought.

## Results

### What the inline reservation is worth

| Fixture                             | Encode | Decode  |
| ----------------------------------- | ------ | ------- |
| small flat struct                   | 1.072× | 1.024×  |
| deeply nested object                | 1.426× | 1.111×  |
| wide struct                         | 1.048× | 0.995×  |
| large array                         | 3.638× | 1.177×  |
| large record                        | 2.798× | 1.305×  |
| string-heavy                        | 2.195× | 1.159×  |
| enum-heavy                          | 1.710× | 1.287×† |
| tagged union                        | 2.553× | 1.235×† |
| guarded union                       | 2.898× | 1.276×  |
| toggles (unpacked)                  | 1.354× | 1.134×† |
| toggles (packed)                    | 1.277× | 1.063×  |
| CFrame array                        | 1.244× | 1.024×  |
| CFrame array (packed, axis-aligned) | 1.445× | 1.141×  |
| CFrame array (packed, arbitrary)    | 1.461× | 1.127×  |
| Blink: Booleans                     | 3.886× | 1.190×  |
| Blink: Entities                     | 1.615× | 1.054×† |
| **median** (quiet cells)            | 1.538× | 1.134×  |

† marks a cell the recorder flagged as noisy in either run; the medians
exclude them. The controls in the same comparison: fbs 0.987× on encode and
0.998× on decode, serio 0.992× and 0.995×, blink 1.016× and 1.000×, the
hand-written baseline 1.002× and 0.989×.

The three rows the record singled out are real and smaller: the tagged union
at 2.553× where it was recorded at 7.35×, the guarded union at 2.898× against
6.56×, and `Blink: Booleans` at 3.886× against 5.56×.

### The gap that is left

The hand-written codec's lead over surge, baseline throughput over surge's,
before the inline reservation and after it:

| Row                  | Half   | Before | After | surge per value, before → after |
| -------------------- | ------ | ------ | ----- | ------------------------------- |
| small flat struct    | encode | 2.35×  | 2.20× | 0.398 µs → 0.372 µs             |
| small flat struct    | decode | 1.11×  | 1.05× | 0.197 µs → 0.192 µs             |
| deeply nested object | encode | 2.84×  | 2.02× | 0.645 µs → 0.452 µs             |
| deeply nested object | decode | 1.23×  | 1.09× | 0.461 µs → 0.415 µs             |
| CFrame array         | encode | 1.55×  | 1.22× | 6.017 µs → 4.836 µs             |
| CFrame array         | decode | 1.11×  | 1.11× | 8.123 µs → 7.930 µs             |

In absolute time, surge's encode is 0.203 µs behind on the flat struct,
0.228 µs on the nested object, and 0.865 µs on the thousand-element `CFrame`
array: roughly a constant 0.2 µs per call, plus under a nanosecond per
element.

## Discussion

**Each call removed is worth about the same.** Counting reservations in the
compiled output — each one an `alloc` call before this change — and dividing
the encode time saved by them gives a nearly constant cost per call:

| Fixture              | Reservations per call | Encode time saved | Per reservation |
| -------------------- | --------------------- | ----------------- | --------------- |
| small flat struct    | 1                     | 26.7 ns           | 26.7 ns         |
| deeply nested object | 8                     | 192.7 ns          | 24.1 ns         |
| large array          | 1,001                 | 22,041 ns         | 22.0 ns         |
| wide struct          | 2                     | 27.4 ns           | 13.7 ns         |

The large array's count is its thousand elements and the length prefix. So
the ratio a row gains is a question of how many calls it made against how much
other work its call does, not of how many calls alone: the flat struct's one
call is a larger share of a 0.37 µs call than the wide struct's two are of a
0.57 µs one. The wide struct is the one row off the line, and at 1.048× it is a
single cell inside the between-invocation band, so its figure is not readable
on its own. Twenty-odd nanoseconds per cross-module call is also the order of
magnitude [per-call-overhead.md](per-call-overhead.md) found for the blob
channel's table and three calls, measured independently.

**Why the recorded figure was larger.** The earlier before-and-after pair was
two full runs in the mode frame-starvation.md describes, where a run stops
measuring what it thinks it measures once it has gone about ten seconds
without a frame. The slower build reaches that point at an earlier fixture, so
more of its cells are measured in the depressed mode, and the ratio between
the two builds is inflated. This fits the direction and the size of the
difference, and it would apply to every speed-up measured before the suite
yielded, but it was not tested: no before-side run was repeated in the old
mode to see where its onset fell.

A second difference between the two measurements runs the other way. The
recorded pair was taken before `//!native` was added to the fixture modules
(surge `afde7bc`, two hours after the inline reservation landed), so both of
its sides compiled the generated code interpreted; this re-measurement has it
native on both sides. The change replaces a cross-module call with four inline
instructions, and native code generation makes those instructions much faster
while doing little for a call, so under native the gain should be larger, not
smaller. The configuration difference therefore cannot account for the
shrinkage, and if it has any effect it hides some of it.

**What is left is per call.** A gap that is 2.20× on a seventeen-byte struct
and 1.22× on a twelve-hundred-byte array is not a per-element cost; it is
about 0.2 µs paid once per `serialize()`.
[per-call-overhead.md](per-call-overhead.md) has already ruled two candidates
in and out: the blob channel, at 25.7 ns and removed, and `finishWrite`'s copy,
at nothing. Reading the generated code against the hand-written codec
suggests the next. The hand-written codec creates one buffer and returns it.
The generated `serialize()` writes into a scratch buffer, calls into the
package for `finishWrite`, and returns a new table `{ buffer = …, blobs = {} }`
— one allocation for the wrapper and a second for the empty `blobs` array,
which the transformer emits because `Serializer<T>` declares the property. The
blob probe put one table allocation and three cross-module calls at about
26 ns, so two tables and one call are a plausible share of 0.2 µs, and not
plausibly all of it. None of this was measured.

**Three conclusions were not re-measured.** The shared reservation (4.70× on
one row), the single reservation of a `CFrame`'s 24 bytes (1.61× on encode),
and the tagged-union literal (1.39× on decode) were each measured as removing
a package call, in a world before the inline reservation where every
reservation was one. Reproducing them would mean building trees two changes
old to restate what each was worth in code no build runs today. Each shape is
still in the emitter, so what it is worth now is a real question, but it is a
different measurement from the one on record, with a much smaller expected
answer, and it was left for a later pass rather than substituted for the
record.

What this does not show. The before side is a tree that never existed as a
commit, assembled from two repositories' histories and today's harness; the
checks above are what make it comparable, and none of them is a proof. The
reading of where each row's gain comes from, and of why the recorded figure
was larger, are interpretations. It is one pair of runs on one machine, so
per the between-invocation band in
[noise-in-the-speed-tier.md](noise-in-the-speed-tier.md) only the medians and
the larger per-row effects are readable.

## Conclusion

The inline reservation is worth a median 1.538× on encode and 1.134× on
decode, not 4.15× and 2.48×, and it is still the largest single change the
generated code has had. It closed most of the gap to hand-written Luau on a
large payload and little of it on a small one. What remains is roughly 0.2 µs
per call, of which the per-call work already measured accounts for an eighth
at most, and the two table allocations the generated `serialize()` makes are
the next thing to measure.

## Data

- The after side: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `ed28683`.
- The before side, kept because nothing else records it:
  `data/before-the-inline-reservation.md` in this directory. The mixed tree it
  was measured on is described under Method and was never committed.
- The byte check: `docs/benchmarks/size.md` at surge `91310ea` and at
  `ed28683`.
