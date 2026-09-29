# Packed bits read in place

2026-09-29 · surge `e7bffe0` · rbxts-transformer-surge `c006601` · Roblox
0.741.19.7411056

## Abstract

A `Packed<T>` region was read with one call to the package's `unpackBit` for
each bit, and on the packed toggles the hand-written codec decoded 1.93× as
fast as surge
([hand-written-union-and-packed-bits.md](hand-written-union-and-packed-bits.md)).
This change reads each byte of the region once into a local and tests each
bit against it with `bit32.btest`. Against the build before it, the packed
toggles' decode is 1.94× as fast, 299 ns a call, and no other row moved
outside 0.97× to 1.03×. In the same run, the hand-written codec decodes the
packed toggles at 0.98× surge's rate, where it was at 1.93×.

## Background

The packed toggles are ten booleans and two optionals in `Packed<T>`: a region
of twelve bits in two bytes, then the optionals' values and a `u8`. Before
this change their `deserialize` tested each bit with a call to the package:

```luau
a = __surge_unpackBit(__surge_input, pos9, 0),
```

and `unpackBit` read the bit with `buffer.readbits`. The read is now:

```luau
local bits10 = buffer.readu8(__surge_input, pos9)
local bits11 = buffer.readu8(__surge_input, pos9 + 1)
-- ...
a = bit32.btest(bits10, 1),
```

Transformer 5.24 states the read. A region binds at most 32 such locals, and
reads a byte past them in place for each of its bits; no catalog row has a
region of more than two bytes.

## Method

**Builds.** The reference is surge `fef70d8` and rbxts-transformer-surge
`499d768`, whose table is the one committed at surge `1ab4ac6`. The change is
surge `e7bffe0` and rbxts-transformer-surge `c006601`. Among surge's generated
code, the compiled fixture modules of the two builds differ only in the packed
toggles' `deserialize`.

**Runs.** The reference ran from 18:51 to 19:00 on 2026-09-29, and the change
from 19:15 to 19:24, each one full invocation of `mise run bench:speed`: two
Studio runs back to back, nine trials per cell per run. The CPU load at the
start was 3% and 1%, and no Roblox process was running at either start.

**Reading.** As in [size-and-read-locals.md](size-and-read-locals.md): the
change's surge median over the reference's, the drift `D` over the row's quiet
control cells, and the time a call takes against the reference,
`1/change − 1/reference`. The hand-written codec runs in the same Studio
process as surge, so its ratio to surge in the change's run is read as well,
pooled and for each run.

**Controls.** The fbs, serio, Blink and baseline columns, the fifteen decode
rows whose code did not change, and surge's encode.

## Results

Decode, from the reference's trials as committed at `1ab4ac6` and the
change's as committed at `f95c64e`:

| Row              | Reference   | Change      | Ratio | `D`       | Adjusted | Per call |
| ---------------- | ----------- | ----------- | ----- | --------- | -------- | -------- |
| toggles (packed) | 1.62M ±3.2% | 3.15M ±4.6% | 1.943 | 0.989 (3) | 1.965    | −299 ns  |

The fifteen other decode rows moved between 0.970× and 1.032× adjusted. The
lowest two were the tagged union, whose cell in the change's run spread 7.5%
and whose two Studio runs sat at 92.9k and 98.7k values a second, and
`Blink: Booleans`, which spread 6.9%. The quiet control cells moved 1.000×,
quartiles [0.994, 1.011] over 48.

Against the hand-written codec in the change's run, the packed toggles'
decode is 0.98×, and 0.989× and 0.981× by run, where the reference's run had
it at 1.93×. On the other four baseline rows the decode is between 0.98× and
1.03× by run. The packed toggles now decode at 1.10× the rate of the same
shape unpacked, 3.15M against 2.87M values a second in the same run.

## Discussion

The saving, 299 ns a call over twelve bits, is the whole of the gap the
hand-written codec measured, and the two reads now differ mostly in how they
move their positions. Reading the region's bytes into locals adds two locals
to the packed toggles' `deserialize`; a region of more than 32 bytes reads the
rest in place, and that path was not run, since no catalog row has one.

[packed-against-unpacked.md](packed-against-unpacked.md) measured the packed
toggles' decode at 0.576× the unpacked shape's. With the region read in place
the packed shape decodes faster than the unpacked one in this run, which holds
the same booleans in a byte each.

What this does not reach:

- The encode, which already built each byte of the region inline, did not
  change.
- A packed `CFrame` still goes through the package's `writePackedCFrame` and
  `readPackedCFrame`, which this does not touch.
- The fixtures run native. What the change is worth interpreted was not run.

## Conclusion

Reading each byte of a packed region once and testing its bits in place made
the packed toggles' decode 1.94× as fast, 299 ns a call, and brought it to
the hand-written codec's rate. No other row moved.

## Data

- The reference: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `1ab4ac6`, recorded
  at surge `fef70d8` and rbxts-transformer-surge `499d768`.
- The change: the same files as committed at surge `f95c64e`, recorded at
  surge `e7bffe0` and rbxts-transformer-surge `c006601`.
- The figures above were computed from the two `.tsv` files, with the
  recorder's own median, spread and noise rule.
