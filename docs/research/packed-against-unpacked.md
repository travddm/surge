# What `Packed<T>` costs in speed

2026-09-23 · surge `1c4d9d4` · rbxts-transformer-surge `cb7b4f9` · Roblox Studio
0.739.0.7390687 through `run-in-roblox`

## Abstract

`Packed<T>` changes a shape's bytes, and this asks what it does to speed on
the two catalog pairs that encode the same values both ways. On the toggles
pair, surge decodes the packed shape at 0.576× the unpacked rate. On the pair
of fifty arbitrary `CFrame` rotations, surge encodes the packed shape at
0.644×, and the packed form is 50 bytes larger. Both results held in both runs
of the invocation; the other half of each pair is too close to 1.00× for one
invocation to settle. fbs and serio also run slower packed.

## Background

Two pairs of catalog rows encode the same value plain and in `Packed<T>`:

- `toggles (unpacked)` and `toggles (packed)`: ten booleans, a `u8` and two
  optionals, 26 bytes in surge unpacked and 16 packed. Inside a packed
  subtree the booleans and the two presence flags are bits in the object's
  packed region (section 8 of
  [../specs/wire-format.md](../specs/wire-format.md)). The write side builds
  each byte of that region inline. The read side calls the runtime's
  `unpackBit` once per bit: the compiled fixture,
  `tests/out/bench/fixtures/packed-struct.luau`, holds twelve such calls.
- `CFrame array` and `CFrame array (packed, arbitrary)`: the same fifty
  `CFrame`s with arbitrary rotations, 1204 bytes in surge unpacked and 1254
  packed. A packed `CFrame` goes through the runtime's `writePackedCFrame` and
  `readPackedCFrame`, one call each per `CFrame`, and an arbitrary rotation
  takes the header byte plus the full form (wire-format 8.6).

The byte counts are from [../benchmarks/size.md](../benchmarks/size.md). The
axis-aligned packed `CFrame` row has no unpacked twin with the same values, so
it is not read here. Every other recorded reading of the toggles pair was
taken before the speed suite yielded, and is not a result
([frame-starvation.md](frame-starvation.md)).

## Method

- The run is the reference the re-measurement used: `mise run bench:speed`,
  two runs back to back in one invocation, nine trials per cell per run, as
  [../specs/benchmark-harness.md](../specs/benchmark-harness.md) specifies.
- Each library's packed row is compared with its own unpacked row in the same
  invocation, as a ratio of medians pooled over 18 trials. The toggles rows
  are measured one after the other; the two `CFrame` rows have the
  axis-aligned packed row between them.
- The control is the agreement between the two runs of the invocation, read
  as each run's own ratio, and the band two invocations of unchanged code
  disagree by: up to about 1.35× on a single cell
  ([noise-in-the-speed-tier.md](noise-in-the-speed-tier.md) and its
  correction). A ratio further from 1.00× than that, in both runs, is read as
  a result. That band is the wider of the two available on purpose: the
  narrower one, how far a cell moved between the two runs of this invocation
  (at most 7%, per `speed.md`), says nothing about how two rows of one Studio
  session drift against each other across sessions.
- `±` is the recorder's spread: the trials at the quarter and three-quarter
  positions of the sorted pooled trials, over the median.

## Results

Values per second, pooled over both runs, from
`docs/benchmarks/speed-trials.tsv`. Blink has no `Packed<T>` and no packed
rows.

The toggles pair:

| Library | Half   | Unpacked      | Packed        | Packed ÷ unpacked | Run 1  | Run 2  |
| ------- | ------ | ------------- | ------------- | ----------------- | ------ | ------ |
| surge   | encode | 2,218,116 ±4% | 2,351,908 ±2% | 1.060×            | 1.033× | 1.087× |
| surge   | decode | 2,620,184 ±5% | 1,509,352 ±2% | 0.576×            | 0.574× | 0.566× |
| fbs     | encode | 1,343,332 ±2% | 1,183,190 ±2% | 0.881×            | 0.882× | 0.883× |
| fbs     | decode | 1,470,656 ±3% | 1,181,900 ±2% | 0.804×            | 0.800× | 0.818× |
| serio   | encode | 410,340 ±3%   | 337,438 ±2%   | 0.822×            | 0.827× | 0.825× |
| serio   | decode | 632,622 ±3%   | 440,834 ±2%   | 0.697×            | 0.693× | 0.712× |

The arbitrary-rotation `CFrame` pair:

| Library | Half   | Unpacked    | Packed      | Packed ÷ unpacked | Run 1  | Run 2  |
| ------- | ------ | ----------- | ----------- | ----------------- | ------ | ------ |
| surge   | encode | 206,795 ±7% | 133,201 ±2% | 0.644×            | 0.657× | 0.631× |
| surge   | decode | 126,108 ±2% | 112,116 ±2% | 0.889×            | 0.898× | 0.883× |
| fbs     | encode | 195,269 ±4% | 28,780 ±1%  | 0.147×            | 0.150× | 0.145× |
| fbs     | decode | 118,552 ±2% | 108,688 ±2% | 0.917×            | 0.922× | 0.912× |
| serio   | encode | 17,468 ±1%  | 5,202 ±2%   | 0.298×            | 0.301× | 0.297× |
| serio   | decode | 31,442 ±2%  | 27,473 ±3%  | 0.874×            | 0.860× | 0.876× |

## Discussion

Two of surge's four readings are outside the noise, one per pair and on
opposite halves. The toggles decode is 1.74× in time and the `CFrame` encode
1.55×, each against a band of about 1.35×, and each run agrees with the pooled
figure within two points. The toggles encode (1.060×) is inside both bands.
The `CFrame` decode (0.889×, and 0.898× and 0.883× by run) is outside the
within-invocation movement and inside the between-invocation band, so this
paper does not establish it; a second invocation would.

The toggles decode loses about 0.28 µs a call, about 23 ns for each of its
twelve `unpackBit` calls, where the write side builds the region inline and
shows no loss. The `CFrame` encode loses about 2.7 µs a call, about 53 ns for
each of fifty `writePackedCFrame` calls, which classify each rotation before
writing it. Both are consistent with the runtime calls, but a call per item
does not predict a result by itself: the `CFrame` decode also makes one
`readPackedCFrame` call per item and is inside the noise. This run does not
isolate the calls, since no build here packed or unpacked inline.

On the `CFrame` pair, packing an arbitrary rotation also costs a header byte
per `CFrame`, so the packed row is both larger and slower. The packed form
saves bytes only where the header replaces a rotation or a position, which
the axis-aligned row shows and this pair cannot.

fbs and serio run slower packed on every reading, and fbs's packed `CFrame`
encode is 0.147×. Neither library's packing code was read for this, so why is
not examined here.

This covers two shapes on one machine, with `--!native` and `--!optimize 2` on
the fixtures. A shape with a different share of packed properties, or a build
that reads or writes the packed parts inline, may give a different ratio.

## Conclusion

On the toggles shape, `Packed<T>` saves ten of 26 bytes and costs surge's
decode 42% of its rate. On fifty arbitrary `CFrame` rotations, it adds 50
bytes and costs surge's encode 36% of its rate. Both results held in both runs
of the reference invocation. The other half of each pair is not established by
one invocation.

## Data

`docs/benchmarks/speed-trials.tsv` as committed at surge `a631584`: the
`toggles (unpacked)`, `toggles (packed)`, `CFrame array` and
`CFrame array (packed, arbitrary)` rows.
