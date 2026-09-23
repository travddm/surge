# Future work: re-measure the speed conclusions recorded before the suite yielded

Part of the [surge](../architecture.md) design.

## What

Until 2026-09-23 the speed suite (`tests/src/bench/speed.spec.ts`) never
yielded, so a full run held Studio's plugin thread for the whole catalog
with no frame in between. After roughly ten seconds without a frame, every
path that allocates per call slows by an order of magnitude and stays slow.
The A/B that established this is recorded in the comment block of
`speed.spec.ts` and in "Running the speed tier via run-in-roblox" in
[testing.md](../testing.md): with the yield disabled, serio's large record
decode fell from 24k values a second on its first trial to 1.9k on its
last; with it enabled, the same cell held 24k across all five. The suite
yields between timed chunks now, and re-recording
[benchmarks/speed.md](../benchmarks/speed.md) that way moved 105 of its 124
cells by more than 1.2×, up to 19× (fbs encode on `Blink: Entities`).

Every conclusion below was drawn from runs made before that change. The
numbers in the current `speed.md` are sound; the numbers quoted in the
documents are not, and the documents still state them.

**Which cells a pre-change run got wrong.** A full run measured its encode
half first, in catalog order, and its decode half after it. So:

- Unaffected: the encode cells of the first three fixtures (small flat
  struct, deeply nested object, wide struct), which finished inside the
  first second; and any scoped run whose measured time stayed under about
  ten seconds.
- Affected: every encode cell from the fourth fixture on, and every decode
  cell. The onset is not sharp: the earlier trials put it about nine to
  ten seconds into a run, which lands inside the large array's encode or
  at the large record's, where the old file shows its first clearly slow
  trial (fbs encode, one trial twelve times slower than its four
  neighbors). The factor differs per cell and per library — 19× on one
  cell, under 1.2× on 19 others — and falls hardest on the paths that
  allocate most, which are decodes, serio, and Blink's encode.
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

**Conclusions to re-measure**, with where they are stated:

| Conclusion                                                                                                                       | Stated in                                                                                         | Rests on                                                   | Priority                                                  |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| `--!native` is worth about nothing on the generated code: 1.016×/1.021×, then 1.028×/1.099× on encode/decode                     | generated-code-performance.md, What `--!native` is worth (both entries) and What native changed   | Full runs; decode half and late encode cells               | First: every dismissal in What native changed rests on it |
| Reserving bytes inline: 4.15× encode, 2.48× decode across the catalog; 7.35×, 6.56×, 5.56× on the union/boolean rows             | generated-code-performance.md, Reserving bytes inline; future-work/README.md narrative            | Full runs either side; all listed cells late or decode     | Second: the headline result                               |
| Shared reservation: 4.70×, 3.01×, 3.96×, 1.72×, 1.51×, 1.43×, 1.17×                                                              | generated-code-performance.md, One helper call per field; future-work/README.md narrative         | Full runs either side; mixed (wide struct encode is clean) | Second                                                    |
| `CFrame` second reservation: 1.61× encode, 1.35× decode                                                                          | generated-code-performance.md; future-work/README.md narrative                                    | Full runs; `CFrame` array is a late encode row             | Third                                                     |
| Tagged-union literal: 1.39× decode, 6929 to 9608 values a second                                                                 | generated-code-performance.md; future-work/README.md narrative                                    | Full runs; decode                                          | Third                                                     |
| Baseline gap: 2.87×/1.63× at the start, 1.08×/1.05× interpreted, 1.08×/1.06× native, on the `CFrame` array                       | generated-code-performance.md opening; benchmark-tooling.md results; future-work/README.md        | Full runs; the end state can be read from the current file | Read from the current file; re-run only the start         |
| Library standings: surge ahead of fbs on all 32 cells, of serio on all 32, Blink ahead on 1 of 11 encode and 4 of 11 decode rows | benchmark-tooling.md results; future-work/README.md narrative                                     | Full run                                                   | Read from the current file                                |
| `Packed<T>` against unpacked: 0.96× encode, 0.22× decode, and the three earlier pairs                                            | benchmark-tooling.md results                                                                      | Full runs; the `toggles` rows are late                     | Current pair from the file; earlier pairs if wanted       |
| Pinning `--!optimize 2` cost nothing: 1.004× encode, 1.030× decode, controls at 1.000×                                           | generated-code-performance.md; future-work/README.md narrative                                    | Full runs either side                                      | Low: the mechanical argument stands without it            |
| Blob side channel 0.997× and `finishWrite` copy 1.007×: per-call costs are worth nothing                                         | generated-code-performance.md, Blob side channel and finishWrite; future-work/README.md narrative | Full runs; quiet cells in both halves                      | Low, but the null result was taken under a penalty        |
| Noise is concentrated in encode on the fastest rows; 27 cells spread over a tenth, 11 over three tenths                          | benchmark-tooling.md results                                                                      | One full run                                               | Re-read from the current trials file                      |

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
  carries it with the corrected figure or with a link to the paper. The
  narrative in [README.md](README.md) is the last place to correct, since
  the restructure removes it.
- Where a ratio changes enough to change a decision — an item dismissed at
  1.00× that is not 1.00×, or a landed change worth less than the
  machinery it added — reopen the item in generated-code-performance.md
  rather than editing the number silently.
