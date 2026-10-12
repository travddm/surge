# Reservations at the cursor's known value

2026-10-10 · surge `62d4ea2`, `c0635cf` and `0d4ad4d` · Lune 0.10.5 · Roblox
0.742.0.7421053

## Abstract

A pass over each generated `serialize` and `deserialize` follows the write
or read cursor's value: as a number from where the function sets it to one,
or as a position read from the cursor plus a number. A reservation at a
known value reads no position from the cursor, adjacent reservations move
the cursor once, and an assignment of the cursor that nothing reads is not
emitted. Applied to every block, it took 5.2% off the bytecode of the twenty
surge modules of the benchmark, and failed the reading stated before the
runs in two pairs of runs: the instance references' encode measured 0.910×
and 0.887× adjusted, below what unchanged code moved. Left out of loop
bodies, it takes 4.9% off, and 17.2% off the wide struct, which makes
surge's module smaller than Flamework 2's on every row both cover. No byte
changed, and against two runs of the reference no surge cell moved further
than unchanged code did. That form is kept.

## Background

The pass is `rbxts-transformer-surge/src/emit/fold.ts` (Transformer 5.30 and
5.31 in [specs/transformer.md](../specs/transformer.md)). It runs on each
`serialize`, `deserialize` and cursor codec's `write` and `read` whose codec
has no recursion helper, after the emitter has written it.

**A head of fixed size.** At `62d4ea2`, each reservation read the cursor
into a position local and moved the cursor, and each later field of a run
was an offset from that local. The small flat struct's write:

```luau
local __surge_scratch = buffer.create(17)
local __surge_cursor = 0
local pos1 = __surge_cursor
__surge_cursor = pos1 + 17
buffer.writeu8(__surge_scratch, pos1, if value.active then 1 else 0)
local pos2 = pos1 + 1
buffer.writeu32(__surge_scratch, pos2, value.id)
-- ...
```

The cursor is 0 there, so each position is a number, and nothing reads the
cursor after the last field, so it is not declared:

```luau
local __surge_scratch = buffer.create(17)
buffer.writeu8(__surge_scratch, 0, if value.active then 1 else 0)
buffer.writeu32(__surge_scratch, 1, value.id)
-- ...
```

Each offset was a constant of the function, and is now a number an
instruction carries. A read is folded the same way, into its table
constructor.

**Adjacent reservations.** A run of fixed-size properties shares one
reservation within one object (Transformer 5.5), but two runs, or a run and
the fixed bytes that start an optional or a union variant, each read and
moved the cursor. The deeply nested object's `count` and `flag` are in two
objects:

```luau
local pos9 = __surge_cursor
__surge_cursor = pos9 + 2
buffer.writeu16(__surge_scratch, pos9, obj2.count)
local pos10 = __surge_cursor
__surge_cursor = pos10 + 1
buffer.writeu8(__surge_scratch, pos10, if obj3.flag then 1 else 0)
```

Folded, they are written at 0 and 2, and the cursor is declared at 3. Where
the cursor's value is not a number, such as after a string, the second
reservation is an offset from the first's position, and the cursor moves
once, past both, before the next statement that reads it.

**Assignments nothing reads.** A `serialize` sized exactly moved its cursor
past its last reservation, and a `deserialize` its read cursor past its last
read, where nothing read either again; so did each branch of a union. They
are not emitted, and a cursor that nothing reads is not declared.

**Loop bodies.** The first build, `c0635cf`, folded a loop's body as it does
any block: the body's reservations became offsets from the position its
first one reads, and the cursor was set once, at the end of the body. The
instance references' write, one `u16` and a blob for each element:

```luau
-- 62d4ea2
local pos6 = __surge_cursor
__surge_cursor = pos6 + 2
buffer.writeu16(__surge_scratch, pos6, item5.health)
do
	-- the blob
end
-- c0635cf
local pos6 = __surge_cursor
buffer.writeu16(__surge_scratch, pos6, item5.health)
do
	-- the blob
end
__surge_cursor = pos6 + 2
```

Variant A set the cursor where the statements that use a reservation's
positions end, here after the `u16`, and variant B left a loop's body as the
emitter wrote it, but for the positions known before the loop. Each was a
temporary build of `c0635cf`, not kept. `0d4ad4d` is variant B: its
generated code is the same, byte for byte, in every benchmark module.

**What it leaves.** A codec with a recursion helper keeps every reservation
as it was: a helper's read moves the closure's read cursor with nothing in
the caller's statements to show it. Of the catalog, that is the tree.

## Method

**Builds.** The reference is `62d4ea2`. The first build is `c0635cf`, whose
two runs name `75d3107`, a later commit with the same code; the first of
them also names an uncommitted `docs/benchmarks/code-size.md`. Variants A
and B name temporary commits, `efb28ab` and `39ba78b`. The kept build is
`0d4ad4d`; its run names the same uncommitted file.

**Runs.** Each is one full invocation of `mise run bench:speed`: two Studio
runs back to back, nine trials per cell per run. At each start no Roblox
process was running, and the CPU load, averaged over fifteen one-second
samples of `Get-Counter`, was the figure below.

| Set | Build           | UTC           | Load  |
| --- | --------------- | ------------- | ----- |
| 1   | reference       | 02:02 – 02:16 | 6.4%  |
| 1   | first build     | 02:17 – 02:31 | 7.3%  |
| 2   | reference       | 02:35 – 02:49 | 6.8%  |
| 2   | first build     | 02:51 – 03:04 | 16.0% |
| 2   | variant A       | 03:05 – 03:19 | 13.7% |
| 3   | variant B       | 03:23 – 03:37 | 8.1%  |
| 3   | reference       | 03:38 – 03:52 | 4.6%  |
| 3   | kept, `0d4ad4d` | 03:58 – 04:12 | 6.1%  |

Sets 2 and 3 were run after the first set failed the reading below.

**Code size.** `mise run bench:code` at each commit
([benchmarks/code-size.md](../benchmarks/code-size.md)), and
`mise run bench:size` at `c0635cf` and `0d4ad4d` against
[benchmarks/size.md](../benchmarks/size.md).

**Controls.** The fbs, serio, flamework2, Blink and hand-written columns.
`D` is the median ratio of the row's quiet control cells, the hand-written
cell included, and the adjusted ratio is the ratio over `D`. The tree's
surge cells, whose code did not change, are reported with them.

**Reading.** Written before any run's result: every surge module changed but
the tree's, so how far unchanged code moves between the two runs is read
from the control cells: each quiet control cell's ratio over the median
ratio of the other quiet control cells of its row. The change stays if the
code is smaller and no surge cell's adjusted ratio is below the lowest of
those in its half. A surge cell whose two runs of the change are both below
both runs of the reference is reported.

## Results

Bytecode of each surge module, in bytes:

| Module                   | Reference | First build | Kept   | Kept, bytes | Kept, % |
| ------------------------ | --------- | ----------- | ------ | ----------- | ------- |
| blink-benches (booleans) | 1,403     | 1,370       | 1,370  | −33         | −2.4    |
| blink-benches (entities) | 2,070     | 2,036       | 2,036  | −34         | −1.6    |
| cframes                  | 2,368     | 2,315       | 2,315  | −53         | −2.2    |
| cframes (packed)         | 1,611     | 1,569       | 1,569  | −42         | −2.6    |
| enum-heavy               | 2,447     | 2,405       | 2,405  | −42         | −1.7    |
| guarded-union            | 2,412     | 2,375       | 2,398  | −14         | −0.6    |
| instance-refs            | 1,834     | 1,820       | 1,820  | −14         | −0.8    |
| large-array              | 1,415     | 1,363       | 1,363  | −52         | −3.7    |
| large-record             | 2,134     | 2,104       | 2,104  | −30         | −1.4    |
| leaderboard              | 2,121     | 2,089       | 2,107  | −14         | −0.7    |
| nested-arrays            | 1,845     | 1,831       | 1,831  | −14         | −0.8    |
| nested-object            | 2,465     | 2,367       | 2,367  | −98         | −4.0    |
| packed-struct (packed)   | 3,018     | 2,925       | 2,925  | −93         | −3.1    |
| packed-struct (unpacked) | 3,791     | 3,403       | 3,403  | −388        | −10.2   |
| small-flat-struct        | 1,130     | 958         | 958    | −172        | −15.2   |
| string-heavy             | 2,637     | 2,608       | 2,608  | −29         | −1.1    |
| tagged-union             | 3,574     | 3,433       | 3,558  | −16         | −0.4    |
| tree                     | 1,876     | 1,876       | 1,876  | 0           | 0.0     |
| tuples                   | 1,689     | 1,637       | 1,637  | −52         | −3.1    |
| wide-struct              | 6,845     | 5,670       | 5,670  | −1,175      | −17.2   |
| total                    | 48,685    | 46,154      | 46,320 | −2,365      | −4.9    |

The first build took 2,531 bytes off, 5.2%. Flamework 2's wide struct is
6,027 bytes, so surge's module is now the smaller on every row both have.
[benchmarks/size.md](../benchmarks/size.md) is unchanged. In every run, each
cell's round trip in Roblox was within what the size table records for it
(Benchmark harness 6.6 in
[specs/benchmark-harness.md](../specs/benchmark-harness.md)).

The lowest quiet surge cell of each comparison, adjusted, and the lowest
that unchanged code moved. No surge cell marked noisy in a run is below the
line in any comparison, so leaving those out changes no outcome:

| Comparison                 | Half   | Lowest surge cell          | Unchanged code |
| -------------------------- | ------ | -------------------------- | -------------- |
| first build, set 1         | encode | 0.910, instance references | 0.933          |
| first build, set 1         | decode | 0.940, guarded union       | 0.967          |
| first build, set 2         | encode | 0.887, instance references | 0.950          |
| first build, set 2         | decode | 0.944, large record        | 0.960          |
| variant A, set 2           | encode | 0.936, instance references | 0.955          |
| variant A, set 2           | decode | 0.918, guarded union       | 0.959          |
| variant B, set 2 reference | encode | 0.973, packed toggles      | 0.959          |
| variant B, set 2 reference | decode | 0.986, large record        | 0.964          |
| variant B, set 3 reference | encode | 0.972, large array         | 0.960          |
| variant B, set 3 reference | decode | 0.983, tree                | 0.966          |
| kept, set 3 reference      | encode | 0.971, large array         | 0.932          |
| kept, set 3 reference      | decode | 0.988, string-heavy        | 0.967          |

In set 1, the first build's cells below the line were the instance
references' encode, 938.2k to 846.1k values a second, with runs of 957.9k and
927.5k, and 846.1k and 846.2k; `Blink: Booleans`' encode, 0.917×; and the
guarded union's, the instance references' and `Blink: Booleans`' decode,
0.940×, 0.944× and 0.948×. In set 2, the instance references' encode, 962.8k
to 846.1k, both runs below again, and the large record's decode, 0.944×,
whose runs were not both below.

The two rows across the builds, adjusted against the reference of the same
set:

| Cell                       | First build, set 1 | First build, set 2 | Variant A | Variant B, set 2 | Variant B, set 3 | Kept  |
| -------------------------- | ------------------ | ------------------ | --------- | ---------------- | ---------------- | ----- |
| instance references encode | 0.910              | 0.887              | 0.936     | 1.003            | 0.982            | 0.987 |
| instance references decode | 0.944              | 0.967              | 0.991     | 1.003            | 1.003            | 0.990 |
| guarded union decode       | 0.940              | 0.961              | 0.918     | 0.999            | 0.997            | 0.999 |
| tree encode                | 0.956              | 1.006              | 1.024     | 1.009            | 1.007            | 1.008 |
| tree decode                | 1.004              | 1.005              | 1.002     | 0.987            | 0.983            | 0.998 |

The quiet control cells moved 0.996× on encode, quartiles [0.987, 1.002]
over 77, and 1.000× on decode, [0.989, 1.008] over 71, in set 1; 0.992×,
[0.976, 0.999] over 78, and 0.989×, [0.982, 1.007] over 75, between set 2's
reference and first build; and 0.997×, [0.988, 1.004] over 80, and 1.001×,
[0.994, 1.011] over 80, between set 3's reference and the kept build.

## Discussion

- The first build failed the reading in both pairs, on the same cell, by
  more than any control moved. Its loop bodies are where the two rows'
  code differs most: the instance references' write and read are one loop
  each, and the guarded union's read a loop whose branches each read the
  cursor. With the loop bodies as written, those cells measured as the
  reference did, against two of its runs.
- What in a folded loop's body is slower is not established. It runs the
  same number of instructions as the reference's; what changed is where the
  cursor is set, and for how long a position local is live. Variant A,
  which moved only where the cursor is set, recovered the instance
  references' decode and part of their encode, and measured the guarded
  union's decode lower.
- The kept form gives up 166 bytes against the first build, on the three
  rows whose loops held a branch or more than one reservation: the tagged
  union, the guarded union and the leaderboard.
- The tree's encode moved 0.956× in set 1 with its code unchanged, which is
  what the other libraries' cells are there to bound.
- On this machine and date, several cells of every library but serio
  measured slower than in the runs of 2026-10-09: the large array's encode
  at 202k for surge, where `docs/benchmarks/speed.md` as committed at
  `93ebfde` records 305k, and 182k and 92k for Flamework 2 and Blink, against 254k and 132k.
  Each comparison above is between runs of one set, back to back.
- In set 2 the load at the first build's and variant A's starts, 16.0% and
  13.7%, was above the 4.6% to 8.1% of the other runs, from programs the
  machine's user had open; it stayed below the 25% the speed tier allows.
- The selection of variant B was made after the first build failed, and its
  reading against set 2's reference is against a run made before it; set 3
  ran the reference after variant B, and the kept build after both.
- The figures are from one machine and one Roblox version, with `--!native`
  and `--!optimize 2` on the generated modules.

## Conclusion

Following the cursor's value takes 4.9% off the bytecode of the benchmark's
surge modules, 17.2% off the wide struct and 15.2% off the small flat
struct, with no surge cell moving further than unchanged code moves between
two runs, once a loop's body is left as the emitter wrote it. Folded into
loop bodies too, it took 5.2% off and slowed the instance references' encode
by about a tenth.

## Data

- The runs of sets 1 to 3, as `speed.md` and the trials behind it, each in
  `docs/research/data/`:
  [reference 1](data/cursor-known-values-reference-1.md) and
  [its trials](data/cursor-known-values-reference-1.tsv),
  [first build 1](data/cursor-known-values-first-build-1.md) and
  [its trials](data/cursor-known-values-first-build-1.tsv),
  [reference 2](data/cursor-known-values-reference-2.md) and
  [its trials](data/cursor-known-values-reference-2.tsv),
  [first build 2](data/cursor-known-values-first-build-2.md) and
  [its trials](data/cursor-known-values-first-build-2.tsv),
  [variant A](data/cursor-known-values-variant-a.md) and
  [its trials](data/cursor-known-values-variant-a.tsv),
  [variant B](data/cursor-known-values-variant-b.md) and
  [its trials](data/cursor-known-values-variant-b.tsv),
  [reference 3](data/cursor-known-values-reference-3.md) and
  [its trials](data/cursor-known-values-reference-3.tsv).
- The kept build: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed with this paper, recorded
  at `0d4ad4d`.
- The bytecode: `docs/benchmarks/code-size.md` as committed at `62d4ea2` and
  with this paper, and the first build's from `mise run bench:code` at
  `c0635cf`, in the table above.
- The figures above were computed from the `.tsv` files, with the recorder's
  own median, spread and noise rule.

## Correction, 2026-10-11

This corrects what the Method says can be checked out. The two variants'
commits, `efb28ab` and `39ba78b`, were never on a branch or a tag of this
repository, so a clone cannot check out either. Variant B's generated code
is the same as `0d4ad4d`'s, byte for byte, as the Background states under
Loop bodies, so its build can be repeated from that commit. Variant A's
cannot: what remains of it is its description there and its trials in
`data/cursor-known-values-variant-a.tsv`. No figure and no conclusion
changes.
