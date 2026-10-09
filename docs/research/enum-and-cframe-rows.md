# The enum and `CFrame` rows against Flamework 2

2026-10-09 · surge `c09f0a4`, `28a5b03`, `067d228` and `9cb7f4e` · Roblox
0.742.0.7421053

## Abstract

The experimental Flamework 2 encoded the enum row 1.74× and the `CFrame`
array 1.13× as fast as surge, and decoded the `CFrame` array 2.08× as fast
([flamework2-column.md](flamework2-column.md)). This measures three changes
to surge's generated code aimed at those cells, none of which changes a byte.
Reading a `CFrame` into one constructor from a quaternion is worth 1.655× to
1.677× on the `CFrame` array's decode, and is kept. Finding an enum item's
index by its `Value` measured 0.934× on the enum row's encode, and writing a
`CFrame` from `GetComponents` measured 0.814× on the `CFrame` array's
encode; both are withdrawn.

## Background

On the two rows, Flamework 2's generated code differs from surge's in what it
writes as well as in how
([flamework2-column.md](flamework2-column.md)). It writes an enum item's
`Value` as a u16, and reads the item back through a table keyed by `Value`. It
writes a `CFrame` as the twelve numbers `GetComponents` returns, and reads it
with one `CFrame.new` of those twelve.

surge writes an enum item as its index among the items in name order (Wire
format 4.12 in [specs/wire-format.md](../specs/wire-format.md)), which its
write finds in a table keyed by the item's `Name`. It writes a `CFrame` as its
position and an axis-angle, 24 bytes (Wire format 4.8). At `c09f0a4`, one
element of the `CFrame` array is written and read with:

```luau
local position6 = item3.Position
-- three writef32 of position6
local axis7, angle8 = item3:ToAxisAngle()
local rv9 = axis7 * angle8
-- three writef32 of rv9

local pos16 = Vector3.new(--[[ three readf32 ]])
local rv17 = Vector3.new(--[[ three readf32 ]])
local angle18 = rv17.Magnitude
local rotation19 = CFrame.fromAxisAngle(if angle18 > 1e-6 then rv17.Unit else Vector3.zAxis, angle18)
result12[i13] = rotation19 + pos16
```

The three changes, each keeping surge's bytes:

- **The enum write by `Value`** (`28a5b03`). The write's table is keyed by
  each item's `Value`, filled from the module's list of the items when it
  loads, and the write reads `item.Value` where it read `item.Name`. No two
  items of one enum that `@rbxts/types` 1.0.952 declares share a `Value`, out
  of 631 enums. An `EnumItem` itself cannot be the key: under Lune, the round
  trip suite's runner, `Enum.X.Y` is a new object on each access.
- **The `CFrame` read through a quaternion** (`28a5b03`). The read turns the
  axis-angle into a unit quaternion and builds the result with one
  constructor (Transformer 5.27 in
  [specs/transformer.md](../specs/transformer.md)):

    ```luau
    local rv16 = Vector3.new(--[[ three readf32 ]])
    local angle17 = math.sqrt(rv16.X * rv16.X + rv16.Y * rv16.Y + rv16.Z * rv16.Z)
    local scale18 = if angle17 > 1e-6 then math.sin(angle17 * 0.5) / angle17 else 0.5
    result12[i13] = CFrame.new(--[[ three readf32 ]], rv16.X * scale18, rv16.Y * scale18, rv16.Z * scale18, math.cos(angle17 * 0.5))
    ```

- **The `CFrame` write from `GetComponents`** (`067d228`). The write takes
  the position and the rotation matrix from one `GetComponents` call, turns
  the matrix into a unit quaternion through its largest component, and the
  quaternion into an axis-angle with `math.atan2`, in a block of its own for
  each `CFrame`.

## Method

**Builds.** Four, each a commit of this repository, run in order:

| Build     | Commit    | Enum write | `CFrame` write  | `CFrame` read      |
| --------- | --------- | ---------- | --------------- | ------------------ |
| Reference | `c09f0a4` | by `Name`  | `ToAxisAngle`   | `fromAxisAngle`    |
| A         | `28a5b03` | by `Value` | `ToAxisAngle`   | through quaternion |
| B         | `067d228` | by `Name`  | `GetComponents` | through quaternion |
| C         | `9cb7f4e` | by `Name`  | `ToAxisAngle`   | through quaternion |

Among the benchmark's modules, only the enum row's and the `CFrame` array's
surge modules differ between the builds. The packed `CFrame` rows read and
write through the package's functions, which no build changes. The
reference's and build A's trials files name their commit with
"(uncommitted changes)": the transformer's source was being edited during
those runs, and a run builds the tests place from the transformer's compiled
output, which was not rebuilt until each run had ended.

**Runs.** Each is one full invocation of `mise run bench:speed`: two Studio
runs back to back, nine trials per cell per run. The reference ran from 05:51
to 06:04 UTC, A from 06:08 to 06:22, B from 06:28 to 06:42, and C from 06:48
to 07:02. At each start no Roblox process was running, and the CPU
load, averaged over fifteen one-second samples of `Get-Counter`, was 8.9%,
5.8%, 4.7% and 9.3%.

**Reading.** Fixed before the runs: a change stays only if its cell is
faster, with both runs of the change above both runs of the reference, and
the cell is not marked noisy. Each build is read against the reference.

**Controls.** The fbs, serio, flamework2, Blink and baseline columns, and the
nineteen rows whose code no build changed. `D` is the median ratio of the
row's quiet control cells, with their number, and the adjusted ratio is the
ratio over `D`.

## Results

Each build against the reference, on the cells whose code it changed. No
cell here is marked noisy. A negative time a call is time saved.

| Build | Row, half            | Reference    | Change       | Ratio | `D`       | Adjusted | µs a call | Runs, reference | Runs, change   |
| ----- | -------------------- | ------------ | ------------ | ----- | --------- | -------- | --------- | --------------- | -------------- |
| A     | enum-heavy, encode   | 321.4k ±0.9% | 300.3k ±0.6% | 0.934 | 0.991 (3) | 0.943    | +0.219    | 321.5k, 321.4k  | 299.6k, 300.4k |
| A     | CFrame array, decode | 140.8k ±1.4% | 236.1k ±2.6% | 1.677 | 0.995 (5) | 1.685    | −2.867    | 140.8k, 140.2k  | 238.1k, 233.0k |
| B     | CFrame array, encode | 268.8k ±1.1% | 218.9k ±0.5% | 0.814 | 1.011 (5) | 0.805    | +0.849    | 269.2k, 268.8k  | 219.3k, 218.7k |
| B     | CFrame array, decode | 140.8k ±1.4% | 233.2k ±1.6% | 1.656 | 0.989 (5) | 1.674    | −2.814    | 140.8k, 140.2k  | 232.6k, 233.8k |
| C     | CFrame array, decode | 140.8k ±1.4% | 233.0k ±1.9% | 1.655 | 0.982 (5) | 1.685    | −2.810    | 140.8k, 140.2k  | 233.3k, 232.1k |

The same cells where a build had the reference's code:

| Build | Row, half            | Change       | Ratio | `D`       | Adjusted | Runs, change   |
| ----- | -------------------- | ------------ | ----- | --------- | -------- | -------------- |
| A     | CFrame array, encode | 269.7k ±1.3% | 1.003 | 1.001 (5) | 1.002    | 269.6k, 270.1k |
| B     | enum-heavy, encode   | 313.9k ±2.0% | 0.976 | 0.999 (3) | 0.978    | 318.6k, 312.9k |
| C     | enum-heavy, encode   | 319.3k ±2.7% | 0.993 | 0.993 (3) | 1.000    | 322.7k, 314.0k |
| C     | CFrame array, encode | 267.3k ±1.1% | 0.994 | 1.001 (5) | 0.993    | 266.7k, 268.1k |

Both runs of A's enum write are below all six runs of the write by `Name`,
the lowest of which is B's second, at 312.9k. Both runs of B's `CFrame`
write are below all six runs of the write by `ToAxisAngle`, the lowest of
which is C's first, at 266.7k. The read through a quaternion is above the
reference in all six of its runs, by at least 232.1k against 140.8k.

The quiet control cells moved, against the reference:

| Build | Encode                                 | Decode                                 |
| ----- | -------------------------------------- | -------------------------------------- |
| A     | 1.007×, quartiles [0.998, 1.021] of 78 | 0.998×, quartiles [0.994, 1.006] of 74 |
| B     | 1.009×, quartiles [0.999, 1.023] of 78 | 0.999×, quartiles [0.991, 1.011] of 76 |
| C     | 1.001×, quartiles [0.990, 1.014] of 78 | 0.989×, quartiles [0.984, 0.997] of 75 |

surge's quiet rows whose code no build changed moved between 0.934× and 1.074× on
encode, and between 0.953× and 1.042× on decode. The large array's encode was
the lowest in each build, at 0.952×, 0.942× and 0.934×.

Flamework 2's throughput over surge's, in each build's run:

| Row, half            | Reference | A     | B     | C     |
| -------------------- | --------- | ----- | ----- | ----- |
| enum-heavy, encode   | 1.71×     | 1.81× | 1.74× | 1.70× |
| CFrame array, encode | 1.14×     | 1.12× | 1.40× | 1.11× |
| CFrame array, decode | 2.08×     | 1.23× | 1.24× | 1.23× |

In C's run, the hand-written codec, whose `CFrame` read is the reference's,
decodes the `CFrame` array at 142.3k, 0.61× surge's 233.0k, and encodes it at
268.6k, 1.00× surge's.

C's `CFrame` array module is 1,747 bytes of bytecode, where the reference's
is 1,588 ([benchmarks/code-size.md](../benchmarks/code-size.md)). Its round
trip in [benchmarks/size.md](../benchmarks/size.md) is within 2e-7 in every
component, as the reference's was.

## Discussion

- The read through a quaternion saved 56 ns to 57 ns for each `CFrame` on
  decode, in each of the three builds that carry it. It replaces two `CFrame`
  constructions and the vector's `Magnitude` and `Unit` with one
  constructor, `math.sqrt`, `math.sin` and `math.cos`. Which of these the
  time was in was not probed. Flamework 2 still decodes the row 1.23× as
  fast, from twelve reads and one constructor with no trigonometry. The run
  does not separate the reads from the trigonometry either.
- A quantized `CFrame` takes the same read (Transformer 5.27), and no catalog
  row times one. `roundTripsAQuantizedRotationWithinItsStep` passes on it.
- The enum write by `Value` read a number property where the write by `Name`
  read a string, and looked it up in a table keyed by numbers where the other
  was keyed by strings. The run does not separate the property read from the
  lookup. Flamework 2's write has no lookup: it writes the `Value` itself, two
  bytes where surge writes one index byte, so its lead on the row's encode is
  in its format as much as in its code.
- A table keyed by the `EnumItem` itself would need no property read. It was
  not measured: under Lune the lookup would always miss, so the round trip
  suite could not run it, and the speed tier does not check what it decodes.
- The write from `GetComponents` made one engine call where the write by
  `ToAxisAngle` makes two, and did the matrix's conversion in Luau where
  `ToAxisAngle` does it in the engine. It took about 17 ns more for each
  `CFrame`.
- The hand-written codec builds each `CFrame` with `fromAxisAngle` and `+`,
  as the reference does, so on the `CFrame` array's decode it no longer
  measures what surge's generated code costs against hand-written Luau
  (Benchmark harness 4.5 in
  [specs/benchmark-harness.md](../specs/benchmark-harness.md)).
- Each figure is from one machine and one Roblox version, with `--!native`
  and `--!optimize 2` on the generated modules.

## Conclusion

Reading a `CFrame` into one constructor from a quaternion is worth 1.655× to
1.677× on the `CFrame` array's decode, and leaves Flamework 2 1.23× ahead on
it, where it was 2.08×. It is kept. Finding an enum item's index by its
`Value` measured 0.934×, and writing a `CFrame` from `GetComponents` 0.814×;
both are withdrawn, and Flamework 2's lead on those two cells stays.

## Data

- The reference:
  [data/before-enum-and-cframe-rows.md](data/before-enum-and-cframe-rows.md)
  and
  [data/before-enum-and-cframe-rows.tsv](data/before-enum-and-cframe-rows.tsv),
  recorded at `c09f0a4`.
- Build A:
  [data/build-a-enum-and-cframe-rows.md](data/build-a-enum-and-cframe-rows.md)
  and
  [data/build-a-enum-and-cframe-rows.tsv](data/build-a-enum-and-cframe-rows.tsv),
  recorded at `28a5b03`.
- Build B:
  [data/build-b-enum-and-cframe-rows.md](data/build-b-enum-and-cframe-rows.md)
  and
  [data/build-b-enum-and-cframe-rows.tsv](data/build-b-enum-and-cframe-rows.tsv),
  recorded at `067d228`.
- Build C: `docs/benchmarks/speed.md` and `docs/benchmarks/speed-trials.tsv`
  as committed with this paper, recorded at `9cb7f4e`.
- The figures above were computed from the `.tsv` files, with the recorder's
  own median, spread and noise rule.
