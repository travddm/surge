# What Luau's file directives are worth on generated serializer code

2026-09-23 · surge `824a279` · rbxts-transformer-surge `aa6f04b` · Roblox
0.739.0.7390687

## Abstract

Two directives, measured the same way: each is removed from the twelve
benchmark fixture modules, which is where all of surge's generated code sits,
and nothing else changes. Removing `//!native` costs a median
1.335× on encode and 1.180× on decode across the sixteen-row catalog. Every
encode row loses between 1.10× and 2.53×, every decode row between 1.03× and
1.75×, and the four untouched library columns in the same run moved 0.97× to
0.99×. The figure on record was 1.02×, measured before the speed suite
yielded, in a mode where allocation dominated the loop and native code
generation cannot make allocation faster. Native is therefore worth about a
third of surge's encode throughput, not two percent — still short of the 2.25×
to 11.68× that the dismissals resting on this figure required, but every
number in the argument they were made with is wrong. Removing `//!optimize 2`
costs nothing: 0.996× on encode and 0.981× on decode, inside the 0.979× to
1.018× the untouched columns moved in the same run. The two directives the
repository recommends together are worth very different amounts.

## Background

surge's generated write and read code is straight-line `buffer.writeXX` and
`buffer.readXX` calls with count-driven loops: the shape native code
generation is supposed to help most. Three measurements said otherwise —
1.016×/1.021×, then 1.028×/1.099×, then 1.069×/1.103× when the directive was
committed to the fixtures in surge `afde7bc` — and
[generated-code-performance.md](../future-work/generated-code-performance.md)
built a section on the first: each of six dismissed optimizations rested on
the form "X is invisible against an interpreted total, and native shrinks that
total 2.25× to 11.68× while leaving X where it is", and each was answered with
"the ratio is not there; native moves that total by two percent".

All three measurements predate the yield fix. In the mode
[frame-starvation.md](frame-starvation.md) describes, a run that never yields
lets the heap grow until allocation is what the loop measures. Native code
generation does not make allocation or collection faster, so whatever
fraction of the loop is allocation is a fraction native cannot improve — and
in that mode the fraction approaches all of it. A measurement of native taken
there is biased toward 1.00× by construction.

## Method

The reference is the committed catalog run at surge `824a279` and
rbxts-transformer-surge `aa6f04b`, in which the twelve fixture modules carry
`//!native` and `//!optimize 2`: two Studio runs back to back, nine trials per
cell.

Each probe removes one directive line from those twelve modules and nothing
else, and is measured as its own full catalog run. Verified in the compiled
output each time: after the first, no fixture module begins with `--!native`
while the hand-written baseline still does; after the second, each fixture
begins with `--!native` and carries no `--!optimize 2`.

What that isolates, and what it does not. All of surge's generated code is in
those twelve modules — the one other file that names `createBinarySerializer`
mentions it in a comment, and no compiled adapter contains a buffer operation.
The other libraries' codecs live in their own modules, which keep their own
directives, so fbs, serio, blink and the hand-written baseline are controls;
what the probe removes from them is only the native compilation of the call
wrapper in the fixture. surge's runtime package is itself `//!native` on
`alloc`, `blobs`, `cframe` and `pack`, so a call from the generated code into
the package still lands in native code either way.

Ratios are reference over probe, so above 1.00× is what the directive buys.
Cells the recorder marks noisy are excluded from the summary figures.

## Results

### `--!native`

| Fixture                             | Encode | Decode |
| ----------------------------------- | ------ | ------ |
| small flat struct                   | 1.102× | 1.156× |
| deeply nested object                | 1.169× | 1.121× |
| wide struct                         | 1.496× | 1.041× |
| large array                         | 1.658× | 1.284× |
| large record                        | 1.551× | 1.191× |
| string-heavy                        | 1.400× | 1.154× |
| enum-heavy                          | 1.240× | 1.382× |
| tagged union                        | 1.944× | 1.180× |
| guarded union                       | 2.016× | 1.291× |
| toggles (unpacked)                  | 1.269× | 1.224× |
| toggles (packed)                    | 1.175× | 1.110× |
| CFrame array                        | 1.112× | 1.369× |
| CFrame array (packed, axis-aligned) | 1.141× | 1.116× |
| CFrame array (packed, arbitrary)    | 1.107× | 1.033× |
| Blink: Booleans                     | 2.534× | 1.752× |
| Blink: Entities                     | 2.262× | 1.302× |
| **median**                          | 1.335× | 1.180× |
| **geometric mean**                  | 1.455× | 1.217× |

Sixteen of sixteen encode rows and fifteen of fifteen readable decode rows are
above 1.00×. The controls in the same run, as medians over their own cells:
fbs 0.983× encode and 0.980× decode, serio 0.984× and 0.984×, blink 0.970× and
0.994×, the hand-written baseline 0.974× and 0.982×. The controls run slightly
the other way, so if anything the figures above understate the directive.

**The spread tracks where each row's work is.** The rows that gain most are
the ones whose work is a loop of small operations inline in the generated
module: a thousand booleans at 2.534×, the two union rows at 2.016× and
1.944×, where the generated code branches per value. The rows that gain least
are the ones whose work is inside the runtime package, which is native in both
builds: the two packed `CFrame` rows at 1.141× and 1.107×, whose encode runs
through the package's `cframe` codec rather than through inline writes. The
small flat struct, at 1.102×, is a seventeen-byte call where the per-call
overhead the directive cannot touch is most of it.

### `--!optimize 2`

Removing the directive leaves the fixture modules at whatever level Studio
compiles by default, with every other module in the place, both other
libraries' codecs and surge's own runtime package, still pinned at level 2.

| Column   | Encode | Decode |
| -------- | ------ | ------ |
| surge    | 0.996× | 0.981× |
| fbs      | 0.994× | 0.984× |
| serio    | 0.988× | 0.984× |
| blink    | 0.980× | 0.986× |
| baseline | 1.018× | 0.979× |

surge is inside the range the four controls cover, on both halves. The
recorded figure, 1.004× and 1.030× from a full run either side of the change,
said the same thing before the suite yielded, and this is the one conclusion
on the re-measurement list that comes back identical.

That is what the mechanism predicts. Level 2 adds function inlining and loop
unrolling. Only a local Luau function can be inlined, and what the generated
code calls is `buffer.writeXX` and `buffer.readXX`, which are C functions;
only a compile-time bound can be unrolled, and every generated loop is bounded
by a count read out of the buffer at run time. The inline reservation removed
the per-field cross-module call, which was the other reason given for level 2
not reaching this code, and it made no difference to this figure — because the
two reasons that remain are not about crossing a module boundary.

What it buys is therefore not speed but determinism: the level is pinned
rather than inherited, so a profile taken in Studio is a profile of what a
published place runs.

## Discussion

The recorded `--!native` figure was wrong by an order of magnitude in its effect on the
encode half, and it was wrong in the direction the slow mode predicts. That is
the second conclusion in this repository to move on re-measurement, and unlike
[per-call-overhead.md](per-call-overhead.md) it moves a number that other
arguments were built on.

What the dismissals needed was an inversion: a total shrinking by 2.25× to
11.68× while the dismissed item stayed put. A third is not that, so the six
dismissals generated-code-performance.md built on this figure survive on their
arithmetic. But they survive
with a margin of three, not of a hundred, and one of them changes character.
The package pragma entry predicted 1.47× "once the caller is native as well"
from a helper-and-caller table, and dismissed that prediction on the grounds
that it belongs to a loop whose work sits inside the native region while
surge's does not. The catalog now says 1.335× on encode, which is most of the
way to that prediction. After the inline reservation removed the per-field
cross-module call, surge's work does largely sit inside the native region, and
that entry should be re-argued rather than left standing on a 1.02× that no
longer exists.

The same correction reaches the two entries that divide by this figure. Type
annotations, worth about 1.09× on top of native on a synthetic writer, were
dismissed by dividing that by the 1.10× native was worth on decode to get
1.01×. Against 1.180× the arithmetic gives about 1.04×, which is still not
worth a pass that rewrites files roblox-ts has written, but is not the same
statement.

What the `--!optimize 2` result rests on, and does not establish, is that
Studio does not already compile at level 2. If it does, the probe changed
nothing and the null result is empty rather than informative. Nothing here
verifies the level Studio defaults to; the recorded claim that a published
place compiles at level 2 and Studio does not is taken from
[generated-code-performance.md](../future-work/generated-code-performance.md),
and the earlier measurement of the same question shares the assumption.

What this does not show. It measures two directives on one build of one
catalog on one machine, and it says nothing about what native is worth on a
consumer's own code, which surge does not mark. It does not separate native
code generation from whatever else the directive changes about how Luau
compiles the module. The per-row reading of where the work sits is an
interpretation of the spread, not a separate measurement: no row was
instrumented to confirm the fraction of its time spent inside the package.
And the probe removes the directive rather than adding it, so it measures the
loss from the configuration the repository ships, which is the number a
consumer following the recommendation would see, and not necessarily the same
as the gain measured from a cold start.

## Conclusion

`--!optimize 2` is worth nothing measurable on this code, for reasons its
mechanism predicts, and is worth having anyway because it pins the level a
profile is taken at. `--!native` is worth a median 1.335× on encode and 1.180× on decode on surge's
generated code, on every row of the catalog, where the figure on record was
1.02×. The recommendation to mark a module holding generated serializers was
right for a much larger reason than the measurement behind it said. The
dismissals that rest on native being worth nothing still stand, because a
third is not the two-to-eleven-fold inversion they required, but they now rest
on a figure that has been measured on a suite that yields, and two of them
need their arithmetic redone.

## Data

- The reference run: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `ed28683`.
- The two probe runs, kept because nothing else records them:
  `data/without-native-on-the-fixtures.md` and
  `data/without-optimize-2-on-the-fixtures.md` in this directory. Neither
  probe is in any build that shipped.

## Correction, 2026-09-23

The Discussion names one assumption the `--!optimize 2` result rests on and
does not verify: that Studio does not already compile at level 2. Roblox's
documentation of the directive states it: level 1 is "default in Studio
testing" and level 2 is "default in live games"
([Luau comments](https://create.roblox.com/docs/luau/comments)). The probe's
un-pinned fixtures therefore ran at the documented Studio default of level 1,
against level 2 in the reference, and the null result is a comparison between
two levels rather than an empty one. That `run-in-roblox`'s injected script
takes the same default as a Studio test session is the documented default
applied to it, not something this run observed.
