# Future work: benchmark tooling for size and speed against fbs, serio, Blink, and Zap

Part of the [surge](../architecture.md) design. Replaces the earlier
benchmark-coverage note. The harness measures **bandwidth** (bytes per
value) and **speed** (values per second) for surge and the comparison
libraries over one shared fixture catalog.

The harness and three of its adapters have landed: the catalog of 16 rows is
in `tests/src/bench/fixtures/`, `catalog.ts` lists it, and
`adapters/surge.ts`, `adapters/fbs.ts`, and `adapters/serio.ts` drive every
row through `createBinarySerializer<T>()`, fbs's call of the same name, and
serio's `createSerializer<T>()`. `mise run bench:size` writes
[benchmarks/size.md](../benchmarks/size.md) with each library's bytes, its
ratio against surge, and how far its round trip moved the value; `mise run
bench:speed` runs the speed suite in a real Roblox process. So the project's
claims now have measured bytes for surge, fbs, and serio, and no timings at
all. What remains is the Blink adapter, the hand-written baseline, and the
speed tier's first real run: `speed.spec.ts` compiles and type-checks but has
never been run, which needs a Roblox Studio process.

**Zap is a size-only column, and it comes after Blink.** It has no callable
encoder: its `types` table is module-local and only recursive declarations
get `write_X`/`read_X`. Its bytes are still measurable honestly — fire one
event into a mocked RemoteEvent and subtract the event-id byte — and its
decode can be timed through the `opt tooling` decoder, which takes a buffer
directly. Its **encode** throughput is not: the only path to it is the event
path, which measures batching and the mock as much as the encoder, so Zap
gets no encode number rather than a misleading one. The order is Blink
first because the two share most of the cost — a compiler binary in the
toolchain, IDL twins of all 16 rows, a build step, and a mocked remote
environment — and Blink is the one that also yields real timings, so it
proves that scaffolding on a library whose numbers are comparable
throughout. Once it exists, Zap's marginal cost is its own binary and its
own twins.

Library facts below come from source reading at the commits pinned in
[type-coverage-parity.md](type-coverage-parity.md). fbs and serio have since
been executed against the catalog; what that measured is under
[What the first three-library run showed](#what-the-first-three-library-run-showed).

## What

### Two metrics, three tiers

| Tier | Metric                            | Runs under                      | Why                                                                                                                                                               |
| ---- | --------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Buffer bytes + side-table entries | Lune (`mise run bench:size`)    | **Landed for surge, fbs, and serio.** Deterministic; no Studio; Lune has `@lune/fs`, so the run writes its own results table. Doubles as a byte-regression gate.  |
| 2    | Encode and decode values/second   | Real Roblox via `run-in-roblox` | Per Benchmarking strategy in [testing.md](../testing.md), only the real engine's timings count.                                                                   |
| 3    | Wire cost (`Stats.DataSendKbps`)  | Real Roblox, client and server  | Optional. Blink's own benchmark method; the only tier that includes remote overhead and batching, so a networking library and a bare serializer meet on one axis. |

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

Blink's two rows are implemented from the shapes as this document records
them. The `.blink` definitions are transcribed from Blink's own repository
at the commit pinned in
[type-coverage-parity.md](type-coverage-parity.md) when the Blink adapter
lands, which is also when a mismatch would matter.

Blink and Zap need IDL definitions for the same rows, kept next to the
fixtures (`bench/definitions/*.blink`, `*.zap`) and compiled at build time.
Both compilers install through mise's `github:` backend, the same pattern
`mise.toml` uses for rojo (installability via mise unverified); Blink itself
runs under Lune.

Neither can express every row, so their columns will have gaps where the
three TypeScript libraries have none. From the coverage matrix in
[type-coverage-parity.md](type-coverage-parity.md): a Roblox `EnumItem` is
not a type either one has, so the enum-heavy row has no equivalent (their
`enum` is a set of names, which measures something else); Blink has no
guarded unions at all; and neither has a `Packed<T>`, so the packed rows
compare a surge feature against its absence rather than two encodings. The
harness has no rendering for a missing cell today — `collectSizeRows` fails
when a row has no entry for a library — so the Blink step adds one, and the
rows it cannot express say why in their note.

### How each library is driven (stated honestly)

| Library | Drive                                                                                                                                                                                         | Caveat                                                                                                                                                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| surge   | `createBinarySerializer<T>()`                                                                                                                                                                 | none                                                                                                                                                                                                                           |
| fbs     | `createBinarySerializer<T>()`; plain closures; needs `rbxts-transformer-flamework`, already in `tests/tsconfig.json`                                                                          | Its surface is the one surge is a drop-in alternative to, so its adapter is surge's with one import changed. Not reentrant.                                                                                                    |
| serio   | `createSerializer<T>()` (a default export); plain closures; explicitly supports Lune, with its own `IS_LUNE` branches                                                                         | `SerializedData.buf` is `undefined` at zero bytes and `blobs` at none, so a missing field is zero, not an error; plain `number` is f32 (fixtures pin widths anyway); `CFrame` is lossy, so the size table reports by how much. |
| Blink   | `export type X` generates `X.Write(value) -> buffer` and `X.Read(buffer)` (used standalone in Blink's own `test/Test.luau`); `option Typescript` emits `.d.ts`                                | Generated modules resolve RemoteEvents at require time, so the harness mocks that environment as Blink's `test/Shared.luau` does. Exports exclude generics, `Instance`, and `unknown`. `Write` allocates twice per call.       |
| Zap     | **No encoder API.** Size: mock the RemoteEvent, fire one event, measure what `SendEvents` flushes, minus the event-id byte. Decode timing: the `opt tooling` decoder takes a buffer directly. | Encode timing is only reachable through the event path, which includes batching and the mock, so the column carries bytes and a decode rate and no encode rate.                                                                |

The hand-transcribed "ideal flat serializer" baseline from testing.md
stays as a further column: it is what shows whether surge's output has
avoidable overhead, independent of any library.

### What the first three-library run showed

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
  that any of the three passes outside the buffer.

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
- Output: `docs/benchmarks/size.md` written by the Tier 1 run;
  `docs/benchmarks/speed.md` recorded by hand from the Tier 2 output with
  the machine, the date, and the commit of every library.

One of those is not implemented, deliberately: generated Luau size. Each
fixture module holds its shape, its sample value, and now three factory
calls, so its compiled size is not any one library's generated code size.
Measuring it honestly needs the call in a module of its own per fixture and
library; do that with the speed tier, where code size against speed is the
actual question.

## Why deferred

fbs and serio are `tests/` dependencies now, pinned to the versions the
coverage matrix reads. What is left needs the Blink and Zap binaries in the
toolchain, IDL twins of every fixture in both dialects, and a mocked remote
environment for the modules both generate; each is real work, and most of it
is shared between the two.

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
4. Add the Blink adapter (Lune-compiled definitions, mocked remotes), and
   with it the missing-cell rendering the rows it cannot express need.
5. Add Zap's size column on that same scaffolding (mocked remote minus the
   event-id byte), plus its decode timing through the `opt tooling`
   decoder. No encode number.
6. Add the hand-written baseline for the flat, nested, and `CFrame` rows.
7. Run the speed tier for the first time, and record
   `docs/benchmarks/speed.md`.
8. Tier 3 last, only if wire cost with batching becomes a question the
   serializer comparison cannot answer.
