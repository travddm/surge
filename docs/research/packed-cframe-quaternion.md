# A packed `CFrame`'s rotation read through a quaternion

2026-10-11 · surge `8a300ac` and `3f90aff` · Lune 0.10.5 · Roblox
0.742.0.7421053

## Abstract

`readPackedCFrame` built a rotation that is not axis-aligned with
`CFrame.fromAxisAngle` and then added its position, where the read outside a
packed subtree builds one `CFrame` from the position and a unit quaternion.
Read the same way, the packed arbitrary row's decode measured 1.476×
adjusted, about 53 ns less for each `CFrame`. `writePackedCFrame` read a
rotation's Y vector and tested it even where its X vector was not
axis-aligned. Tested only where it is, the same row's encode measured 1.181×,
about 24 ns less for each `CFrame`. On both cells, both runs of the change
were above both runs of the reference. No generated code and no byte
changed. Both changes are kept.

## Background

Both functions are in `surge/src/cframe.ts`, and the generated code calls
each once for every `CFrame` in a packed subtree (Transformer 5.12 in
[specs/transformer.md](../specs/transformer.md), Wire format 8.6 and 8.7 in
[specs/wire-format.md](../specs/wire-format.md)). At `8a300ac`, the read of a
rotation that is not axis-aligned was:

```ts
const scaled = new Vector3(
	buffer.readf32(buf, pos + size),
	buffer.readf32(buf, pos + size + 4),
	buffer.readf32(buf, pos + size + 8),
);
const angle = scaled.Magnitude;
const value = CFrame.fromAxisAngle(angle > 1e-6 ? scaled.Unit : Vector3.zAxis, angle).add(position);
```

That is two `CFrame` constructions, and the vector's `Magnitude` and `Unit`.
`28a5b03` replaced the same form outside a packed subtree with one
constructor from a quaternion (Transformer 5.27), which measured 1.655× to
1.677× on the `CFrame` array's decode. That build changed no function of the
package ([enum-and-cframe-rows.md](enum-and-cframe-rows.md)). At `3f90aff`,
the packed read is:

```ts
const x = buffer.readf32(buf, pos + size);
const y = buffer.readf32(buf, pos + size + 4);
const z = buffer.readf32(buf, pos + size + 8);
const angle = math.sqrt(x * x + y * y + z * z);
const scale = angle > 1e-6 ? math.sin(angle * 0.5) / angle : 0.5;
const value = new CFrame(position.X, position.Y, position.Z, x * scale, y * scale, z * scale, math.cos(angle * 0.5));
```

The write finds a rotation's header code from its X and Y vectors. At
`8a300ac`, it read both vectors and tested each for an axis before it looked
at either result. At `3f90aff`, it returns the code of a general rotation as
soon as the X vector is not axis-aligned, and reads the Y vector only where
the X vector is. An arbitrary rotation's X vector is not axis-aligned, so its
write no longer reads the Y vector or tests it.

## Method

**Builds.** The reference is `8a300ac`, and the change `3f90aff`. Only
`surge/src/cframe.ts` differs. The transformer, and so every generated
module, is the same in both, and
[benchmarks/code-size.md](../benchmarks/code-size.md) counts only the
generated modules.

**Runs.** Each is one full invocation of `mise run bench:speed`, on a clean
checkout of its commit: two Studio runs back to back, nine trials per cell
per run. The reference ran from 22:37 to 22:51 UTC, and the change from
22:52 to 23:06 UTC. At each start no Roblox process was running, and the CPU
load, averaged over fifteen one-second samples of `Get-Counter`, was 4.7%
and 4.6%. A first pair of the same runs, on 2026-10-10, was set aside
because processes that should not have been running were; it measured
1.486× and 1.183× on the two cells below.

**Controls.** The fbs, serio, flamework2, Blink and hand-written columns.
`D` is the median ratio of the row's quiet control cells, and the adjusted
ratio is the ratio over `D`. Only fbs and serio have the packed rows, so
their `D` is the median of two cells. Every surge cell but the three below
runs the same code in both builds.

**Reading.** Written before any run's result: the quaternion read stays only
if the packed arbitrary row's decode is faster, with both runs of the change
above both runs of the reference, and the cell is not marked noisy, as in
[enum-and-cframe-rows.md](enum-and-cframe-rows.md). The write's early return
stays under the same rule on that row's encode. The packed axis-aligned
row's encode, whose code changed only in where it tests the X vector's code,
is reported against how far unchanged code moved: each quiet control cell's
ratio over the median ratio of the other quiet control cells of its row, as
in [cursor-known-values.md](cursor-known-values.md).

## Results

| Cell                        | Adjusted | `D`       | Reference | Change | µs a value | Runs of the reference | Runs of the change |
| --------------------------- | -------- | --------- | --------- | ------ | ---------- | --------------------- | ------------------ |
| packed arbitrary, decode    | 1.476    | 0.996 (2) | 119.9k    | 176.3k | −2.67      | 119.3k, 123.5k        | 179.1k, 172.3k     |
| packed arbitrary, encode    | 1.181    | 0.992 (2) | 121.0k    | 141.7k | −1.21      | 121.5k, 120.5k        | 142.1k, 141.3k     |
| packed axis-aligned, encode | 1.002    | 0.998 (2) | 185.2k    | 185.2k | 0.00       | 182.6k, 187.5k        | 186.5k, 183.6k     |

No cell above is marked noisy. Each value is fifty `CFrame`s. The quiet
control cells moved 0.997× on encode, quartiles [0.989, 1.003] over 80, and
0.991× on decode, [0.981, 1.000] over 79. Unchanged code moved between 0.941
and 1.113 on encode, and between 0.945 and 1.043 on decode.

## Discussion

- The decode saved about 53 ns for each `CFrame`, close to the 56 ns to 57 ns
  the same change saved outside a packed subtree. It replaces two `CFrame`
  constructions, a `Magnitude` and a `Unit` with one constructor, a square
  root, a sine and a cosine.
- In the change's run, the packed arbitrary row decodes at 176.3k against
  237.2k for the same fifty `CFrame`s unpacked. Each packed `CFrame` still
  pays a call into the package and a header byte. fbs decodes the packed row
  at 112.1k.
- The encode saved about 24 ns for each `CFrame`: one property read of the Y
  vector and its test. An axis-aligned rotation still reads both vectors,
  and its row's encode moved 1.002×, within how far unchanged code moved.
- The set-aside pair gave both cells within 0.010 of these figures.
- The packed round trips of the Lune suite pass at their tolerances: 1e-6 for
  the 24 axis-aligned rotations, 1e-5 for a rotation just off one, and 1e-4
  for a tilted rotation and for random ones.
- The figures are from one machine and one Roblox version, with `--!native`
  and `--!optimize 2` on the package's modules
  ([native-on-the-package.md](native-on-the-package.md)).

## Conclusion

Reading a packed `CFrame`'s general rotation into one constructor from a
quaternion is worth 1.476× on the packed arbitrary row's decode. Reading its
Y vector only where its X vector is axis-aligned is worth 1.181× on that
row's encode. Both are kept.

## Data

- The reference:
  [data/packed-cframe-quaternion-reference.md](data/packed-cframe-quaternion-reference.md)
  and
  [data/packed-cframe-quaternion-reference.tsv](data/packed-cframe-quaternion-reference.tsv),
  recorded at `8a300ac`.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed with this paper, recorded
  at `3f90aff`.
- The figures above were computed from the `.tsv` files, with the recorder's
  own median, spread and noise rule.
