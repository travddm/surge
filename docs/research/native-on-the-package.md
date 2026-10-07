# Native code generation on the package's modules

2026-10-07 · surge `782356d` · rbxts-transformer-surge `4a7a289` · Roblox
0.741.19.7411056

## Abstract

Three modules of `@rbxts/surge` carry `--!native`: the packed `CFrame`'s
runtime functions, the scratch buffer's functions and the blob channel. It
was recorded as worth nothing, at a time when the generated code called the
package once for each field. A probe build without it, against the build with
it in the same session, decodes the two packed `CFrame` rows at 0.745× and
0.773× and encodes them at 0.633× and 0.686×. On decode that is the packed
`CFrame`'s read function alone. The two rows that call only the scratch
buffer's functions show nothing the speed tier can read, and no row reaches
the blob channel. The directive stays on all three modules.

## Background

The generated code calls the package in three places. A packed `CFrame` is
written and read by `writePackedCFrame` and `readPackedCFrame` in
`src/cframe.ts`, once for each `CFrame` (Wire format 8.6 and 8.7 in
[specs/wire-format.md](../specs/wire-format.md)). A shape that keeps the
scratch buffer calls `finishWrite` in `src/alloc.ts` once a call, and `grow`
when a reservation runs past the buffer's end. A blob goes through
`src/blobs.ts`.

[generated-code-performance.md](../future-work/generated-code-performance.md)
recorded `--!native` on these modules as worth nothing, when the generated
code called the package's `alloc()` for each field: marking only the package
moved almost no work into the native region. A loop benchmark of a helper
standing in for `alloc()` predicted a gain once the caller is native as well.
The reservation is inline now (Transformer 5.4 in
[specs/transformer.md](../specs/transformer.md)), the generated code runs
native when its module is marked
([file-directives-on-generated-code.md](file-directives-on-generated-code.md)),
and that entry asked to be argued again against a current figure. This is
that figure, for the functions the generated code calls now.

## Method

**Builds.** The reference is surge `782356d` and rbxts-transformer-surge
`4a7a289`, whose table is the one committed at surge `ccfc922`. The probe is
the same two commits with the first line, `//!native`, removed from
`src/alloc.ts`, `src/blobs.ts` and `src/cframe.ts`. It was recorded under a
commit on a branch that is not kept, `0d93338`, which is the hash its data
file names. The generated code of the two builds is the same: the transformer
and the fixtures did not change, and the fixtures keep their own `--!native`.
`--!optimize 2` stays on every module in both.

**Runs.** Both ran on 2026-10-07, back to back, the reference from 03:25 to
03:34 UTC and the probe from 03:34 to 03:43 UTC. Each is one full invocation
of `mise run bench:speed`: two Studio runs back to back, nine trials per cell
per run. At each start no Roblox process was running, and the CPU load,
averaged over fifteen one-second samples of `Get-Counter`, was 6%.

**Reading.** As in [size-reads-tag-once.md](size-reads-tag-once.md): the
probe's surge cell over the reference's, the drift `D` over the row's quiet
control cells, and the ratio divided by `D`. A ratio below 1 is what the
directive is worth.

**Controls.** The fbs, serio, Blink and baseline columns, and the rows that
call nothing in the package: every decode row but the two packed `CFrame`
rows, and every encode row but those two, the string-heavy row and the large
record.

## Results

The packed `CFrame` rows, 50 `CFrame`s a call:

| Row, half            | Reference    | Probe        | Ratio | `D`       | Adjusted | µs a call | Runs, probe    |
| -------------------- | ------------ | ------------ | ----- | --------- | -------- | --------- | -------------- |
| axis-aligned, encode | 188.8k ±1.1% | 119.4k ±1.5% | 0.633 | 1.000 (2) | 0.633    | +3.08     | 119.4k, 119.8k |
| arbitrary, encode    | 142.9k ±0.9% | 98.2k ±1.2%  | 0.687 | 1.001 (2) | 0.686    | +3.18     | 98.2k, 98.3k   |
| axis-aligned, decode | 273.8k ±3.0% | 203.9k ±1.2% | 0.745 | 1.000 (2) | 0.745    | +1.25     | 203.9k, 203.2k |
| arbitrary, decode    | 120.2k ±1.0% | 92.3k ±0.4%  | 0.768 | 0.994 (2) | 0.773    | +2.51     | 92.3k, 92.4k   |

The reference's runs were 187.6k and 189.0k, 142.1k and 143.4k, 278.0k and
269.9k, and 120.2k and 120.4k, in the table's order.

The two encode rows that call `src/alloc.ts` and no other module of the
package:

| Row          | Reference    | Probe        | Ratio | `D`       | Adjusted | Runs, reference | Runs, probe    |
| ------------ | ------------ | ------------ | ----- | --------- | -------- | --------------- | -------------- |
| large record | 162.9k ±1.4% | 157.8k ±7.1% | 0.969 | 0.978 (3) | 0.990    | 162.9k, 163.0k  | 152.0k, 163.2k |
| string-heavy | 318.5k ±1.1% | 298.7k ±8.1% | 0.938 | 0.981 (3) | 0.956    | 318.0k, 318.9k  | 290.7k, 315.0k |

The encode rows that call nothing in the package moved between 0.968× and
1.018× adjusted, median 0.984×, with two exceptions. The guarded union's surge
cell moved 0.997× and its two control cells 1.101×, so its 0.905× adjusted is
the controls'. `Blink: Booleans` moved 1.149×; surge's encode of that row runs
at one of two speeds per Studio process. The decode rows that call nothing in
the package moved between 0.987× and 1.010×. The quiet control cells moved
1.000× on encode, quartiles [0.982, 1.007] over 47, and 0.998× on decode,
quartiles [0.993, 1.004] over 48.

## Discussion

The read side of a packed `CFrame` calls `readPackedCFrame` and nothing else
in the package, so the two decode rows measure that function alone: without
native code it costs 25 ns and 50 ns more for each `CFrame`, by row.

The write side calls `writePackedCFrame` for each `CFrame`, and `finishWrite`,
and `grow` on a call whose result outgrows the buffer, so the two encode rows
measure both modules. The probe removed the directive from all three modules
at once, and does not separate them. The rows that call `src/alloc.ts` alone
moved 0.990× and 0.956× adjusted, each with one probe run at the reference's
rate and one below it, which is not a reading. Their per-call difference is
under 0.21 µs, against 3.1 µs on the packed `CFrame` rows, so most of the
encode rows' loss is inferred to be `writePackedCFrame`'s, about 60 ns for
each `CFrame`.

No catalog row writes or reads a blob, so what the directive is worth on
`src/blobs.ts` is not measured. The probe left `--!optimize 2` in place, and
says nothing about it. The prediction the old entry made was for `alloc()`,
which the generated code no longer calls, so it is neither confirmed nor
refuted here.

## Conclusion

`--!native` on the package is worth 1.29× to 1.34× on a packed `CFrame`'s
decode, and 1.46× to 1.58× on its encode, most of which is inferred to be
`writePackedCFrame`'s. On the scratch buffer's functions it is worth nothing
the speed tier can read, and on the blob channel it is not measured. All
three modules keep it.

## Data

- The reference: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `ccfc922`.
- The probe: [data/without-native-on-the-package.md](data/without-native-on-the-package.md)
  and [data/without-native-on-the-package.tsv](data/without-native-on-the-package.tsv).
- The figures above were computed from the two `.tsv` files, with the
  recorder's own median, spread and noise rule.
