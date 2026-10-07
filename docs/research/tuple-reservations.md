# A tuple's fixed-size elements in one reservation

2026-10-07 · surge `f0a321f` · rbxts-transformer-surge `72a4887` · Roblox
0.741.19.7411056

## Abstract

A tuple's fixed elements each reserved on their own, and a tuple had no
fixed size, so an array of tuples reserved inside its loop and read each
tuple into a table it then filled. This change shares a reservation among a
tuple's consecutive fixed-size elements, and makes a tuple of only fixed-size
elements fixed-size: it joins the run around it, and an array of such tuples
reserves every element once. On a new catalog row of 50 tuples of a `u16` and
two `f32`, encode is 1.090× and decode 1.163× adjusted, 0.059 µs and 0.554 µs
less a call. The hand-written codec, which was 1.10× and 1.15× ahead, is
level with surge on both halves. The change is kept.

## Background

Sharing a reservation among a tuple's elements was expected to pay little: on
a shape sized exactly, a merged reservation saves only a cursor move, and
cursor moves had measured as no change
([variant-index-reservation.md](variant-index-reservation.md)). The catalog had
no row with a tuple, so the change came with one, the tuples row (Benchmark
harness 3.1 in [specs/benchmark-harness.md](../specs/benchmark-harness.md)):
504 bytes, which surge, fbs, serio and the hand-written codec each write.
Blink and Zap have no tuple type.

Before this change, the row's `deserialize` read each tuple as:

```luau
local tup13 = table.create(3)
local pos14 = __surge_readCursor
__surge_readCursor = pos14 + 2
tup13[1] = buffer.readu16(__surge_input, pos14)
local pos15 = __surge_readCursor
__surge_readCursor = pos15 + 4
tup13[2] = buffer.readf32(__surge_input, pos15)
local pos16 = __surge_readCursor
__surge_readCursor = pos16 + 4
tup13[3] = buffer.readf32(__surge_input, pos16)
result11[i12] = tup13
```

and its `serialize` made the same three reservations. With this change
(Transformer 5.5 and 5.21 in [specs/transformer.md](../specs/transformer.md)),
the array reserves all of its elements ahead of the loop (Transformer 5.18),
and each tuple is read as:

```luau
local pos14 = element13 + 2
local pos15 = element13 + 6
result10[i11] = { buffer.readu16(__surge_input, element13), buffer.readf32(__surge_input, pos14), buffer.readf32(__surge_input, pos15) }
element13 += 10
```

and written at the same offsets. A tuple inside an object's run takes its
bytes from that run and binds nothing, as a nested object does. Outside a
run, a tuple's consecutive fixed-size elements share a reservation, as an
object's properties do; a tuple with a rest keeps reading its rest as before.
No byte changed: the byte pins of `bytes.spec.ts`, which hold a tuple, pass.

Among the fixture modules, only the tuples row's surge module changed, and
[benchmarks/code-size.md](../benchmarks/code-size.md) took it from 1,064 to
1,091 bytes of bytecode.

## Method

**Builds.** The reference is surge `f0a321f` and rbxts-transformer-surge
`a566bd2`. The change is surge `f0a321f` and rbxts-transformer-surge
`72a4887`. Each run's compiled tuples module was kept.

**Runs.** Each is one full invocation of `mise run bench:speed`: two Studio
runs back to back, nine trials per cell per run. The reference ran from 22:43
to 22:53 UTC, and the change from 22:54 to 23:04 UTC. At each start no Roblox
process was running, and the CPU load, averaged over fifteen one-second
samples of `Get-Counter`, was 6% both times.

**Reading.** Fixed before the runs: the change stays only if the tuples row is
faster on at least one half, with both runs of the change above both runs of
the reference, and the cell is not marked noisy, and neither half is slower
with both runs of the change below both runs of the reference.

**Controls.** The fbs, serio, Blink and baseline columns, and the nineteen
rows whose code did not change.

## Results

The tuples:

| Half   | Reference    | Change       | Ratio | `D`       | Adjusted | µs a call | Runs, reference  | Runs, change     |
| ------ | ------------ | ------------ | ----- | --------- | -------- | --------- | ---------------- | ---------------- |
| encode | 1.30M ±2.0%  | 1.41M ±4.1%  | 1.083 | 0.994 (3) | 1.090    | −0.059    | 1304.7k, 1299.8k | 1415.9k, 1367.3k |
| decode | 246.5k ±1.6% | 285.6k ±3.3% | 1.158 | 0.996 (3) | 1.163    | −0.554    | 247.3k, 243.7k   | 286.4k, 281.9k   |

The other encode rows moved between 0.975× and 1.041× adjusted, but for
`Blink: Booleans`, which moved 0.910× and runs at one of two speeds per Studio
process ([benchmark-tooling.md](../future-work/benchmark-tooling.md)). The
quiet control cells moved 1.003× on encode, quartiles [0.994, 1.014] over 59.
The other decode rows moved between 0.977× and 1.008×, and the quiet control
cells 1.003×, quartiles [0.996, 1.008] over 58.

Against the hand-written codec, the tuples' encode is 1.00× in the change's
run, and 1.006× and 1.013× by run, where the reference had it at 1.10×, and
1.096× and 1.091× by run. Their decode is 0.99×, and 1.005× and 0.996× by
run, where it was 1.15×, and 1.142× and 1.168× by run.

## Discussion

Both halves moved in both runs, clear of both runs of the reference, and no
other row moved. The plan had expected little, because on a shape sized
exactly a merged reservation saves only a cursor move. That holds for the
merge itself; what paid is what a fixed size lets the array do. The array
reserves its elements once, and each tuple is read into one table
constructor, where it was a table created at three slots and filled by three
stores, each after a cursor move. The decode saved about 11 ns a tuple and
the encode about 1.2 ns, and both halves are now level with the hand-written
codec, which writes and reads at offsets and constructs each table whole.

## Conclusion

Sharing reservations among a tuple's fixed-size elements, and treating a
tuple of only fixed-size elements as fixed-size, is worth 1.090× on the tuples
row's encode and 1.163× on its decode, and closes the gap to the hand-written
codec on both halves.

## Data

- The reference:
  [data/before-tuple-reservations.md](data/before-tuple-reservations.md) and
  [data/before-tuple-reservations.tsv](data/before-tuple-reservations.tsv),
  recorded at surge `f0a321f` and rbxts-transformer-surge `a566bd2`.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `764071d`,
  recorded at surge `f0a321f` and rbxts-transformer-surge `72a4887`.
- The figures above were computed from the two `.tsv` files, with the
  recorder's own median, spread and noise rule.
