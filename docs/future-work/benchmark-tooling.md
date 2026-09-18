# Future work: benchmark tooling for size and speed against fbs, serio, Blink, and Zap

Part of the [surge](../architecture.md) design. Replaces the earlier
benchmark-coverage note. The project's claims (Zap-level throughput,
faster than fbs) have no numbers behind them: the whole suite is one
never-run shape with no baseline. This is the plan for a harness that
measures **bandwidth** (bytes per value) and **speed** (values per second)
for surge and the four comparison libraries over one shared fixture
catalog. Library facts below are from source reading at the commits pinned
in [type-coverage-parity.md](type-coverage-parity.md); nothing was
executed against them yet.

## What

### Two metrics, three tiers

| Tier | Metric                            | Runs under                      | Why                                                                                                                                                              |
| ---- | --------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Buffer bytes + side-table entries | Lune (`mise run bench:size`)    | Deterministic; no Studio; Lune has `@lune/fs`, so the run writes its own results table. Doubles as a byte-regression gate.                                       |
| 2    | Encode and decode values/second   | Real Roblox via `run-in-roblox` | Per Benchmarking strategy in [testing.md](../testing.md), only the real engine's timings count.                                                                  |
| 3    | Wire cost (`Stats.DataSendKbps`)  | Real Roblox, client and server  | Optional. Blink's own benchmark method; the only tier that includes remote overhead and batching, so networking libraries and bare serializers meet on one axis. |

Tier 1 can be built any time; its numbers were only unstable before the
wire-format determinism fixes (literal/guardedUnion ordering, packed
padding, discriminant choice) and the enum index-width fix landed — see
Transformer Design §3 in [transformer.md](../transformer.md).

### One fixture catalog, one adapter per library

Fixtures are declared once, in TypeScript, as a shape plus a sample value
and a seeded generator, with explicit widths (`DataType.u8`, `f32`) and,
where the library supports it, explicit bounds, so size deltas reflect
format decisions rather than each library's defaults. Each library gets an
adapter with the same interface:

```ts
interface Adapter<T> {
	encode: (value: T) => { bytes: number; side: number; payload: unknown };
	decode: (payload: unknown) => T;
}
```

Rows (the testing.md list, plus Blink's two published benches so results
can be sanity-checked against its table):

- small flat struct; deeply nested object; large array and `Record`;
  string-heavy; enum-heavy (`Enum.KeyCode`); union-heavy (tagged and
  guarded); `Packed<T>` vs unpacked; `CFrame`-heavy (with and without
  aligned rotations); one deliberately large struct near the local
  ceiling (see
  [generated-code-performance.md](generated-code-performance.md));
- Blink's `Booleans` (1000 booleans) and `Entities` (100 structs of six
  `u8` fields), verbatim.

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
- Size: bytes of the returned buffer plus the count of side-table entries,
  per fixture, plus the ratio against surge.
- Also per fixture: round-trip error (max component error for floats,
  exact match otherwise) and generated Luau size (bytes and lines) for
  surge, since inlining trades code size for speed.
- Output: `docs/benchmarks/size.md` written by the Tier 1 run;
  `docs/benchmarks/speed.md` recorded by hand from the Tier 2 output with
  the machine, the date, and the commit of every library.

## Why deferred

Needs fbs and serio as `tests/` dependencies, Blink and Zap binaries in
the toolchain, IDL twins of every fixture, and a mocked remote environment
for the two networking libraries; each is real work, and the numbers are
only meaningful after the wire-format fixes.

## How, briefly

1. Restructure `tests/src/bench/` into `fixtures/`, `adapters/`,
   `size.spec.ts`, and `speed.spec.ts`; add `bench:size` (Lune) and
   `bench:speed` (`run-in-roblox`) tasks.
2. Land surge, fbs, and serio adapters first (all plain functions), with
   the Lune size run writing `docs/benchmarks/size.md`.
3. Add the Blink adapter (Lune-compiled definitions, mocked remotes), then
   Zap (mocked remote for size, `tooling` decoder for decode timing).
4. Add the hand-written baseline for the flat, nested, and `CFrame` rows.
5. Tier 3 last, only if wire cost with batching becomes a question the
   serializer comparison cannot answer.
