# A union written by testing each variant once

2026-09-29 · surge `927eeff` · rbxts-transformer-surge `6fb2441` · Roblox
0.741.19.7411056

## Abstract

A union's write tested its tag or its guards to choose an index, wrote the
index, and then tested the index to choose the variant's writes, and on the
tagged union the hand-written codec encoded 1.17× as fast as surge
([hand-written-union-and-packed-bits.md](hand-written-union-and-packed-bits.md)).
This change reads a tagged union's tag once and tests each variant once, and
the branch a test selects writes the variant's index and then the variant.
Against the build before it, the tagged union's encode is 1.072× as fast,
2.1 ns an event, and the guarded union's 1.093×, 1.5 ns an element, and no
other row moved outside the band. The hand-written codec now encodes the
tagged union 1.10× as fast as surge, 2.7 ns an event.

## Background

The tagged union's write was, for each of its hundred events:

```luau
local idx6 = if item5.kind == "chat" then 0 elseif item5.kind == "damage" then 1 elseif item5.kind == "despawn" then 2 else 3
local pos7 = __surge_cursor
__surge_cursor = pos7 + 1
buffer.writeu8(__surge_scratch, pos7, idx6)
if idx6 == 0 then
    -- chat's fields
elseif idx6 == 1 then
```

reading the tag up to three times and testing the variant twice, once by its
tag and once by its index. The hand-written codec reads the tag once, tests
it once, and writes the index and the fields in the branch it takes. The
guarded union's write had the same shape, with its guards in place of the
tag's comparisons. The write is now:

```luau
local tag6 = item5.kind
if tag6 == "chat" then
    local pos13 = __surge_cursor
    __surge_cursor = pos13 + 1
    buffer.writeu8(__surge_scratch, pos13, 0)
    -- chat's fields
elseif tag6 == "damage" then
```

Transformer 5.25 states it. The last variant is written when no test passes,
as the size already took it (Transformer 5.20).

## Method

**Builds.** The reference is surge `e7bffe0` and rbxts-transformer-surge
`c006601`, whose table is the one committed at surge `f95c64e`. The change is
surge `927eeff` and rbxts-transformer-surge `6fb2441`. Among surge's generated
code, the compiled fixture modules of the two builds differ in the `serialize`
of the tagged union and of the guarded union. The size, which tests each
element's tag in a chain of its own, did not change.

**Runs.** The reference ran from 19:15 to 19:24 on 2026-09-29 and the change
from 19:36 to 19:45, each one full invocation of `mise run bench:speed`: two
Studio runs back to back, nine trials per cell per run. The CPU load at the
start was 1% and 3%, and no Roblox process was running at either start.

**Reading.** As in [packed-bits-read-in-place.md](packed-bits-read-in-place.md):
the change's surge median over the reference's, the drift `D` over the row's
quiet control cells, the time a call takes against the reference, and, in the
change's run, the hand-written codec's ratio to surge.

**Controls.** The fbs, serio, Blink and baseline columns, the fourteen encode
rows whose code did not change, and surge's decode.

## Results

Encode, from the reference's trials as committed at `f95c64e` and the
change's as committed at `f5b3eaa`:

| Row           | Reference    | Change       | Ratio | `D`       | Adjusted | Per call | Runs, reference | Runs, change   |
| ------------- | ------------ | ------------ | ----- | --------- | -------- | -------- | --------------- | -------------- |
| tagged union  | 319.2k ±2.6% | 342.2k ±2.6% | 1.072 | 1.004 (4) | 1.068    | −211 ns  | 319.6k, 318.2k  | 344.2k, 340.4k |
| guarded union | 582.8k ±4.4% | 637.2k ±2.4% | 1.093 | 1.013 (2) | 1.080    | −147 ns  | 578.7k, 599.5k  | 638.9k, 636.8k |

The other encode rows moved between 0.984× and 1.025× adjusted, but for
`Blink: Booleans`, whose reference cell ran at two speeds, 208.8k and 178.4k
values a second by run, and is marked noisy. The quiet control cells moved
1.006×, quartiles [0.997, 1.016] over 47.

Against the hand-written codec in the change's run, the tagged union's encode
is 1.10×, and 1.123× and 1.096× by run, where the reference's run had it at
1.19×. Its decode is 0.99×. On the other four baseline rows, the encode and
decode are between 0.977× and 1.048× by run.

## Discussion

Testing each variant once saved 2.1 ns an event on the tagged union, a little
under half the 4.9 ns an event that separated it from the hand-written codec
in the reference's run, 319.2k against 378.7k values a second. It saved 1.5 ns
an element on the guarded union, which the baseline does not cover.

What is left of the tagged union's gap, 2.7 ns an event, is in the two
differences this did not touch. surge's write still moves its cursor once for
each reservation, up to three for an event (the index, the variant's fixed
fields, and a string's count and bytes), where the hand-written write moves
one position once for each event. And surge's size still reads each element's
tag once for each comparison in its chain, where the hand-written codec's
first pass reads it once. Which of the two accounts for the rest was not
probed.

What this does not reach:

- The size's chain, which a binding of the tag would need a statement for,
  is unchanged.
- The fixtures run native. What the change is worth interpreted was not run.

## Conclusion

Testing each variant of a union once in its write made the tagged union's
encode 1.072× as fast and the guarded union's 1.093×, and moved no other row.
The hand-written codec encodes the tagged union 1.10× as fast as surge, where
it was at 1.19×.

## Data

- The reference: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `f95c64e`, recorded
  at surge `e7bffe0` and rbxts-transformer-surge `c006601`.
- The change: the same files as committed at surge `f5b3eaa`, recorded at
  surge `927eeff` and rbxts-transformer-surge `6fb2441`.
- The figures above were computed from the two `.tsv` files, with the
  recorder's own median, spread and noise rule.
