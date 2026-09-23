# Future work: re-measure the speed conclusions recorded before the suite yielded

Part of the [surge](../architecture.md) design.

## What

Until 2026-09-23 the speed suite (`tests/src/bench/speed.spec.ts`) never
yielded, so a full run held Studio's plugin thread for the whole catalog
with no frame in between, and about ten seconds in every path that
allocates per call slowed by close to an order of magnitude and stayed
slow. The suite yields between timed chunks now.
[Frame starvation in a Studio benchmark run](../research/frame-starvation.md)
reports the A/B that established it, where the onset falls, and how far
each cell of the catalog moved when it was re-recorded with the loops
yielding.

Every conclusion below was drawn from runs made before that change. The
numbers in the current `speed.md` are sound; the numbers quoted in the
documents are not, and the documents still state them.

**Which cells a pre-change run got wrong.** A full run measured its encode
half first, in catalog order, and its decode half after it, so the onset
lands inside the large record's encode row. So:

- Unaffected: every encode cell through the large array's, and the first
  two of the large record's, each within 1.21× of a yielding run; and any
  scoped run whose measured calls stayed under about ten seconds.
- Affected: the rest of the encode half and the whole decode half, 104
  cells at 1.33× to 19.62×, falling hardest on the paths that allocate
  most — decodes, serio, and Blink's encode.
- A scoped run that ran longer than ten seconds crossed into the slow mode
  mid-run. That is what the union rows' 91% and 302% decode spreads
  "measured alone" were, and what the order-of-magnitude disagreement
  between scoped and full runs was. Both are corrected in place in
  [benchmark-tooling.md](benchmark-tooling.md) and
  [generated-code-performance.md](generated-code-performance.md); the rest
  of this list is not.

A ratio between two full runs at different commits compares a slow-mode
cell with a slow-mode cell. Its direction probably holds where it is large.
Its magnitude does not: the slow mode inflates the cost of allocation, so
a change that removes allocations (the tagged-union literal, the shared and
inline reservations) would have read larger than it is, and a null result
on a per-call allocation would have read as null under a penalty that
should have exposed it. Neither has been checked.

**Unaffected, and needing no re-measurement:** the size tier and every
number in [benchmarks/size.md](../benchmarks/size.md); the tight
`buffer` lab loop in generated-code-performance.md (`--!native` at
11.68×), which allocates nothing and so has nothing the slow mode acts
on; and the scoped runs that stayed short. **Confirm rather than
assume:** the other lab loops there — the codec-shaped loop at 2.25×,
which allocates once per call, the helper-crossing and type-annotation
timings, and the `finishWrite` copy collapse — record no duration, so
whether they stayed under ten seconds is not known; and the per-element
probe (2.64×, 2.51×, 1.52× on the large array and `CFrame` array), which
was scoped to three patterns and replicated to within a few percent, but
whose duration is not recorded either.

**What the re-recorded file already shows.** Per value, on the three
baseline rows: encode is 0.38 µs against 0.17 µs on the flat struct,
0.47 µs against 0.23 µs on the nested object, and 4.81 µs against
4.10 µs on the thousand-element `CFrame` array, while decode is at parity
on all three. The encode gap is a constant of about 0.2 µs per call, and
under a nanosecond per element: two fields or fifty, the row loses the
same amount. The hand-written codec makes one exact-size buffer per call;
surge writes into a scratch buffer and then allocates and copies the
result. That per-call work is the same cost the `finishWrite` probe and
the blob-channel change measured at 1.00×, with five-millisecond trials
in the slow mode, so those two null results are the first to re-measure,
ahead of the `--!native` question.

The per-call question is answered and is not in the table below. The blob
side channel costs 25.7 ns an encode call and `finishWrite`'s copy costs
nothing, re-measured on a yielding run with controls:
[per-call-overhead.md](../research/per-call-overhead.md). It was first
because the re-recorded file shows a 0.2 µs per-call encode gap against the
hand-written baseline, and it accounts for about an eighth of it.

The `--!native` question is answered too, and it is the first conclusion here
to move: the directive is worth a median 1.335× on encode and 1.180× on decode
on the generated code, where every earlier measurement put it between 1.02×
and 1.10× ([native-on-generated-code.md](../research/native-on-generated-code.md)).
The dismissals in What native changed still stand, since a third is not the
2.25× to 11.68× inversion they needed, but two of them are reopened there.

**Conclusions to re-measure**, with where they are stated:

| Conclusion                                                                                                                       | Stated in                                                           | Rests on                                                   | Priority                                            |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------- |
| Reserving bytes inline: 4.15× encode, 2.48× decode across the catalog; 7.35×, 6.56×, 5.56× on the union/boolean rows             | generated-code-performance.md, Reserving bytes inline               | Full runs either side; all listed cells late or decode     | Third: the headline result                          |
| Shared reservation: 4.70×, 3.01×, 3.96×, 1.72×, 1.51×, 1.43×, 1.17×                                                              | generated-code-performance.md, One helper call per field            | Full runs either side; mixed (wide struct encode is clean) | Third                                               |
| `CFrame` second reservation: 1.61× encode, 1.35× decode                                                                          | generated-code-performance.md                                       | Full runs; `CFrame` array is a late encode row             | Fourth                                              |
| Tagged-union literal: 1.39× decode, 6929 to 9608 values a second                                                                 | generated-code-performance.md                                       | Full runs; decode                                          | Fourth                                              |
| Baseline gap: 2.87×/1.63× at the start, 1.08×/1.05× interpreted, 1.08×/1.06× native, on the `CFrame` array                       | generated-code-performance.md opening; benchmark-tooling.md results | Full runs; the end state can be read from the current file | Read from the current file; re-run only the start   |
| Library standings: surge ahead of fbs on all 32 cells, of serio on all 32, Blink ahead on 1 of 11 encode and 4 of 11 decode rows | benchmark-tooling.md results                                        | Full run                                                   | Read from the current file                          |
| `Packed<T>` against unpacked: 0.96× encode, 0.22× decode, and the three earlier pairs                                            | benchmark-tooling.md results                                        | Full runs; the `toggles` rows are late                     | Current pair from the file; earlier pairs if wanted |
| Pinning `--!optimize 2` cost nothing: 1.004× encode, 1.030× decode, controls at 1.000×                                           | generated-code-performance.md                                       | Full runs either side                                      | Low: the mechanical argument stands without it      |
| Noise is concentrated in encode on the fastest rows; 27 cells spread over a tenth, 11 over three tenths                          | benchmark-tooling.md results                                        | One full run                                               | Re-read from the current trials file                |

## Why deferred

The numbers are wrong in a known direction and the harness that produced
them is fixed, so nothing in the codebase depends on re-measuring; what
depends on it is the accuracy of the documents, and the documents say
where their numbers came from. It is deferred rather than done now because
each before/after conclusion needs a build at the earlier commit as well as
a run, and because
[documentation-restructure.md](documentation-restructure.md) moves this
material into `docs/research/`, where the corrected numbers should land
once rather than be written twice.

## How, briefly

- Read the drift first. `mise run bench:speed` is two runs back to back
  now, and `speed.md` states how far a cell's median moved between them;
  that is the band every ratio below is read against. The old band (0.98×
  to 1.02× over the quiet cells) was measured in the slow mode, with
  five-millisecond trials on the fastest rows, and does not carry over.
- For each before/after pair, check out the transformer at the commit
  before the change (generated-code-performance.md names them: the tagged
  union against `1b1ec9f`, the `CFrame` reservation against `a4d6217`,
  the shared reservation against `58c4d0f`, the inline reservation in
  `rbxts-transformer-surge` `7f46c81` and `surge` `91310ea`), run
  `mise run bench:speed` at each side, and read the ratio per cell against
  the drift band. `tests:install` already clears the incremental build
  state, so a transformer-only checkout is picked up.
- The `--!native` question is a throwaway build, as before: `//!native` on
  the twelve fixture modules and nothing else, one full run, reverted.
- The baseline gap, the library standings, the `Packed<T>` pair, and the
  noise reading need no build: read them from the current `speed.md` and
  `speed-trials.tsv`.
- Record each result once, in the research paper that
  documentation-restructure.md assigns it to, with the run's date, engine,
  and commits; then replace the stale statement in the document that
  carries it with the corrected figure or with a link to the paper.
- Where a ratio changes enough to change a decision — an item dismissed at
  1.00× that is not 1.00×, or a landed change worth less than the
  machinery it added — reopen the item in generated-code-performance.md
  rather than editing the number silently.
