# The hand-written codec's `CFrame` read through a quaternion

2026-10-09 · surge `9cb7f4e` and `14137cb` · Roblox 0.742.0.7421053

## Abstract

surge reads a `CFrame` into one constructor from a quaternion, where the
hand-written codec built it with `CFrame.fromAxisAngle` and `+`
([enum-and-cframe-rows.md](enum-and-cframe-rows.md)), so on the `CFrame`
array's decode the hand-written codec no longer measured what surge's code
costs against hand-written Luau. This change gives the hand-written codec the
same construction, written with three numbers where surge reads a `Vector3`.
Its decode of the row is 1.745× as measured and 1.729× adjusted, and it now
decodes the row 1.056× as fast as surge, ahead in both runs. The change is
kept.

## Background

Benchmark harness 4.5 in
[specs/benchmark-harness.md](../specs/benchmark-harness.md) has the
hand-written codec write surge's bytes, so that its timing measures code
rather than format. Its read of one element of the `CFrame` array, with this
change, is:

```luau
local x = buffer.readf32(buf, offset + 12)
local y = buffer.readf32(buf, offset + 16)
local z = buffer.readf32(buf, offset + 20)
local angle = math.sqrt(x * x + y * y + z * z)
local scale = if angle > 1e-6 then math.sin(angle * 0.5) / angle else 0.5
list[index] = CFrame.new(--[[ three readf32 ]], x * scale, y * scale, z * scale, math.cos(angle * 0.5))
```

surge's generated read (Transformer 5.27 in
[specs/transformer.md](../specs/transformer.md)) reads the three rotation
components into a `Vector3` and takes `X`, `Y` and `Z` from it, which holds
the read to the locals Transformer 5.5 counts for a `cframe`. The two compute
the same quaternion.

The hand-written codec's module took 13,258 bytes of bytecode, where it took
13,210 ([benchmarks/code-size.md](../benchmarks/code-size.md)), and its round
trip in [benchmarks/size.md](../benchmarks/size.md) stays within 2e-7 in every
component.

## Method

**Builds.** The reference is `9cb7f4e`, and the change is `14137cb`, which
changes only `tests/src/bench/baseline/codecs.luau`.

**Runs.** Each is one full invocation of `mise run bench:speed`: two Studio
runs back to back, nine trials per cell per run. The reference is build C of
[enum-and-cframe-rows.md](enum-and-cframe-rows.md), which ran from 06:48 to
07:02 UTC, and the change ran from 07:21 to 07:35 UTC. At each start no
Roblox process was running, and the CPU load, averaged over fifteen
one-second samples of `Get-Counter`, was 9.3% and 12.7%.

**Reading.** The change is to a control, so it stays for what it measures,
whatever its speed: it gives the hand-written codec the construction surge's
read uses. No rule was fixed before the run.

**Controls.** Every cell but the hand-written codec's decode of the `CFrame`
array: no other cell's code changed. `D` is the
median ratio of the row's quiet control cells, with their number, and the
adjusted ratio is the ratio over `D`.

## Results

The hand-written codec on the `CFrame` array:

| Half   | Reference    | Change       | Ratio | `D`       | Adjusted | µs a call | Runs, reference | Runs, change   |
| ------ | ------------ | ------------ | ----- | --------- | -------- | --------- | --------------- | -------------- |
| decode | 142.3k ±0.9% | 248.3k ±3.0% | 1.745 | 1.009 (5) | 1.729    | −2.999    | 142.2k, 142.4k  | 244.5k, 248.8k |
| encode | 268.6k ±1.2% | 277.6k ±5.7% | 1.034 | 1.032 (5) | 1.002    | −0.121    | 268.7k, 268.4k  | 286.5k, 270.6k |

The encode, whose code did not change, moved with the row's controls. surge's
decode of the row, whose code did not change either, was 1.009× as measured
and 1.000× adjusted.

The quiet control cells moved 1.006× on encode, quartiles [0.994, 1.018]
over 94, and 1.012× on decode, quartiles [1.001, 1.023] over 100.

In the change's run, the hand-written codec decodes the `CFrame` array at
248.3k and surge at 235.2k: the hand-written codec is 1.056× as fast, and
1.059× and 1.051× by run. Flamework 2 decodes it at 288.3k.

## Discussion

- The hand-written codec's decode moved by about what surge's moved when
  surge took the same construction
  ([enum-and-cframe-rows.md](enum-and-cframe-rows.md)), and it now leads
  surge on the row's decode by 1.056×, where surge led it by 1.64×.
- The remaining difference between the two reads is the `Vector3` that
  surge's read builds and takes three components from, where the
  hand-written codec holds three numbers. The run does not show that this is
  where the 1.056× is; it is the one difference in the code.
- The figures are from one machine and one Roblox version, with `--!native`
  and `--!optimize 2` on both modules.

## Conclusion

Reading a `CFrame` into one constructor from a quaternion is worth 1.729× to
1.745× on the hand-written codec's decode of the `CFrame` array, which leaves
it 1.056× ahead of surge on that decode.

## Data

- The reference: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at `f2dfd28`, recorded at
  `9cb7f4e`.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed with this paper, recorded at
  `14137cb`.
- The figures above were computed from the two `.tsv` files, with the
  recorder's own median, spread and noise rule.
