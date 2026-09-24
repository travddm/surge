# Test harness specification

Status: current
Applies to: `@rbxts/surge` at commit `8c4d5f5`, `rbxts-transformer-surge` at
commit `87813e5` (no tagged release yet)

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

**3.3** The round-trip suite executes the generated code. A round-trip fact
encodes a value, decodes it, and compares the result with the input as a
whole value through `difference` in `tests/src/support.ts`. These facts
compare otherwise:

- `basic.spec.ts` and part of `coverage.spec.ts` compare selected fields.
- A `CFrame` with a rotation is compared per component, within a tolerance.
- Part of `checks.spec.ts` decodes hand-written payloads that no `serialize`
  writes, and asserts what the read accepts or rejects.
- `support.spec.ts` tests `difference` itself.

**3.4** `tests/src/tests/` and `tests/src/bench/` are sibling roots. The
round-trip runner passes only `tests` to the test runner, so no benchmark
suite runs as part of the round-trip suite.

**3.5** `tests/src/tests/bytes.spec.ts` pins the exact bytes of shapes whose
encoding is final: each fact compares an encoding with a fixed expected
string. It does not pin a union with an enum member.

## 4. The round-trip suite under Lune

**4.1** `mise run tests:test` runs the round-trip suite under Lune through
`tests/scripts/lune-test-runner.luau`, loading the compiled place through the
shim. Roblox Studio is not involved.

**4.2** The shim replaces the global `require` so that requiring a fake
`Instance` resolves to the file it stands for, and delegates loading to
Lune's own `require`. It builds the fake tree eagerly at startup from
`tests/out`, `tests/include`, `tests/node_modules/@rbxts` and
`tests/node_modules/@flamework`. The tree mirrors the `$path` mappings of
`tests/default.project.json` in the shim's own code; the shim does not read
that file.

**4.3** The shim binds as globals the Roblox datatypes the fixtures use,
from `@lune/roblox`, and `task`, from `@lune/task`. It provides stand-ins for
what Lune lacks:

- a `DateTime` with `UnixTimestampMillis` and `fromUnixTimestampMillis`;
- a `RunService` that answers `true` to `IsRunning` and `IsServer`, and
  `false` to `IsClient` and `IsStudio`, with a `Heartbeat` that never fires;
- a `Players` with no `LocalPlayer`, whose `PlayerRemoving` never fires;
- an `Instance.new` that returns a `BindableEvent` that dispatches, and a
  Lune instance for any other class.

`GetService` returns an inert stub for a service the shim does not build.

**4.4** The shim resolves `TS.import` and `require(Instance)` for any file
under those roots. It passes any other argument to Lune's own `require`
unchanged, so a hand-written Luau package's own relative `require` is not
resolved against that package's directory.

**4.5** Lune does not provide `Random`, so a fuzz loop draws from the seeded
`Rng` in `tests/src/support.ts`. Because the `DateTime` stand-in reports as a
table, no fixture uses a `DateTime` as a union member, and because Lune's
enum database lacks members of every enum above 256 members, no fixture uses
one; the wide enum index is pinned at the transformer level instead.

**4.6** The shim creates, in `ReplicatedStorage`, the remotes the generated
Blink and Zap server modules look up when they are required:
`BLINK_RELIABLE_REMOTE`, `BLINK_UNRELIABLE_REMOTE`, and `ZAP_RELIABLE` in a
`ZAP` folder. Each records what it is fired with as `LastSend`, and delivers
no event.

## 5. Sentinel lines and exit codes

**5.1** A failing fact is caught inside `@rbxts/runit`, so it does not change
Lune's exit code. `main()` in `tests/src/index.ts` prints one sentinel line
with the verdict it parses from runit's report: `RUNIT_RESULT: PASSED`,
`RUNIT_RESULT: FAILED`, or `RUNIT_RESULT: ERROR (<reason>)` when the report
cannot be parsed, no test ran, or the runner throws.

**5.2** `main()` reports `ERROR (no suites ran)` when no test ran, so an
empty or misconfigured suite root cannot pass.

**5.3** `tests/scripts/check-test-output.mjs` runs the Lune command and
forwards its output. It exits non-zero unless the Lune command exits `0` and
the last sentinel line it printed is `RUNIT_RESULT: PASSED`.

**5.4** `check-test-output.mjs` kills the Lune command and exits non-zero
when the command has not exited `SURGE_TEST_TIMEOUT` seconds plus a fixed 10
seconds after it started. `SURGE_TEST_TIMEOUT` is 60 by default. A value that
is not a positive whole number stops the script with exit code 2 before the
command runs.

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

| Statement | Pinned by                                                                                                                                                                                                                                                                                                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1       | `rbxts-transformer-surge` `test/`: `walk.test.ts`, `emit.test.ts`, `transform.test.ts`, `detect.test.ts`                                                                                                                                                                                                                                                                                              |
| 3.2       | `test/golden.test.mjs`                                                                                                                                                                                                                                                                                                                                                                                |
| 3.3       | `tests/src/tests/*.spec.ts`; `tests/src/tests/support.spec.ts` tests the whole-value comparison itself. The exceptions: `basic.spec.ts`, `coverage.spec.ts`, the `CFrame` comparisons in `roblox.spec.ts` and `packed.spec.ts`, and `checks.spec.ts`                                                                                                                                                  |
| 3.4       | Source: `main()` in `tests/src/index.ts` runs only `script.WaitForChild("tests")`                                                                                                                                                                                                                                                                                                                     |
| 3.5       | `tests/src/tests/bytes.spec.ts`. Unverified: that every encoding [wire-format.md](wire-format.md) treats as final has a fact there                                                                                                                                                                                                                                                                    |
| 4.1–4.3   | Source: `tests/scripts/lune-test-runner.luau` and `tests/scripts/lune-roblox-shim.luau`; every round-trip run exercises them                                                                                                                                                                                                                                                                          |
| 4.4       | Source: `requireInstance` in `tests/scripts/lune-roblox-shim.luau`. Unverified: that a relative `require` is not resolved; no module under those roots calls `require` with a path                                                                                                                                                                                                                    |
| 4.5       | Source: `Rng` in `tests/src/support.ts` and the shim's `DateTime`; `tests/src/tests/roblox.spec.ts` and `bytes.spec.ts` use `DateTime` only outside a union, and the comment above `CoverageTest` in `tests/src/tests/coverage.spec.ts` records the missing enum members. `rbxts-transformer-surge` `test/emit.test.ts`: "an enum with more than 256 members uses a 2-byte index" pins the wide index |
| 4.6       | Source: `newRemote` in `tests/scripts/lune-roblox-shim.luau`; every `mise run bench:size` exercises the Zap remote                                                                                                                                                                                                                                                                                    |
| 5.1, 5.2  | Source: `summarize` and `run` in `tests/src/index.ts`                                                                                                                                                                                                                                                                                                                                                 |
| 5.3       | Source: `tests/scripts/check-test-output.mjs`; `mise run ci` fails when a fact fails                                                                                                                                                                                                                                                                                                                  |
| 5.4       | Source: `readTimeoutSeconds` and the watchdog in `tests/scripts/check-test-output.mjs`                                                                                                                                                                                                                                                                                                                |
| 6.1, 6.2  | Source: `tests/.npmrc` and `tests/scripts/clear-stale-build.mjs`                                                                                                                                                                                                                                                                                                                                      |
| 6.3       | Source: `rbxts-transformer-surge` `scripts/clear-orphaned-output.mjs`                                                                                                                                                                                                                                                                                                                                 |

## Changes

- `8c4d5f5` / `87813e5`: corrected against the code: 3.3 (not every fact
  compares a whole value), 4.2, 4.3, 4.4, 5.1 and 5.2 (the `ERROR` verdict),
  5.3; added 3.5 (moved from 3.3), 4.6, and 5.4 (the timeout, moved from
  5.3); Conformance for 3.3, 3.5, 4.4–4.6, 5.1, 5.2 and 5.4.
- `cb96dc9` / `925e701`: the Conformance row for 3.4 names
  `script.WaitForChild("tests")`.
- `a551981` / `925e701`: first version, from Testing strategy and Round-trip
  tests run under Lune in `docs/testing.md`.
