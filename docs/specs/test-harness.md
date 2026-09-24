# Test harness specification

Status: current
Applies to: `@rbxts/surge` at commit `a551981`, `rbxts-transformer-surge` at
commit `925e701` (no tagged release yet)

## 1. Scope

This specifies how the correctness suites run: which suites exist and what
each covers, how the round-trip suite runs outside Roblox, the lines and exit
codes that carry a result, and what a run must rebuild first. The benchmark
tiers are in [benchmark-harness.md](benchmark-harness.md). What each step of
`mise run ci` checks, and how to write a suite, is in
[../testing.md](../testing.md).

## 2. Terms

- **Round-trip suite**: the `@rbxts/runit` suites under `tests/src/tests/`.
- **Golden checks**: the Node tests in `test/golden.test.mjs`.
- **Transformer tests**: the Jest suites in `rbxts-transformer-surge`'s
  `test/`.
- **Shim**: `tests/scripts/lune-roblox-shim.luau`.
- **Snapshot**: the packed copies of `@rbxts/surge` and
  `rbxts-transformer-surge` in `tests/node_modules/`.
- **Sentinel line**: a line of output with a fixed prefix that a script reads
  to learn a result.

## 3. The suites

**3.1** The transformer tests run in Node with no Luau involved, and cover
the walk, the emitter's output for each `Field` kind, the end-to-end
transform of a fixture program, and detection.

**3.2** The golden checks run in Node against the compiled Luau under
`tests/out/`, and one of them against this package's own `out/`. Each check
pins one decision about the shape of the emitted code, and none executes it.

**3.3** The round-trip suite executes the generated code: each fact encodes a
value and decodes it, and compares the result with the input as a whole
value. `tests/src/tests/bytes.spec.ts` also pins the exact bytes of every
encoding that is final.

**3.4** `tests/src/tests/` and `tests/src/bench/` are sibling roots. The
round-trip runner passes only `tests` to the test runner, so no benchmark
suite runs as part of the round-trip suite.

## 4. The round-trip suite under Lune

**4.1** `mise run tests:test` runs the round-trip suite under Lune through
`tests/scripts/lune-test-runner.luau`, loading the compiled place through the
shim. Roblox Studio is not involved.

**4.2** The shim replaces the global `require` so that requiring a fake
`Instance` resolves to the file it stands for, and delegates loading to
Lune's own `require`. It builds the fake tree eagerly at startup from
`tests/out`, `tests/include`, `tests/node_modules/@rbxts` and
`tests/node_modules/@flamework`, following the `$path` mappings of
`tests/default.project.json`.

**4.3** The shim binds as globals the Roblox datatypes the fixtures use,
from `@lune/roblox`, and provides stand-ins for what Lune lacks: a `DateTime`
with `UnixTimestampMillis` and `fromUnixTimestampMillis`, a `RunService` that
answers `IsRunning`, `IsClient`, `IsServer` and `IsStudio`, a `Players` with
no `LocalPlayer`, and a `BindableEvent` that dispatches. Every other service
is an inert stub.

**4.4** The shim resolves anything reachable through `TS.import` or
`require(Instance)` on a file under those roots. It does not resolve a
hand-written Luau package's own relative `require`.

**4.5** Lune does not provide `Random`, so a fuzz loop draws from the seeded
`Rng` in `tests/src/support.ts`. Because the `DateTime` stand-in reports as a
table, no fixture uses a `DateTime` as a union member, and because Lune's
enum database lacks members of every enum above 256 members, no fixture uses
one; the wide enum index is pinned at the transformer level instead.

## 5. Sentinel lines and exit codes

**5.1** A failing fact is caught inside `@rbxts/runit`, so Lune exits `0`
whatever the outcome. `main()` in `tests/src/index.ts` prints one sentinel
line, `RUNIT_RESULT: PASSED` or `RUNIT_RESULT: FAILED`, parsed from runit's
report.

**5.2** `main()` reports `FAILED` when no test ran, so an empty or
misconfigured suite root cannot pass.

**5.3** `tests/scripts/check-test-output.mjs` runs the Lune command, forwards
its output, and exits non-zero unless it sees `RUNIT_RESULT: PASSED`. It
stops the run and fails after `SURGE_TEST_TIMEOUT` seconds, 60 by default.

## 6. Rebuilding before a run

**6.1** The snapshot is a copy, not a link: `tests/.npmrc` sets
`install-links=true`. An edit to either package does not reach a run until
`npm run tests:install` copies it again.

**6.2** `npm run tests:install` deletes both snapshots and
`tests/out/tsconfig.tsbuildinfo` before installing, through
`tests/scripts/clear-stale-build.mjs`. Deleting the build info is required
because the transformer is a tsconfig plugin rather than an input file, so
an incremental `rbxtsc` with `tests/src/` unchanged would reuse the previous
transformer's output.

**6.3** The transformer's `npm run compile` deletes output that has no source
before it builds, so a renamed or moved transformer source leaves no stale
file in its `lib/` for the snapshot to copy.

## 7. Conformance

| Statement | Pinned by                                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 3.1       | `rbxts-transformer-surge` `test/`: `walk.test.ts`, `emit.test.ts`, `transform.test.ts`, `detect.test.ts`                     |
| 3.2       | `test/golden.test.mjs`                                                                                                       |
| 3.3       | `tests/src/tests/*.spec.ts`; `tests/src/tests/support.spec.ts` tests the whole-value comparison itself                       |
| 3.4       | Source: `main()` in `tests/src/index.ts` runs `script.tests` only                                                            |
| 4.1–4.4   | Source: `tests/scripts/lune-test-runner.luau` and `tests/scripts/lune-roblox-shim.luau`; every round-trip run exercises them |
| 4.5       | Source: `tests/src/support.ts`, the shim's `DateTime`, and the enum fixture in `tests/src/bench/fixtures/enum-heavy.ts`      |
| 5.1, 5.2  | Source: `main()` in `tests/src/index.ts`                                                                                     |
| 5.3       | Source: `tests/scripts/check-test-output.mjs`; `mise run ci` fails when a fact fails                                         |
| 6.1, 6.2  | Source: `tests/.npmrc` and `tests/scripts/clear-stale-build.mjs`                                                             |
| 6.3       | Source: `rbxts-transformer-surge` `scripts/clear-orphaned-output.mjs`                                                        |

## Changes

- `a551981` / `925e701`: first version, from Testing strategy and Round-trip
  tests run under Lune in `docs/testing.md`.
