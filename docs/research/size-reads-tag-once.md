# A tagged union's tag read once by its size

2026-10-07 · surge `782356d` · rbxts-transformer-surge `4a7a289` · Roblox
0.741.19.7411056

## Abstract

The size of a tagged union read the tag once for each comparison in its
chain, where the hand-written codec's first pass reads it once
([variant-index-reservation.md](variant-index-reservation.md)). This change
reads it into a local once when the size compares it more than once. Against
the build before it, in the same session, the tagged union's encode is 1.050×
adjusted, 0.142 µs less a call, and the hand-written codec now encodes it
1.05× as fast as surge, where it was 1.11×. The change is kept.

## Background

The tagged union row writes 100 events over four variants. Its size is a
loop over the events ahead of the result (Transformer 5.20 in
[specs/transformer.md](../specs/transformer.md)). Before this change, each
iteration was:

```luau
size3 += (if item2.kind == "chat" then #item2.text + 8 elseif item2.kind == "damage" then 6 elseif item2.kind == "despawn" then 4 else 16) + 1
```

so the size read an event's `kind` once for a `chat` event, twice for a
`damage` event, and three times for a `despawn` or a `spawn` event. The write
already read it once into a local (Transformer 5.25). With this change, the
iteration is:

```luau
local tag3 = item2.kind
size4 += (if tag3 == "chat" then #item2.text + 8 elseif tag3 == "damage" then 6 elseif tag3 == "despawn" then 4 else 16) + 1
```

Outside a loop or a branch, the size binds the tag ahead of the result with
its other locals, and the write tests that local instead of reading the tag
again. No catalog row has a tagged union there.

## Method

**Builds.** The reference is surge `900658d` and rbxts-transformer-surge
`68b528a`. The change is surge `782356d` and rbxts-transformer-surge
`4a7a289`. [benchmarks/code-size.md](../benchmarks/code-size.md), which gives
the bytecode of each fixture's surge module, changed on the tagged union's
row alone. Its `deserialize` differs only in the numbers of its locals.

**Runs.** Both ran on 2026-10-07, back to back, the reference from 03:16 to
03:25 UTC and the change from 03:25 to 03:34 UTC. Each is one full invocation
of `mise run bench:speed`: two Studio runs back to back, nine trials per cell
per run. At each start no Roblox process was running, and the CPU load,
averaged over fifteen one-second samples of `Get-Counter`, was 10% and 6%.

**Reading.** As in [union-write-tested-once.md](union-write-tested-once.md):
surge's ratio over the reference, the drift `D` as the median ratio over the
row's quiet control cells, and the ratio divided by `D`. The change is kept by
the rule the previous changes of this series used: it stays unless the encode
it targets is slower past the band.

**Controls.** The fbs, serio, Blink and baseline columns, and the fifteen
encode rows whose code did not change.

## Results

Encode of the tagged union:

| Reference    | Change       | Ratio | `D`       | Adjusted | Runs, reference | Runs, change   |
| ------------ | ------------ | ----- | --------- | -------- | --------------- | -------------- |
| 345.5k ±1.4% | 363.4k ±1.3% | 1.052 | 1.001 (4) | 1.050    | 348.2k, 344.2k  | 364.8k, 363.3k |

That is 2.89 µs a call in the reference and 2.75 µs in the change.

The other encode rows moved between 0.975× and 1.023× adjusted, with two
exceptions whose code did not change either. The guarded union's surge cell
moved 0.990×, and its two control cells 0.917×, so its 1.080× adjusted is
the controls'. `Blink: Booleans` moved 0.920×; surge's encode of that row runs
at one of two speeds per Studio process
([benchmark-tooling.md](../future-work/benchmark-tooling.md)). The quiet
control cells moved 1.005×, quartiles [0.995, 1.012] over 45.

On decode, the tagged union moved 0.975× adjusted, with a spread of ±6.4% in
the change's run, and the quiet control cells moved 1.002×, quartiles
[0.994, 1.009] over 48.

Against the hand-written codec, the tagged union's encode is 1.05× in the
change's run, and 1.033× and 1.051× by run. In the reference's run it is
1.11×, and 1.097× and 1.115× by run.

## Discussion

The gain is on the one encode row whose code changed, it is the same in both
runs of the change, and both runs are clear of both runs of the reference.
Reading the tag once removed half of the gap to the hand-written codec on
this row.

What is left of the gap is not attributed. The known differences between the
two writes after this change are these:

- A `spawn` event's write reads `item.at` once for each of its three
  components, where the hand-written codec reads it into a local once. No
  other catalog row writes a datatype through a property path.
- The size adds each event's index byte in each iteration, where the
  hand-written codec adds one byte for each event to its count ahead of the
  loop.
- A `chat` event's write moves the cursor twice, once for the index and the
  id and once for the string. Cursor moves measured as no change
  ([variant-index-reservation.md](variant-index-reservation.md)).

## Conclusion

Reading a tagged union's tag once in its size is worth 1.050× on the tagged
union's encode. The hand-written codec is 1.05× ahead on that row, where it
was 1.11×.

## Data

- The reference: [data/before-size-reads-tag-once.md](data/before-size-reads-tag-once.md)
  and [data/before-size-reads-tag-once.tsv](data/before-size-reads-tag-once.tsv),
  recorded at surge `900658d` and rbxts-transformer-surge `68b528a`.
- The change: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `ccfc922`,
  recorded at surge `782356d` and rbxts-transformer-surge `4a7a289`.
- The figures above were computed from the two `.tsv` files, with the
  recorder's own median, spread and noise rule.
