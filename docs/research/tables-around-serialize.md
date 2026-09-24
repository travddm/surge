# The tables around a serialize call

2026-09-24 · surge `56b6fd5` · rbxts-transformer-surge `0710f5d` · Roblox
0.740.19.7400931

## Abstract

In the reference run, surge's encode trailed a hand-written Luau codec writing
the same bytes by 209.6 ns per call on the flat struct. Five probes, each a
full catalog run against that reference, took apart the per-call work surge's
column does that the hand-written column does not. On the five rows where a
call takes under 0.6 µs, the two tables the generated `serialize()` returns
cost a median 106.8 ns per call, of which the empty `blobs` table is 30.1 ns.
The benchmark adapter's own payload table, which the surge and fbs columns
build and the baseline, serio and Blink columns do not, costs 70.3 ns, and
calling `finishWrite` instead of inlining it costs nothing this run can see.
With the three tables removed, the flat struct's gap is 37.9 ns.

## Background

The gap to hand-written Luau has a part paid once per call, about 0.2 µs, and
a part paid per element
([generated-code-against-hand-written.md](generated-code-against-hand-written.md)
and its correction). The per-call work measured before this paper accounts for
none of the per-call part: the blob side channel is not emitted on any catalog
row, and whether `finishWrite`'s copy costs anything per call is open
([per-call-overhead.md](per-call-overhead.md) and its correction).

The hand-written codec creates one buffer, writes into it and returns it. The
generated `serialize()` writes into its scratch buffer, calls into the package
for `finishWrite`, which creates the result buffer and copies into it, and
returns two new tables:

```luau
return {
    buffer = __surge_finishWrite(__surge_scratch, __surge_cursor),
    blobs = {},
}
```

The `blobs` table is emitted because `Serializer<T>` declares the property.

A timed call runs the adapter as well as the codec
(Benchmark harness 4.7 in [specs/benchmark-harness.md](../specs/benchmark-harness.md)).
The two adapters differ. The baseline's returns
`{ bytes, side, payload = buf }`. surge's builds a third table for its payload:

```luau
local result = serializer.serialize(value)
return {
    bytes = buffer.len(result.buffer),
    side = #result.blobs,
    payload = { buf = result.buffer, blobs = result.blobs },
}
```

fbs's adapter does the same. serio's and Blink's pass what their library
returned as the payload, as the baseline's does.

## Method

**Reference.** One full invocation at surge `56b6fd5` and
rbxts-transformer-surge `0710f5d` with neither tree changed: two Studio runs
back to back, nine trials per cell.

**Probes.** Five, each a patch applied to a clean tree, measured as its own
full invocation, and reverted:

| Probe | Change                                                                                                                                  | Removes from each encode call                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| A     | Each serializer creates one empty `blobs` table and returns it from every call                                                          | the `blobs` table                                    |
| B     | surge's adapter passes the table `serialize()` returns through as its payload                                                           | the adapter's payload table                          |
| C     | `serialize()` does `buffer.create` and `buffer.copy` itself instead of calling `finishWrite`                                            | one call into the package                            |
| D     | `serialize()` returns the buffer alone; the adapter builds its payload table from it and one shared empty array, and reports `side = 0` | the wrapper table and the `blobs` table              |
| E     | D's `serialize()`, and an adapter that passes the buffer through as its payload, as the baseline's does                                 | the wrapper, the `blobs` table and the payload table |

The patches to the transformer (A, C, D, E) change only what `serialize()`
emits at its end, and A also declares its one table at the head of the
serializer's closure. A, B and C were checked together, in one build: each
showed in the compiled output of every fixture or in the compiled adapter, and
the round-trip suite passed, 154 of 154. Each was then applied alone for its
run. D and E were each checked alone in the compiled fixtures and adapter
before their runs. They break `Serializer<T>`'s declared return type, which
the patch asserts away, so the round-trip suite, which reads the returned
table, was not run on them. A's shared table changes what a caller gets: every
call returns the same mutable array. The probe measures the allocation, not a
design.

**A second reference.** One more invocation of the reference build, unchanged,
after C. What it differs from the first by is the floor for this session.

**Order and machine.** All seven invocations ran on 2026-09-24 between about
16:48 and 17:55, in the order reference, A, B, C, second reference, D, E. A
Studio session and the Roblox Player that were open before the reference were
closed first. Nothing else on the machine was controlled.

**Reading.** A cell's figure is its median, as the recorder computes it. A
probe's cost is read as nanoseconds added per call, `1/probe − 1/reference`,
because the costs under test are paid once per call; a removed cost shows as a
negative figure. Cells marked noisy in either run are left out.

The rows read are the five on which surge's encode takes under 0.6 µs in the
reference: the small flat struct, the deeply nested object, the wide struct and
both toggles rows. It is the rule
[per-call-overhead.md](per-call-overhead.md) used, fixed before the probes
ran. A constant cost is the largest fraction of a call on these rows, and a
one-percent drift is under 6 ns on them where it is about 80 ns on the slowest.

The controls are fbs, serio, Blink and the baseline, which no probe touches.
Between two runs, a control column's median over the fast rows' encode moved
by as much as 3.7%, the baseline's in E.
So each probe is also read drift-adjusted: `D` is the median probe-over-reference
throughput ratio over the quiet control cells of the same rows and half, and a
surge cell's adjusted cost is `1/probe − 1/(reference × D)`. surge's decode is a
further control for every probe: none of them changes the generated
`deserialize()`. B's adapter reads the same two fields under other names, and
E's reads two fields fewer, in the adapter's interpreted code.

## Results

### The floor

The second reference against the first, fast rows:

| Half   | surge, raw             | Control drift `D`          | surge, adjusted       |
| ------ | ---------------------- | -------------------------- | --------------------- |
| encode | +16.2 ns [+9.6, +16.7] | 0.982× [0.970, 1.001] (15) | +7.8 ns [+1.6, +8.4]  |
| decode | +17.4 ns [+3.2, +70.8] | 0.976× [0.948, 0.999] (15) | +7.6 ns [−6.2, +34.7] |

Brackets are the quartiles over the rows, or over the control cells for `D`,
with their count. Two invocations of unchanged code in this session land about
8 ns per encode call apart after the drift adjustment. The column medians of
the controls on the fast rows were fbs 0.977×, serio 0.997×, Blink 0.965× and
the baseline 0.988×.

### Each probe

Fast rows, encode, nanoseconds added per call:

| Probe | surge, raw              | Control drift `D`     | surge, adjusted         | Adjusted against the second reference |
| ----- | ----------------------- | --------------------- | ----------------------- | ------------------------------------- |
| A     | −38.7 [−41.8, −35.9]    | 1.019× [1.012, 1.027] | −30.1 [−33.6, −27.4]    | −32.0 [−32.2, −26.5]                  |
| B     | −72.4 [−72.8, −64.8]    | 1.005× [0.991, 1.009] | −70.3 [−70.7, −62.7]    | −72.6 [−79.0, −71.6]                  |
| C     | +7.4 [−6.7, +7.8]       | 0.998× [0.984, 1.007] | +6.2 [−7.6, +7.0]       | −9.1 [−14.4, +4.7]                    |
| D     | −104.2 [−107.5, −99.5]  | 0.994× [0.985, 1.001] | −106.8 [−110.9, −102.1] | −106.8 [−114.3, −102.9]               |
| E     | −168.2 [−172.6, −159.9] | 0.994× [0.968, 1.011] | −171.0 [−175.0, −162.8] | −172.0 [−180.8, −169.0]               |

The control column medians on the same rows, as throughput ratios:

| Probe | fbs    | serio  | Blink  | Baseline | surge  |
| ----- | ------ | ------ | ------ | -------- | ------ |
| A     | 1.022× | 1.012× | 1.019× | 1.036×   | 1.093× |
| B     | 1.006× | 1.009× | 0.991× | 0.994×   | 1.181× |
| C     | 0.998× | 0.999× | 0.963× | 1.014×   | 0.987× |
| D     | 0.991× | 1.000× | 0.994× | 1.000×   | 1.302× |
| E     | 0.993× | 1.011× | 0.968× | 0.963×   | 1.607× |

surge's decode, which no probe changes, adjusted: A −3.9 ns [−4.3, −2.4],
B +1.0 [+0.1, +2.5], C +3.8 [−0.9, +8.8], D +4.8 [+4.5, +4.8], and
E −2.9 [−3.3, +2.1].

Over all sixteen rows, where the slow rows are much noisier in nanoseconds,
surge's adjusted encode medians are A −32.8 ns [−44.1, +26.2], B −73.0
[−126.0, −57.8], C +4.7 [−29.0, +57.8], D −112.1 [−162.3, −101.8] and E −178.1
[−229.7, −128.2], against +9.3 [−9.5, +38.9] for the second reference.

### The gap to hand-written

The baseline's lead over surge's encode, read within each run, so that the
two columns share the run's drift:

| Run              | Small flat struct | Deeply nested object | `CFrame` array   |
| ---------------- | ----------------- | -------------------- | ---------------- |
| Reference        | 209.6 ns (2.23×)  | 235.9 ns (2.09×)     | 882.6 ns (1.23×) |
| Second reference | 203.7 ns (2.20×)  | 246.4 ns (2.11×)     | 821.7 ns (1.22×) |
| A                | 170.4 ns (2.05×)  | 201.3 ns (1.95×)     | 768.3 ns (1.20×) |
| B                | 149.5 ns (1.87×)  | 162.7 ns (1.75×)     | 744.1 ns (1.20×) |
| C                | 188.9 ns (2.15×)  | 227.9 ns (2.05×)     | 820.9 ns (1.21×) |
| D                | 103.4 ns (1.62×)  | 134.6 ns (1.61×)     | 750.4 ns (1.20×) |
| E                | 37.9 ns (1.22×)   | 57.1 ns (1.24×)      | 554.7 ns (1.14×) |

Each is one cell per column per run, so each carries the between-invocation
band of [noise-in-the-speed-tier.md](noise-in-the-speed-tier.md), which the
two references' rows show.

## Discussion

**Most of the per-call gap is tables.** Three tables per encode call — the
wrapper and `blobs` that `serialize()` returns, and the adapter's payload —
account for 171 ns on the fast rows. Of the flat struct's 209.6 ns gap,
37.9 ns remains in the run that removed all three. The effects add up: B and
D, measured separately, sum to 177.1 ns, and E, which is both at once,
measured 171.0.

**What one table costs depends on the table.** The empty `blobs` table cost
30.1 ns (A). The adapter's payload table, with two fields, cost 70.3 ns (B).
The two tables `serialize()` returns cost 106.8 ns together (D), which leaves
about 77 ns for the wrapper, a table with two fields like the payload's. D
does not isolate the wrapper exactly: its adapter also dropped two field reads
and a length, in interpreted code, so the wrapper is 77 ns less a few. The
payload table runs in the adapter, which is not native, and the wrapper runs
in the fixture, which is. That the two cost about the same fits a cost in the
allocation rather than in the instructions around it. Luau builds `{}` as one
allocation and a table with named fields as two, the table and its hash part,
which fits the empty table costing less than half as much. Neither
explanation was tested.

The empty table's 30 ns is close to the 25.7 ns
[per-call-overhead.md](per-call-overhead.md) measured for the blob side
channel's table and three calls into the package. C found no cost in a call,
which fits the channel's cost being mostly its table.

**The adapters are not the same work.** surge's and fbs's adapters build a
payload table that the baseline's, serio's and Blink's do not, and in the
reference that table is 70 ns of every surge encode call on the fast rows,
about a third of the flat struct's gap. A surge-to-fbs ratio in the speed
table compares two columns that both pay it. A ratio between surge and the
baseline, serio or Blink includes it on surge's side. The speed table's prose
states that the baseline's ratio is what surge's generated code costs against
hand-written Luau. In the reference run, that ratio includes the adapter's
table.

**The call to `finishWrite` costs nothing measurable.** C's figure is inside
the floor, and it has the sign of a cost added against one reference and of a
cost removed against the other. The inline reservation saved 22 to 24 ns per
removed call
([generated-code-against-hand-written.md](generated-code-against-hand-written.md)
and its correction). Each of those calls made a call of its own, read and
wrote the package's module state, and returned two values, and C keeps `finishWrite`'s work and removes
only the call. Which part of an `alloc` call cost is not separated by either
measurement.

**What remains.** In the run with all three tables removed, surge's encode is
37.9 ns behind on the flat struct and 57.1 ns on the nested object. The
`CFrame` array is 554.7 ns behind, which by the per-element reading of the
correction to
[generated-code-against-hand-written.md](generated-code-against-hand-written.md)
is mostly per element. What the residual per-call part is was not probed.
Candidates in the code are `finishWrite`'s copy, the reads and writes of the
scratch state held in the closure, and the capacity check.

What this does not show. It is one machine, one Studio version and one
session. The probes ran in a fixed order and not interleaved with references,
so a drift that grew over the session lands on the later probes; the two
references, before and after the first three probes, agree within 8 ns, and D
and E read the same against either. The drift adjustment assumes a run-wide
change scales every column alike, and the controls' own quartiles, up to
4.3% wide, bound how well it can. The fast-row figures rest on five rows, and each
per-run gap on one cell per column. Nothing was measured with the fixtures
compiled interpreted, where allocation and instructions weigh differently. The
decode side has no table of this kind and was not probed. D and E measure a
`serialize()` that does not satisfy `Serializer<T>`, and A one that shares a
mutable array between calls, so none of the three is a design that could ship
as measured.

## Conclusion

The per-call gap between surge's encode and a hand-written codec is mostly
table allocation: the wrapper and the empty `blobs` array the generated
`serialize()` returns cost about 107 ns per call, and the benchmark adapter's
own payload table, which the hand-written column does not build, costs about
70 ns more. With all three gone, the flat struct's gap falls from 209.6 ns to
37.9 ns. The call to `finishWrite` costs nothing this run can measure.

## Data

- The reference run: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv`, recorded at surge `56b6fd5` and
  rbxts-transformer-surge `0710f5d` with neither tree changed, and committed
  alongside this paper.
- The five probe runs and the second reference, each as the table the recorder
  wrote and every trial behind it, in this directory's `data/`:
  `shared-empty-blobs`, `adapter-without-payload-table`,
  `finish-write-inlined`, `serialize-returns-the-buffer`,
  `buffer-returned-and-passed-through` and `second-reference`, each as `.md`
  and `.tsv`. No probe is in any build that shipped.
- The figures above were computed from the `.tsv` files, with the recorder's
  own median, spread and noise rule.
