# Future work: benchmark tooling for size and speed against fbs, serio, Blink, and Zap

Part of the [surge](../architecture.md) design. Replaces the earlier
benchmark-coverage note. The harness measures **bandwidth** (bytes per
value) and **speed** (values per second) for surge and the four comparison
libraries over one shared fixture catalog.

The harness itself and surge's own adapter have landed: the catalog of 16
rows is in `tests/src/bench/fixtures/`, `catalog.ts` lists it, and
`adapters/surge.ts` drives it through `createBinarySerializer<T>()`.
`mise run bench:size` writes [benchmarks/size.md](../benchmarks/size.md)
with surge's bytes for every row; `mise run bench:speed` runs the speed
suite in a real Roblox process. So the project's claims (Zap-level
throughput, faster than fbs) now have surge's half of the numbers and none
of the comparisons. What remains is one adapter per comparison library,
the two rows below that need their numbers to be worth reading, and the
speed tier's first real run: `speed.spec.ts` compiles and type-checks but
has never been run, which needs a Roblox Studio process.

Library facts below are from source reading at the commits pinned in
[type-coverage-parity.md](type-coverage-parity.md); nothing has been
executed against them.

## What

### Two metrics, three tiers

| Tier | Metric                            | Runs under                      | Why                                                                                                                                                              |
| ---- | --------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Buffer bytes + side-table entries | Lune (`mise run bench:size`)    | **Landed for surge.** Deterministic; no Studio; Lune has `@lune/fs`, so the run writes its own results table. Doubles as a byte-regression gate.                 |
| 2    | Encode and decode values/second   | Real Roblox via `run-in-roblox` | Per Benchmarking strategy in [testing.md](../testing.md), only the real engine's timings count.                                                                  |
| 3    | Wire cost (`Stats.DataSendKbps`)  | Real Roblox, client and server  | Optional. Blink's own benchmark method; the only tier that includes remote overhead and batching, so networking libraries and bare serializers meet on one axis. |

Tier 1's numbers were only unstable before the wire-format determinism
fixes (literal/guardedUnion ordering, packed padding, discriminant choice)
and the enum index-width fix landed — see Transformer Design §3 in
[transformer.md](../transformer.md). It is now a checked-in table that
changes only when an encoding changes.

### One fixture catalog, one adapter per library

Fixtures are declared once, in TypeScript, one module per row under
`tests/src/bench/fixtures/`: a shape, a sample value (built with the
suites' own seeded `Rng` where the row needs bulk data, so a row is
reproducible), and explicit widths (`DataType.u8`, `f32`) and, where the
library supports it, explicit bounds, so size deltas reflect format
decisions rather than each library's defaults. `catalog.ts` lists them in
one `ReadonlyArray<Fixture>`, which both tiers read. `defineFixture`
closes each row over its shape type, so the catalog needs no type
parameter and the two tiers never name a shape. Each library gets an
adapter with the same interface:

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

Two rows differ from this plan's original wording, for reasons the size
tier's runtime forces:

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

Blink's two rows are implemented from the shapes as this document records
them. The `.blink` definitions are transcribed from Blink's own repository
at the commit pinned in
[type-coverage-parity.md](type-coverage-parity.md) when the Blink adapter
lands, which is also when a mismatch would matter.

Blink and Zap need IDL definitions for the same rows, kept next to the
fixtures (`bench/definitions/*.blink`, `*.zap`) and compiled at build
time. Both compilers install through mise's `github:` backend, the same
pattern `mise.toml` uses for rojo (installability via mise unverified);
Blink itself runs under Lune.

### How each library is driven (stated honestly)

| Library | Drive                                                                                                                                                                                                                                                                                   | Caveat                                                                                                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| surge   | `createBinarySerializer<T>()`                                                                                                                                                                                                                                                           | none                                                                                                                                                                                                                     |
| fbs     | `createBinarySerializer<T>()`; plain closures; needs `rbxts-transformer-flamework`, already in `tests/tsconfig.json`                                                                                                                                                                    | guard unions need Flamework-generated guards; those fixtures must compile through Flamework's transformer too. Not reentrant.                                                                                            |
| serio   | `createSerializer<T>()`; plain closures; explicitly supports Lune                                                                                                                                                                                                                       | `SerializedData.buf` is `undefined` at zero bytes; plain `number` is f32 (fixtures pin widths anyway); CFrame is lossy, so its round-trip error must be reported, not hidden.                                            |
| Blink   | `export type X` generates `X.Write(value) -> buffer` and `X.Read(buffer)` (used standalone in Blink's own `test/Test.luau`); `option Typescript` emits `.d.ts`                                                                                                                          | Generated modules resolve RemoteEvents at require time, so the harness mocks that environment as Blink's `test/Shared.luau` does. Exports exclude generics, `Instance`, and `unknown`. `Write` allocates twice per call. |
| Zap     | **No encoder API.** The `types` table is module-local and only recursive declarations get `write_X`/`read_X`. Size: mock the RemoteEvent, fire one event, measure what `SendEvents` flushes, minus the event-id byte. Decode timing: the `opt tooling` decoder takes a buffer directly. | Encode timing is only measurable through the event path (includes batching and the mocked remote) or through a hand-transcribed baseline of its generated statements. Label Zap encode numbers with whichever was used.  |

The hand-transcribed "ideal flat serializer" baseline from testing.md
stays as a sixth column: it is what shows whether surge's output has
avoidable overhead, independent of any library.

### Methodology

- Speed: warm-up, then N trials of M iterations; report the median and
  the spread, encode and decode separately, in values per second; the
  same value object reused across iterations; result buffers discarded.
  `speed.spec.ts` does this with 1000 warm-up calls and 5 trials of 10000,
  and prints the median with the lowest and highest trial.
- Size: bytes of the returned buffer plus the count of side-table entries,
  per fixture, plus the ratio against surge once a second library has an
  adapter.
- Also per fixture: round-trip exactness, and generated Luau size (bytes
  and lines) for surge, since inlining trades code size for speed.
- Output: `docs/benchmarks/size.md` written by the Tier 1 run;
  `docs/benchmarks/speed.md` recorded by hand from the Tier 2 output with
  the machine, the date, and the commit of every library.

Two of those are not implemented, deliberately:

- The size table reports round trips as `exact` or `inexact`, not as a max
  component error. A number is only worth the shape-aware traversal that
  produces it once a library whose loss is a design choice is in the table
  — serio's `CFrame`, per the driving table above. surge's own inexact
  rows are its axis-angle `CFrame` rotation, which the column already
  names.
- Generated Luau size is not measured. Each fixture module holds its shape,
  its sample value, and its `createBinarySerializer<T>()` call, so its
  compiled size is not the generated code's size. Measuring it honestly
  needs the call in a module of its own per fixture; do that with the
  speed tier, where code size against speed is the actual question.

## Why deferred

Needs fbs and serio as `tests/` dependencies, Blink and Zap binaries in
the toolchain, IDL twins of every fixture, and a mocked remote environment
for the two networking libraries; each is real work.

## How, briefly

1. ~~Restructure `tests/src/bench/` into `fixtures/`, `adapters/`, a size
   module, and `speed.spec.ts`; add `bench:size` (Lune) and `bench:speed`
   (`run-in-roblox`) tasks.~~ Landed, with `size.ts` as a plain function
   rather than a `.spec` suite: @rbxts/runit takes every ModuleScript whose
   name ends in `.spec`, and the size run returns rows for
   `scripts/lune-size-runner.luau` to write instead of asserting.
2. ~~Land the surge adapter, with the Lune size run writing
   `docs/benchmarks/size.md`.~~ Landed. fbs and serio come next (both plain
   functions, both `tests/` dependencies).
3. Add the Blink adapter (Lune-compiled definitions, mocked remotes), then
   Zap (mocked remote for size, `tooling` decoder for decode timing).
4. Add the hand-written baseline for the flat, nested, and `CFrame` rows.
5. Run the speed tier for the first time, and record
   `docs/benchmarks/speed.md`.
6. Tier 3 last, only if wire cost with batching becomes a question the
   serializer comparison cannot answer.
