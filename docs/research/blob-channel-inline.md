# The blob channel inline

2026-10-07 · surge `fa51f5c` · rbxts-transformer-surge `9cbe5e5` · Roblox
0.741.19.7411056

## Abstract

The blob channel's state was module state in the package, and each blob a
serializer wrote or read was a call into it. This change appends and reads
blobs inline, with the state in the serializer: in `serialize` and
`deserialize` themselves, or in the closure where a recursion helper reads it.
On a new catalog row of 50 `Instance` references, encode is 1.207× and
decode 1.117× adjusted, 0.346 µs and 0.502 µs less a call. The hand-written
codec encodes that row 1.44× as fast as surge, where it was 1.74×, and
decodes it 1.02× as fast, where it was 1.12×. The change is kept.

## Background

Before this change, a `serialize` of a shape with a blob called the package's
`beginWriteBlobs` once, which created the list, then `pushBlob` for each blob,
and returned what `finishWriteBlobs` gave it. A `deserialize` called
`beginReadBlobs` once and `nextBlob` for each blob, which checked the list and
its index and returned the next value. The list and the index were module
state in the package, shared by every serializer.

With this change (Transformer 5.9 in
[specs/transformer.md](../specs/transformer.md) and Runtime API 5.5 in
[specs/runtime-api.md](../specs/runtime-api.md)), each element of the row
writes its `Instance` with:

```luau
local _model = item3.model
table.insert(__surge_writeBlobs, _model)
```

into a list that `serialize` declares itself, and reads it with:

```luau
if __surge_readBlobs == nil then
	error("@rbxts/surge: deserialize() encountered a blob field but its input has no blobs array")
end
if __surge_readBlobIndex >= #__surge_readBlobs then
	error("@rbxts/surge: deserialize read past the end of the blobs array")
end
local blob10 = __surge_readBlobs[__surge_readBlobIndex + 1]
__surge_readBlobIndex += 1
```

with the same two errors as before. `table.insert` appends nothing for `nil`,
as `pushBlob` did, which Wire format 6.7 relies on.

The catalog had no row with a blob, so this change came with one: the
instance references, 50 entries of an `Instance` and a `u16`, which surge,
fbs, serio and the hand-written baseline each write as 104 bytes and 50
values beside them. Blink and Zap have no cell on it (Benchmark harness 3.1,
3.4 and 4.5).

## Method

**Builds.** The reference is surge `ef2aa47` and rbxts-transformer-surge
`6bf86ea`, whose table is the one committed at surge `c298e3b`. The change is
surge `fa51f5c` and rbxts-transformer-surge `9cbe5e5`. Among the fixture
modules, only the instance references' surge module changed:
[benchmarks/code-size.md](../benchmarks/code-size.md) took it from 1,807 to
1,888 bytes of bytecode, with the read's checks inline.

**Runs.** Both ran on 2026-10-07, the reference from 08:03 to 08:13 UTC and
the change from 08:36 to 08:46 UTC. Each is one full invocation of
`mise run bench:speed`: two Studio runs back to back, nine trials per cell
per run. At each start no Roblox process was running, and the CPU load,
averaged over fifteen one-second samples of `Get-Counter`, was 11% and 7%.

**Reading.** As in [size-reads-tag-once.md](size-reads-tag-once.md), with the
rule that the change stays unless the instance references are slower past
the band on either half.

**Controls.** The fbs, serio and baseline columns, and the sixteen rows that
hold no blob, whose code did not change.

## Results

The instance references:

| Half   | Reference    | Change       | Ratio | `D`       | Adjusted | µs a call | Runs, reference | Runs, change   |
| ------ | ------------ | ------------ | ----- | --------- | -------- | --------- | --------------- | -------------- |
| encode | 533.8k ±3.6% | 654.5k ±2.0% | 1.226 | 1.016 (3) | 1.207    | −0.346    | 525.6k, 544.8k  | 660.9k, 648.2k |
| decode | 237.6k ±2.8% | 269.8k ±2.9% | 1.135 | 1.017 (3) | 1.117    | −0.502    | 237.6k, 237.7k  | 271.2k, 264.5k |

The other encode rows moved between 0.981× and 1.022× adjusted, but for
`Blink: Booleans`, which ran at two speeds by run and is marked noisy, and the
other decode rows between 0.985× and 1.021×. The quiet control cells moved
1.007× on encode, quartiles [0.997, 1.014] over 51, and 1.017× on decode,
quartiles [1.006, 1.028] over 51.

Against the hand-written codec, the instance references' encode is 1.44× in
the change's run, and 1.453× and 1.435× by run, where the reference had it
at 1.74×, and 1.743× and 1.722× by run. Their decode is 1.02×, and 1.039×
and 1.020× by run, where it was 1.12×, and 1.128× and 1.121× by run.

## Discussion

The row moved on both halves, in both runs, clear of both runs of the
reference, and nothing else moved. With 50 blobs a call, what was saved is
about 7 ns for each blob written and 10 ns for each blob read: the call into
the package that each blob no longer makes, and the module state that call
reached. The read still makes the same two checks.

Most of the encode gap that is left is not the blob channel. A blob reserves
no bytes, so an object that holds one has no constant size to the
transformer, and an array of such objects is not sized ahead of its write
(Transformer 5.20): it keeps the scratch buffer, checks its capacity for each
element, and copies its result once a call. The hand-written codec creates its
buffer once at its size. That was not tried here.

Moving the state also removes a rule. A `serialize` of a type with a blob
field may now start while another one is running, and so may a `deserialize`
(Runtime API 5.5 and 5.8). A serializer whose `T` holds no recursive type
keeps its blob state in the call itself; one that does keeps it in its
closure, where the rule of Runtime API 5.6 for one serializer applies to it as
it does to the scratch buffer.

## Conclusion

Appending and reading blobs inline is worth 1.207× on encode and 1.117× on
decode on a row of 50 `Instance` references, and leaves the hand-written codec
1.44× ahead on encode and 1.02× on decode.

## Data

- The reference: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `c298e3b`.
- The change: the same files as committed at surge `a6cd67d`, recorded at
  surge `fa51f5c` and rbxts-transformer-surge `9cbe5e5`.
- The figures above were computed from the two `.tsv` files, with the
  recorder's own median, spread and noise rule.
