# Future work: benchmark tooling for size and speed against fbs, serio, Blink, and Zap

Part of the [surge](../architecture.md) design. Replaces the earlier
benchmark-coverage note. The harness measures **bandwidth** (bytes per
value) and **speed** (values per second) for surge and the comparison
libraries over one shared fixture catalog.

The harness and every adapter have now landed: the catalog of 16 rows is in
`tests/src/bench/fixtures/`, `catalog.ts` lists it, and `adapters/` drives
every row each library can express — through `createBinarySerializer<T>()`,
fbs's call of the same name, serio's `createSerializer<T>()`, the
`Write`/`Read` pair a Blink `export` generates, one event fired at a mocked
RemoteEvent for Zap, and, for the baseline column, a pair of hand-written
Luau functions. `mise run bench:size` writes
[benchmarks/size.md](../benchmarks/size.md) with each column's bytes, its
ratio against surge, and how far its round trip moved the value; `mise run
bench:speed` drives a real Roblox Studio process through `run-in-roblox` and
writes [benchmarks/speed.md](../benchmarks/speed.md) from what that process
printed. Both tiers have now run, so the project's claims have measured bytes
and measured timings against every library it names. Only Tier 3 is left, and
nothing yet asks for it.

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
under
[What the run showed](#what-the-run-showed).

## What

### Two metrics, three tiers

| Tier | Metric                            | Runs under                      | Why                                                                                                                                                                                                                                      |
| ---- | --------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Buffer bytes + side-table entries | Lune (`mise run bench:size`)    | **Landed, all six columns.** Deterministic; no Studio; Lune has `@lune/fs`, so the run writes its own results table. Doubles as a byte-regression gate.                                                                                  |
| 2    | Encode and decode values/second   | Real Roblox via `run-in-roblox` | **Landed.** Per Benchmarking strategy in [testing.md](../testing.md), only the real engine's timings count. A Roblox process has no filesystem, so the suite prints its rows and `scripts/record-speed-benchmarks.mjs` writes the table. |
| 3    | Wire cost (`Stats.DataSendKbps`)  | Real Roblox, client and server  | Optional. Blink's own benchmark method; the only tier that includes remote overhead and batching, so a networking library and a bare serializer meet on one axis.                                                                        |

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

### What the run showed

From [benchmarks/size.md](../benchmarks/size.md), which the run writes:

- surge and fbs agree byte for byte on 14 of the 16 rows, including the
  unpacked `CFrame` row. That is the expected result of a drop-in
  alternative with the same encodings, and it leaves the two packed
  `CFrame` rows as the only bandwidth story between them.
- serio matches both on every non-`CFrame` row and is smaller on `CFrame`
  (904 against 1204 bytes for 50 rotations), because its rotation is a
  6-byte quantized axis-angle against surge's 12-byte one. The size table
  now carries what that costs: about 1e-4 per rotation component, against
  about 2e-7 for surge and fbs, which is f32 rounding.
- surge's `Packed<T>` axis-aligned `CFrame` row is its one clear win: 654
  bytes against fbs's 1179 and serio's 904, and the only exact round trip
  of the three.
- The reason is that fbs and serio both look their axis-aligned rotation up
  with exact `CFrame` equality (`table.find`) against a table of 24 built
  from `CFrame.Angles`. Only 3 of that row's 50 rotations, which are built
  from unit axes, are exactly equal to an entry — measured directly, and
  the byte deltas agree: a match saves 11 bytes under fbs and 5 under
  serio, which is exactly the gap between each library's two packed
  `CFrame` rows. The other 47 take each library's general rotation form.
- Those fallbacks are where the two rows' errors come from. fbs writes
  axis × angle as three f32, which costs about 2e-7. serio writes its
  6-byte quantized axis-angle, which loses a rotation about the X axis
  outright — the row's worst component moves by 1.0 — because the scale it
  maps the axis's Y component onto, `(1 - x²)^0.5`, is zero there. The
  0.01-to-0.7 errors on other elements of that row have no mechanism
  recorded here; only that they are far larger than the 1e-4 the same
  encoding costs on an arbitrary rotation.
- No row puts a value in any library's side table, so no cell carries a
  `+N side` marker. The catalog has no `Instance`, `unknown`, or datatype
  that any of the four passes outside the buffer.
- Blink is at or below surge on all 11 rows it can express, and every byte
  of every difference is a length prefix: it defaults an unbounded string,
  array, and map to a u16 count where surge writes u32. Each delta is that
  and only that — 4 bytes on the nested object (two strings), 402 on the
  large record (its map count and 200 key prefixes), 206 on string-heavy
  (103 prefixes: two strings, the `lines` array, and its 100 elements), 46
  on the tagged union (its array count and one prefix for each of the 22
  chat events the row's seed produces), and 2 on each remaining row, which
  has one length prefix each. Nothing else in the catalog separates them:
  its `CFrame` is 24 bytes like surge's and fbs's, and inexact by the same
  2e-07 of f32 rounding.
- So Blink's column is an argument for length-typed containers, which is
  Tier B of [type-coverage-parity.md](type-coverage-parity.md), and for
  nothing else. It is also the one comparison here that a bound would move:
  the fixtures brand element widths only, so Blink took its defaults.
- Zap matches Blink byte for byte on every row both express, except the
  large record, and for the same reason: it too defaults an unbounded
  string, array, and map to a u16 count. Its saving against surge is a
  length prefix every time — 66 bytes on the guarded union, for instance,
  which is its array count plus one prefix for each of the 32 strings among
  that row's 100 values. The large record is the exception, and only just:
  Zap's map header is 3 bytes, a presence bit and a u16 count, against
  surge's 4-byte u32 count and Blink's 2-byte u16 count.
- Zap's bit packing is per scope, exactly as the coverage matrix's "per-scope
  mask" says, and the catalog shows both sides of that. The booleans and
  optional presence of a struct share a mask, which is why its `toggles` cell
  (14 bytes) is surge's `Packed<T>` (16) less that row's one string prefix.
  An array element is its own scope, so the 1000-boolean row costs it 1002,
  exactly what surge and Blink pay.
- Zap's `CFrame` row is 1202 bytes, 24 per rotation like surge's and fbs's,
  but its round trip is the one result here that is an artifact of the
  runner rather than the library. Zap rebuilds a rotation by handing the
  unnormalized axis-angle vector to `CFrame.fromAxisAngle`, and Lune does
  not normalize it, so the matrix comes back scaled. Its real client reader
  does the same thing as its tooling decoder, so either the engine
  normalizes or Zap's `CFrame` support is broken in production; surge and
  fbs both pass `.Unit` and depend on neither. Not established here.
- The baseline writes 17, 24, and 1204 bytes, which is surge's number on all
  three rows it covers. That is the point of it as a size row: it says the
  two are encoding the same thing, so the speed tier's comparison between
  them is about code and not about format. Its `CFrame` row is inexact by
  the same 2e-07, for the same reason — it stores the same axis-angle triple
  in f32, and on the decode side of that row both make the same
  `CFrame.fromAxisAngle` call, which the format fixes, so what its decode
  gap can show is loop and cursor overhead and nothing else.

And from [benchmarks/speed.md](../benchmarks/speed.md), which the Tier 2 run
writes:

- Two of the five columns ran with Luau's `--!native` and `--!optimize 2`
  and three ran without. fbs carries both on `createSerializer` and
  `createDeserializer`, which is where its codec runs, and Blink's generated
  module carries both; roblox-ts emits neither, so surge and serio have
  neither, and the baseline drops them on purpose. Whether the process
  honours them was measured rather than assumed: two modules built at run
  time from one source, differing only in the directives, ran the same tight
  buffer loop, and the one carrying `--!native` was 11.68 times faster in the
  same Studio build; on a loop shaped like a codec, with an allocation per
  call and a string write, it was 2.25 times faster. `--!optimize 2` was
  worth nothing either way. surge's package has since taken `//!native` on
  its four hot modules, which measured as nothing on its own — see
  [generated-code-performance.md](generated-code-performance.md), which
  carries this whole thread.
- serio and the baseline are the two columns compiled the way surge is.
  surge is ahead of serio on all 32 of their measurements: by 1.25× to
  15.36× on encode, and by 1.03× to 5.95× on decode.
- The baseline is the result this tier was built for. It writes surge's exact
  bytes, so none of its lead is format: it encodes between 2.58× and 3.20×
  faster and decodes between 1.64× and 2.48× faster, over the three rows it
  covers. That gap is what the emitted code costs against straight-line Luau,
  and it is the measurement
  [generated-code-performance.md](generated-code-performance.md) was waiting
  for.
- Against fbs, which is compiled differently, surge is behind on 10 of the 16
  encode rows and ahead on 10 of the 16 decode rows. It leads the six encode
  rows where an object has a run of fixed-size fields to share one
  reservation, or where `Packed<T>` or the guarded union is its own surface:
  fbs encodes Blink's `Entities` bench at 0.32× of surge's rate and the wide
  struct at 0.70×. On decode the widest is the wide struct, at 0.18×.
- `Packed<T>` is not only smaller, but it is much less of a speed win than it
  was. The same shape encodes 1.22× faster packed than unpacked and decodes
  at 0.48×, against 2.11× and 0.72× before the shared-reservation change: the
  packed path is a bit region and shares nothing, so the unpacked path is
  what got faster.
- Blink is ahead on every decode row and on 10 of its 11 encode rows, by as
  much as 5.74× on its own `Booleans` bench. Its `Entities` bench used to be
  a 23× lead and is now 4.95×, which is the shared-reservation change and
  not Blink. The one row it loses is the 1000-element array, at 0.16×, where
  it is the slowest of the four columns.
  That cell is not a property of its encoder: measured alone, Blink encodes
  that row at 134k to 144k values per second, five times ahead of surge. See
  the next entry.
- A scoped run and a full run do not agree on every cell, and where they
  disagree it is by an order of magnitude. Measured against the run checked
  in at `1b1ec9f`, encode on the two union rows was 13× and 14× faster alone
  than in a full run, and for all four columns at once — surge, fbs, serio,
  and Blink together — and Blink's 1000-element array encode 34× faster
  alone. Decode agrees on every row
  tried, and both halves of the large array, the large record, the
  string-heavy row, and the three `CFrame` rows agree but for that one Blink
  cell. What separates a row that agrees from one that does not was not
  established. This is why a scoped table is read only against another
  scoped run of the same patterns, which "Either tier can be scoped to some
  fixtures" below already requires. It also means a full run is the only
  readable protocol for a row whose scoped trials are noisy: both union rows
  decode within a percent of their median in a full run and spread by 91%
  and 302% measured alone.
- The noise is concentrated in encode on the rows that run fastest, where
  10000 calls take a few milliseconds. Of the 124 cells, 24 spread more than
  a tenth of their median between their slowest and fastest trial, 12 more
  than three tenths, and four more than a whole median. All 12 sit on the
  flat struct, the nested object, the wide struct, or the large array, and on
  eleven of them the median is nearer the slowest trial than the fastest —
  the
  shape of a cost most trials pay and one does not. What that cost is was not
  established. Every row whose trials take longer is quiet.

### Methodology

- Speed: warm-up, then N trials of M iterations; report the median and
  the spread, encode and decode separately, in values per second; the
  same value object reused across iterations; result buffers discarded.
  `speed.spec.ts` does this with 1000 warm-up calls and 5 trials of 10000,
  and prints the median with the lowest and highest trial, one line per
  fixture and library.
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
  `docs/benchmarks/speed.md`, written by
  `scripts/record-speed-benchmarks.mjs`, which wraps `run-in-roblox`, reads
  the `BENCH_ROW:` lines the suite prints, and records with them the date,
  the machine, the engine version the process reports, and the commit or
  version of everything measured. A Roblox process has no filesystem, so
  printed output is the only channel a timing has. Either tier also runs
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

Nothing is deferred any more. fbs and serio are `tests/` dependencies, Blink
and Zap are in `[tools]`, all four have definitions, declarations, and
checked-in generated modules where they need them, the baseline is this
project's own Luau, and both tiers have run and written their tables. Tier 3
stays optional, on the condition in the last step below.

## How, briefly

1. ~~Restructure `tests/src/bench/` into `fixtures/`, `adapters/`, a size
   module, and `speed.spec.ts`; add `bench:size` (Lune) and `bench:speed`
   (`run-in-roblox`) tasks.~~ Landed, with `size.ts` as a plain function
   rather than a `.spec` suite: @rbxts/runit takes every ModuleScript whose
   name ends in `.spec`, and the size run returns rows for
   `scripts/lune-size-runner.luau` to write instead of asserting.
2. ~~Land the surge adapter, with the Lune size run writing
   `docs/benchmarks/size.md`.~~ Landed.
3. ~~Add the fbs and serio adapters, one shape declaration per library, and
   the per-library columns and ratios in the size table.~~ Landed. Two
   things the round-trip column needed came with it: the component-error
   number above, and a shim fix — Lua's `require` stores `true` for a
   module that returns nil, where Roblox's returns the nil, which serio's
   type-only `data-types` module hits.
4. ~~Add the Blink adapter (Lune-compiled definitions, mocked remotes), and
   with it the missing-cell rendering the rows it cannot express need.~~
   Landed, with `bench:definitions` as the regeneration task, the generated
   modules checked in, and hand-written declarations for them.
5. ~~Add Zap's size column on that same scaffolding (mocked remote minus the
   event-id byte), plus its decode timing through the `opt tooling`
   decoder. No encode number.~~ Landed, size only: the mocked remote its
   encode path needs exists only under Lune, so there is no decode timing
   either, and `SIZE_ONLY` keeps the speed suite off it.
6. ~~Add the hand-written baseline for the flat, nested, and `CFrame`
   rows.~~ Landed as `bench/baseline/codecs.luau`, hand-written Luau with
   declarations beside it, writing surge's bytes exactly so the timing is
   like for like.
7. ~~Run the speed tier for the first time, and record
   `docs/benchmarks/speed.md`.~~ Landed, and the recording is not by hand:
   the suite prints one row per fixture, library, and half, and
   `scripts/record-speed-benchmarks.mjs` wraps `run-in-roblox` and writes the
   table. Two things had to come first. Zap's generated module errors on a
   client and Studio's edit mode answers true to both `IsClient` and
   `IsServer`, so every fixture that named a Zap event failed to load in a
   real Roblox process; `bench/zap/deferred.luau` requires it on first use
   instead, and `defineEntry` puts off a size-only entry's first encode, so
   neither happens outside Lune. And `runBenchmarks` had no verdict to read,
   so it now prints `BENCH_RESULT:` the way `main` prints `RUNIT_RESULT:`.
8. Tier 3 last, only if wire cost with batching becomes a question the
   serializer comparison cannot answer.
