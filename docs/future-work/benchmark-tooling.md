# Future work: benchmark tooling for size and speed against fbs, serio, Blink, and Zap

Part of the [surge](../architecture.md) design. Replaces the earlier
benchmark-coverage note. The harness measures **bandwidth** (bytes per
value) and **speed** (values per second) for surge and the comparison
libraries over one shared fixture catalog.

The harness is built and both of its measured tiers run: `mise run bench:size`
writes [benchmarks/size.md](../benchmarks/size.md) and `mise run bench:speed`
writes [benchmarks/speed.md](../benchmarks/speed.md). What they found is under
[docs/research/](../research/README.md). This document holds the two items
still open, under How, briefly, and until `specs/benchmark-harness.md` is
written it also holds the harness design below, which that specification
takes over ([documentation-restructure.md](documentation-restructure.md)).

**Zap is a size-only column.** It has no callable encoder: its `types` table
is module-local and only recursive declarations get `write_X`/`read_X`. So
its adapter fires one event at the mocked RemoteEvent the Lune shim provides,
calls the `SendEvents` that `opt manual_event_loop` exposes, and measures
what the remote was handed, minus the one event-id byte. The decode side is
the `opt tooling` decoder, which does take a buffer, so the row still
round-trips. Its **encode** throughput is not measurable honestly: the only
path to it is that event path, which measures batching and the mock as much
as the encoder, and the mock exists only under Lune. `SIZE_ONLY` in
`bench/adapter.ts` is what keeps `speed.spec.ts` off it.

Library facts below come from source reading at the commits pinned in
[type-coverage-parity.md](type-coverage-parity.md). All four comparison
libraries have since been executed against the catalog; what that measured is
in [serialized-size-across-libraries.md](../research/serialized-size-across-libraries.md)
and the speed papers beside it.

## What

### Two metrics, three tiers

| Tier | Metric                            | Runs under                      | Why                                                                                                                                                                                                                          |
| ---- | --------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Buffer bytes + side-table entries | Lune (`mise run bench:size`)    | Deterministic, over all six columns; no Studio; Lune has `@lune/fs`, so the run writes its own results table. Doubles as a byte-regression gate.                                                                             |
| 2    | Encode and decode values/second   | Real Roblox via `run-in-roblox` | Per Benchmarking strategy in [testing.md](../testing.md), only the real engine's timings count. A Roblox process has no filesystem, so the suite prints its rows and `scripts/record-speed-benchmarks.mjs` writes the table. |
| 3    | Wire cost (`Stats.DataSendKbps`)  | Real Roblox, client and server  | Optional. Blink's own benchmark method; the only tier that includes remote overhead and batching, so a networking library and a bare serializer meet on one axis.                                                            |

Tier 1's numbers were only unstable before the wire-format determinism
fixes (literal/guardedUnion ordering, packed padding, discriminant choice)
and the enum index-width fix landed — see Transformer Design §3 in
[transformer.md](../transformer.md). It is now a checked-in table that
changes only when an encoding changes.

### One fixture catalog, one adapter per library

Each row is one module under `tests/src/bench/fixtures/`: one sample value
(built with the suites' own seeded `Rng` where the row needs bulk data, so a
row is reproducible), and its shape declared once per library with explicit
widths (`DataType.u8`, `f32`) and, where the library supports it, explicit
bounds, so size deltas reflect format decisions rather than each library's
defaults. The shape is declared per library because each library brands its
widths with its own type aliases — surge's `DataType.u32`, fbs's
`DataType.u32`, serio's top-level `u32` — and one library's brand is not
another's. `catalog.ts` lists the rows in one `ReadonlyArray<Fixture>`, which
both tiers read. `defineEntry` closes one library's half of a row over that
library's shape type, so a `Fixture` is a name, a note, and one `Entry` per
library, and the two tiers never name a shape. Each library gets an adapter
with the same interface:

```ts
interface Adapter<T> {
	encode: (value: T) => { bytes: number; side: number; payload: unknown };
	decode: (payload: unknown) => T;
}
```

The 16 rows are the testing.md list plus Blink's two published benches, so
results can be sanity-checked against its table: small flat struct; deeply
nested object; wide struct (50 f32 fields, just under the 120-local
block-split threshold in Risks in [transformer.md](../transformer.md));
large array; large `Record`; string-heavy; enum-heavy; tagged union;
guarded union; `Packed<T>` vs unpacked; three `CFrame` rows (unpacked,
packed with axis-aligned rotations, packed with arbitrary ones); and
Blink's `Booleans` (1000 booleans) and `Entities` (100 structs of six
`u8` fields).

Four rows differ from this plan's original wording, for reasons the
libraries and the size tier's runtime force:

- The enum row uses `Enum.Material` (45 members, a u8 index), not
  `Enum.KeyCode`. The generated lookup tables name every member
  `@rbxts/types` declares, and Lune's Roblox database is missing members
  of every enum above 256 members — the same reason `coverage.spec.ts`
  skips `Enum.KeyCode`. Of the 631 declared enums, the widest Lune has in
  full is `StudioStyleGuideColor` at 130, so no fixture can exercise the
  u16 index under Lune; `emit.test.ts` and `golden.test.mjs` pin that
  width instead.
- The axis-aligned `CFrame` row builds its rotations with
  `CFrame.fromMatrix` over unit axes, not as a product of `CFrame.Angles`
  quarter turns. A product leaves components of about 4e-8 where the exact
  rotation has 0, which would make the row's round trip inexact for a
  reason that has nothing to do with the encoding.
- The large `Record` row is a `Map` under fbs and serio. Both read an
  object's fields from the property list their Flamework macro sees, which
  an index signature does not provide, so a string-keyed table reaches them
  only as a `Map`. The same 200 pairs travel either way, so the byte counts
  stay comparable.
- The guarded union's number variant is branded `f64` for serio, whose
  plain `number` is f32 where surge's and fbs's is f64. The row is about
  how each library tags a variant, not about whose default width is
  narrower.

Blink's two rows are transcribed from
`benchmark/definitions/Definition.blink` in Blink's own repository at the
commit pinned in [type-coverage-parity.md](type-coverage-parity.md). Its
`Booleans` is `boolean[0..1000]` and its `Entity` is six `u8` fields, which
is what the catalog already had; the field names differ (`id`, `x`, `y`,
`z`, `orientation`, `animation` against `a` to `f`) and the bytes do not.
Each is wrapped in a struct here, because an export is a named type and the
catalog's rows are objects; a struct of one array costs no bytes over the
bare array Blink's own definition sends. The cross-check against Blink's
published table stays approximate either way: that table reports
`Stats.DataSendKbps` over fired events, which is Tier 3 here, not a buffer
length.

Blink and Zap need IDL definitions for the same rows, kept next to the
fixtures (`bench/definitions/catalog.blink`, `catalog.zap`) and compiled
ahead of the run. Both compilers install through mise's `github:` backend,
the same pattern `mise.toml` uses for rojo; Blink 0.18.8 and Zap 0.6.29 are
in `[tools]`, and `mise run bench:definitions` compiles both into
`bench/blink/` and `bench/zap/`. The generated modules are checked in, so a
fresh checkout compiles and measures without running either compiler first.
Blink's output is byte-identical run to run, so a diff in it means a
definition changed. Zap's is not: it emits its type declarations in a
different order each time, which moves no bytes — the size table is
identical across regenerations — but does mean a diff there proves nothing.

One width rule keeps an IDL column honest: override a default only where the
fixture brands a width. The fixtures brand element widths (`u8`, `u16`,
`f32`), never length prefixes, so every string, array, and map in both
definition files is unbounded and takes the u16 count both compilers default
to — a real format difference against surge's u32, which is what the table
should show. The two Blink rows are the exception: they keep the `[0..1000]`
bound their own definition carries, because matching it is their point. Zap
also makes a string's kind explicit, and every one here is `string.binary`:
the fixtures' strings are arbitrary bytes, not text.

Neither can express every row, so their columns have gaps where the three
TypeScript libraries have none. A missing cell renders as an empty column
entry: `collectSizeRows` emits a cell only for a library with an entry, since
a Luau array cannot hold a hole.

Blink has a cell on 11 of the 16 rows. It has no Roblox `EnumItem` — its
`enum` is a set of names, which measures something else — so the enum-heavy
row is empty; it has no untagged union, so the guarded-union row is empty;
and it has no `Packed<T>`, so the three packed rows are empty rather than
repeating an unpacked number under a heading about packing.

Zap has a cell on 12, and the gaps differ. It has no Roblox `EnumItem`
either. It does have untagged unions — `(string.binary | f64 | boolean)`,
dispatched by `typeof` at runtime, and the parentheses are load bearing: Zap
reads a bare `|` as the end of the declaration. Its bit packing is not
opt-in, so the `Packed<T>` pair inverts: the packed row is the one it matches
and the unpacked row is the empty one. Its packed `CFrame` rows are empty
because `AlignedCFrame` looks a rotation up by exact equality in a table
built from `CFrame.Angles` — the same table fbs and serio miss on the
fixture's rotations — and asserts on a miss instead of falling back to a
general form.

### How each library is driven (stated honestly)

| Library | Drive                                                                                                                                                                                                                                            | Caveat                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| surge   | `createBinarySerializer<T>()`                                                                                                                                                                                                                    | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| fbs     | `createBinarySerializer<T>()`; plain closures; needs `rbxts-transformer-flamework`, already in `tests/tsconfig.json`                                                                                                                             | Its surface is the one surge is a drop-in alternative to, so its adapter is surge's with one import changed. Not reentrant.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| serio   | `createSerializer<T>()` (a default export); plain closures; explicitly supports Lune, with its own `IS_LUNE` branches                                                                                                                            | `SerializedData.buf` is `undefined` at zero bytes and `blobs` at none, so a missing field is zero, not an error; plain `number` is f32 (fixtures pin widths anyway); `CFrame` is lossy, so the size table reports by how much.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Blink   | `export struct X { ... }` generates `X.Write(value) -> buffer` and `X.Read(buffer)`; the adapter drives the server output, which creates its own RemoteEvents rather than waiting for them                                                       | Its `option Typescript` output is unusable at 0.18.8: it declares each export with `declare const` and exports none of them, so `bench/blink/server.d.ts` is hand-written. The module takes `Players`, `RunService`, and `Instance.new` at require time, and errors on a second require under one `RemoteScope`, so the whole catalog is one definition file. `option ManualReplication` drops its `Heartbeat` connection. Exports exclude generics, `Instance`, and `unknown`. `Write` allocates twice per call.                                                                                                                                      |
| Zap     | **No encoder API.** One `Fire` at the mocked RemoteEvent the Lune shim provides, then the `SendEvents` that `opt manual_event_loop` exposes; the bytes are what the remote was handed, minus the event-id byte. `opt tooling` decodes them back. | Size only, and only under Lune: the real engine has no mocked remote and no fake player to queue against. Its TypeScript output describes the event layer, so `bench/zap/*.d.ts` is hand-written. It emits its declarations in a different order on every run, which moves no bytes. `AlignedCFrame` asserts rather than falling back. Its writer reads a vector's components as `.x`, which Lune's `Vector3` does not answer to. Its module errors on a client, and Studio's edit mode answers true to both `IsClient` and `IsServer`, so a fixture reaches it through `bench/zap/deferred.luau` on first use — which a Roblox process never reaches. |

The "ideal flat serializer" baseline from testing.md is the sixth column,
and the only one that is not a library. `bench/baseline/codecs.luau` is what
a person would write by hand for one fixed shape: one allocation sized up
front, then writes at constant offsets, with no schema and nothing to
dispatch on. It covers the flat struct, the nested object, and the `CFrame`
array — the three rows named in the plan — and it is written in Luau rather
than TypeScript on purpose, since the question it answers is what the Luau
costs, and roblox-ts's own loop and temporary idioms have no business being
in that answer. It writes surge's bytes exactly, field for field in the same
name-sorted order, which the size table is the check on: a baseline row that
did not equal surge's would be measuring a different format, and its timing
would mean nothing. All three match.

### Methodology

- Speed: warm-up, then N trials; report the median and the spread, encode
  and decode separately, in values per second; the same value object
  reused across iterations; result buffers discarded. `speed.spec.ts` does
  this with a tenth of a second of warm-up calls and nine trials of at
  least a fifth of a second of calls each, timed in chunks of 250 calls
  with a yield between chunks once a quarter second of measured work has
  passed, so that the engine gets a frame and the yield is never inside
  the time. A trial is a length of time and not a count of calls because a
  fixed 10,000 calls was five milliseconds on the fastest rows, and every
  cell whose trial ran under ten milliseconds spread by more than 10%.
  Within a row the libraries take turns, one trial each, so a drift over
  the row lands on every column alike, and three idle frames separate one
  row from the next so that a row does not pay for the row before it. The
  suite prints every trial's
  rate, one line per fixture and library, and the recorder summarizes: the
  median, and as the spread the middle half of the trials. A full run is
  two Studio processes back to back, pooled, and `speed.md` states how far
  a cell's median moved between them, which is the run-to-run noise. The
  run writes every trial of every run to `docs/benchmarks/speed-trials.tsv`
  beside it, so any other statistic is taken from there, two runs can be
  compared at trial level rather than only at their medians, and
  `mise run bench:speed:render` can write the table again from it without
  a run. The table opens with one figure per library and half, the
  geometric mean of its ratios against surge over the quiet rows; a cell
  whose spread or drift is above a tenth is marked and left out of it.
  Each half has a throughput table, the same cells as microseconds per
  value, and a table of ratios against surge.
- Compilation mode, per column: every column but serio's carries
  `--!native` and `--!optimize 2`, so the table measures the configuration
  surge recommends rather than roblox-ts's default. Each fixture module
  carries both, since that is where the generated serializers live and what
  a consumer is told to mark; so does the hand-written baseline, so that the
  distance between those two columns is a fact about code and not about
  compilation mode. fbs carries both on `createSerializer` and
  `createDeserializer`, and Blink on its generated module, as each ships.
  serio carries neither, since patching a dependency's modules is not worth
  the drift. What each directive is worth is in
  [file-directives-on-generated-code.md](../research/file-directives-on-generated-code.md).
- Size: bytes of the returned buffer plus the count of side-table entries,
  per fixture and library, plus the ratio against surge.
- Also per fixture and library: round-trip exactness, and, where a round
  trip is inexact, the largest absolute difference between the value's
  components and its round trip's. `max-error.ts` produces that number by
  walking the same structures `difference` does, with `CFrame` and
  `Vector3` unfolded into their components. It is what separates f32
  rounding from an encoding that quantizes on purpose, which one shared
  `exact`/`inexact` column cannot do now that three libraries share it.
- Output: `docs/benchmarks/size.md`, written by the Tier 1 run.
  `docs/benchmarks/speed.md` and `docs/benchmarks/speed-trials.tsv`,
  written by
  `scripts/record-speed-benchmarks.mjs`, which wraps `run-in-roblox`, reads
  the `BENCH_ROW:` lines the suite prints, and records with them the date,
  the machine, the engine version the process reports, and the commit or
  version of everything measured — marking a repository whose tree carries
  changes its commit does not, so a run meant to be checked in is run from a
  clean tree, and a probe's table carries the mark and is never checked in
  as a result. Where a paper rests on a probe, its table is kept under
  [docs/research/data/](../research/data/) with a header saying which build
  produced it and that it is not a result. A
  Roblox process has no filesystem, so printed output is the only channel a
  timing has. Either tier also runs
  scoped to particular fixtures, which prints its table rather than writing
  either file; see "Either tier can be scoped to some fixtures" in
  [testing.md](../testing.md).

One of those is not implemented, deliberately: generated Luau size. Each
fixture module holds its shape, its sample value, and now three factory
calls, so its compiled size is not any one library's generated code size.
Measuring it honestly needs the call in a module of its own per fixture and
library; do that with the speed tier, where code size against speed is the
actual question.

## Why deferred

Two things are left, and neither can start yet. Widening the hand-written
baseline measures nothing new until the per-call gap the three existing rows
already show is understood, and the large record cannot join it until Tier B
of [type-coverage-parity.md](type-coverage-parity.md) settles that row's
length prefix. Tier 3 has no driver: nothing yet asks what a serializer costs
on the wire once a networking layer batches it.

## How, briefly

1. Widen the hand-written baseline to the shapes whose generated code is
   not a straight run of writes: the tagged union (a branch on the tag and
   per-variant construction) and the packed `toggles` (the bit region runs
   through a runtime function rather than inline code). Not the large
   array, since the `CFrame` array already prices the loop at under a
   nanosecond per element; and not the large record until Tier B of
   [type-coverage-parity.md](type-coverage-parity.md) has settled its
   length prefix, because a baseline writes surge's exact bytes and the
   size tier checks that it does. Before either: the three rows already
   there show the encode gap as a constant of about 0.2 µs per call, not
   per field, and a new row measures nothing new until that is understood.
   [generated-code-against-hand-written.md](../research/generated-code-against-hand-written.md)
   accounts for an eighth of it and names two table allocations per call as
   the next thing to measure.
2. Tier 3 last, only if wire cost with batching becomes a question the
   serializer comparison cannot answer.
