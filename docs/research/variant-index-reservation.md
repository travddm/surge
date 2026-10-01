# A variant's index reserved with its fields

2026-10-01 · surge `b223086` · rbxts-transformer-surge `62d4909` · Roblox
0.741.19.7411056

## Abstract

Each branch of a union's write reserved the variant's index on its own and
then the variant's fields, where the hand-written codec moves one position
once for each event
([union-write-tested-once.md](union-write-tested-once.md)). This change has
the index share the reservation of the fixed-size bytes that start the
variant. Against the build before it, the tagged union's encode is 1.001× and
the guarded union's 1.015× adjusted, both inside the band, and the
hand-written codec still encodes the tagged union 1.11× as fast as surge.
The change is kept for what the emitted code says, and it closes none of the
gap.

## Background

After [union-write-tested-once.md](union-write-tested-once.md), the tagged
union's write made two reservations for most events and three for one with a
string: the index, the variant's fixed fields, and a string's count and
bytes. With this change (Transformer 5.25) a `damage` event's branch is:

```luau
local pos12 = __surge_cursor
__surge_cursor = pos12 + 7
buffer.writeu8(__surge_scratch, pos12, 1)
local pos13 = pos12 + 1
buffer.writeu16(__surge_scratch, pos13, item5.amount)
```

one reservation of the index and both fields, and a `chat` event's is two.

## Method

**Builds.** The reference is surge `927eeff` and rbxts-transformer-surge
`6fb2441`, whose table is the one committed at surge `f5b3eaa`. The change is
surge `b223086` and rbxts-transformer-surge `62d4909`. Among surge's generated
code, the compiled fixture modules differ in the `serialize` of the tagged
union and of the guarded union.

**Runs.** The reference ran on 2026-09-29 from 19:36 to 19:45, and the change
on 2026-10-01 from 03:35 to 03:44, on the same Roblox build, each one full
invocation of `mise run bench:speed`: two Studio runs back to back, nine
trials per cell per run. At the change's start the CPU load was 7% and no
Roblox process was running. An earlier run of the change, on 2026-09-29, was
taken while a Roblox Player was open and is not read.

**Reading.** As in [union-write-tested-once.md](union-write-tested-once.md).
The rule for the change was set before the run: it stays unless either
union's encode is slower past the band.

**Controls.** The fbs, serio, Blink and baseline columns, and the fourteen
encode rows whose code did not change.

## Results

Encode, from the reference's trials as committed at `f5b3eaa` and the
change's as committed at `085f935`:

| Row           | Reference    | Change       | Ratio | `D`       | Adjusted | Runs, change   |
| ------------- | ------------ | ------------ | ----- | --------- | -------- | -------------- |
| tagged union  | 342.2k ±2.6% | 339.7k ±2.5% | 0.993 | 0.992 (4) | 1.001    | 339.5k, 339.8k |
| guarded union | 637.2k ±2.4% | 643.2k ±2.8% | 1.009 | 0.994 (2) | 1.015    | 630.4k, 648.5k |

The other encode rows moved between 0.986× and 1.016× adjusted, but for
`Blink: Booleans`, which ran at two speeds by run and is marked noisy. The
quiet control cells moved 0.990×, quartiles [0.982, 0.997] over 48.

Against the hand-written codec in the change's run, the tagged union's encode
is 1.11×, and 1.118× and 1.100× by run, where the reference's run had it at
1.10×.

## Discussion

One reservation fewer for each event did not move either row. On a shape
sized exactly, a reservation is a read of the cursor and a write to it, both
locals, and that is below what the speed tier reads on these rows. Of the two
differences [union-write-tested-once.md](union-write-tested-once.md) left
between surge's write and the hand-written one, this removes the cursor moves
as a candidate for the tagged union's gap, which is where it was. The other,
the size reading each element's tag once for each comparison, was not tried.

The two runs are two days apart. The Roblox build is the same, and the drift
between them over the quiet control cells is 0.990×.

## Conclusion

Reserving a variant's index with the fixed-size bytes after it changes
nothing the speed tier can read: 1.001× on the tagged union's encode and
1.015× on the guarded union's. The tagged union stays 1.11× behind
hand-written Luau.

## Data

- The reference: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `f5b3eaa`.
- The change: the same files as committed at surge `085f935`, recorded at
  surge `b223086` and rbxts-transformer-surge `62d4909`.
- The figures above were computed from the two `.tsv` files, with the
  recorder's own median, spread and noise rule.
