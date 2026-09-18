# surge: testing & verification strategy

Part of the [surge](architecture.md) design. Covers verification for the
whole stack, across both repositories (see Repository layout in
[architecture.md](architecture.md)): static checks (lint/format/spell/
compile/test) in each repo's own `mise run ci`, and the private `tests/`
project's `@rbxts/runit` suites, which depend on both `@rbxts/surge` and
`rbxts-transformer-surge`. The round-trip correctness suite
(`src/tests/*.spec.ts`) runs headlessly under **Lune** (a standalone Luau
runtime), as part of `mise run ci` — no Roblox Studio session needed. The
benchmark suite (`src/bench/*.bench.spec.ts`) is a separate root
specifically so it's never picked up by the Lune runner; it still needs a
real Roblox process, driven either by Roblox Studio directly or by
`run-in-roblox` (`mise run tests:benchmark`), and is not part of
`mise run ci` — see Benchmarking strategy below.

## Static verification

Lint, format, and spelling conventions — and the exact ESLint/Prettier/
cspell configuration — are specified in
[coding-standards.md](coding-standards.md), once per repo. All three, plus
compilation and unit tests, run through `mise run ci` — separately in
`@rbxts/surge` (this repo) and in `rbxts-transformer-surge` (its own
repo), each against its own copy of the same five steps:

| Step    | Command                 | Checks                                                                                                                        |
| ------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Lint    | `mise run lint:check`   | ESLint rules and markdownlint (see [coding-standards.md](coding-standards.md)).                                               |
| Format  | `mise run format:check` | Prettier formatting.                                                                                                          |
| Spell   | `mise run spell`        | Spelling in docs and other text files (cspell).                                                                               |
| Compile | `mise run compile`      | TypeScript types and roblox-ts compilation, for that repo's own package.                                                      |
| Test    | `mise run test`         | This repo: golden-Luau checks against `tests/`'s compiled output. The transformer repo: its Jest unit-test suite (see below). |

This runs in order and stops at the first failure, matching an
established roblox-ts starter template's own `mise run ci` task,
extended by the `test` step. In this repo, `ci`
also runs three more steps: `tests:install`, `tests:compile`, and
`tests:test` — installing and compiling `tests/` against a real
`rbxts-transformer-surge` build, then actually running the `@rbxts/runit`
round-trip suite headlessly under Lune (see "Round-trip
tests run under Lune" below) — before the golden-Luau checks in `test`
read that same compiled output. `tests:install` specifically runs
_before_ `lint:check`, not after `compile` like the other two: ESLint
resolves `tests/`'s own `@rbxts/*` imports against `tests/node_modules`,
which doesn't exist yet on a fresh checkout — confirmed by reproducing
the resulting lint failure in a from-scratch sibling checkout before
fixing the order. The transformer repo's `test` step has no such
dependency, since its unit tests operate purely on the TypeScript
compiler API, no compiled `.luau` involved.

None of this — lint/format/spell/compile/test, nor the round-trip suite —
needs Roblox Studio anymore; all of it runs headlessly, which is exactly
what each repo's `.github/workflows/ci.yml` runs automatically on every
push/PR (`ubuntu-latest`, via `jdx/mise-action`) — the same steps as
`mise run ci`, so each repo reports independently, matching the
template's own workflow (extended by the steps it doesn't have). Only the
**benchmark** suite still needs a real Roblox process (Studio, or
`run-in-roblox`) — see "No automated runtime CI for benchmarks" below —
so it stays out of both `mise run ci` and the GitHub Actions workflow.

This repo's workflow checks out `rbxts-transformer-surge` as a sibling
directory (`actions/checkout`'s `path:` input, alongside this repo's own
checkout — not a submodule), then runs `npm install` in each repo before
`tests:install`: `tests/`'s `file:` dependencies on both packages (see
Toolchain below) each run that package's own `prepare` script during
install, which needs that package's own devDependencies already present.
All of this was verified against a genuinely fresh checkout — a real
sibling clone with no pre-existing `node_modules` anywhere — not just
assumed from a local machine that already had everything installed;
that's what caught both this and the `tests:install`-before-`lint:check`
ordering issue above, neither of which was visible from a working local
checkout that had already run `npm install` at some point in the past.
The transformer repo's own workflow needs none of this, since it never
depends on `@rbxts/surge` at runtime (see Package boundaries in
[coding-standards.md](coding-standards.md)).

An opt-in git pre-push hook (`.githooks/pre-push`, installed once with
`mise run hooks:install`, which points `core.hooksPath` at `.githooks`)
runs `mise run ci` locally before every push and blocks it on failure —
the same mechanism the template uses, for contributors who push before
GitHub Actions would catch a failure; VS Code users can instead run the
`mise: ci` task directly (`.vscode/tasks.json`, with a Windows shell
override to Git Bash since mise tasks assume a POSIX shell).

## Testing strategy

fbs itself ships with **no automated tests and no benchmarks at all**
(confirmed: its repository has only a `src` directory — no `test`/`bench`
folder of any kind). That absence is exactly the risk this design cannot
inherit: every field kind here is produced by a transformer walking a type
and emitting two hand-written statement sequences (serialize, deserialize)
that must stay in agreement with each other, per shape — whatever
`serialize()` writes, `deserialize()` must read back correctly — with no
runtime schema to fall back on if they drift. (This is a different claim
from the byte-_equality_-across-calls property discussed for `dict`
fields in Type Coverage in [transformer.md](transformer.md), which this
design explicitly does not guarantee.)

An earlier version of this section proposed a Lune-headless harness
modeled on `Axp3cter/Lync`, then rejected it: compiled `rbxtsc` output
requires `game`/`script` and a `TS.import(...)`/`require(Instance)`
module-resolution mechanism that doesn't exist under Lune out of the box,
and building a shim for it was judged "a real, unresolved engineering
problem, not a proven pipeline." That conclusion has since been reversed,
on real evidence: a Lune test runner that fakes just enough of the
Roblox Instance surface for `TS.import`/`require(Instance)` to resolve
against real files on disk had already solved exactly this problem in
another project, and adapting that same approach here — confirmed by actually
running the real round-trip suite headlessly under Lune, not just by
reasoning about whether it should work — is what `tests/scripts/lune-test-runner.luau`
now does. **Roblox Studio no longer runs the round-trip suite at all** —
only the benchmark suite, which stays on Studio (or `run-in-roblox`) for a
different reason: see "No automated runtime CI for benchmarks" below.

### Round-trip tests run under Lune

The mechanism, in short (full detail and rationale live as comments in
the runner file itself):

- **The core problem**: Lune's own `require()` only accepts a string
  path — confirmed directly, not assumed, by calling it with a real
  `ModuleScript` Instance deserialized via `@lune/roblox` and getting
  `bad argument #1 to 'require' (string expected, got userdata)`. Real
  Roblox's `require(moduleScriptInstance)` is an engine-level primitive
  Lune doesn't reimplement.
- **The fix**: override the global `require` to detect a "fake Instance"
  (a plain table with a recognizable metatable), translate its captured
  on-disk path into a string, and delegate to Lune's own native
  `require(path)` for the actual loading/caching/relative-resolution —
  `TS.import`/`RuntimeLib.lua` itself is never touched. This is far less
  code than reimplementing module loading, and it means Lune's own
  require semantics (including per-path caching) are reused as-is.
- **Building the fake tree**: eagerly `fs.readDir`-scan real output
  directories (`tests/out`, `tests/include`,
  `tests/node_modules/@rbxts`, `tests/node_modules/@flamework`) at
  startup, hand-mirroring `default.project.json`'s `$path` mappings —
  not derived from a sourcemap or a built `.rbxl`. Scanning must happen
  eagerly, never lazily inside `__index`: Lune's `fs` functions yield
  internally, and Luau forbids yielding across a metamethod boundary.
- **Datatype globals**: `Vector3`/`CFrame`/`Color3`/`Enum` are bound as
  bare globals from `@lune/roblox`'s namespaced equivalents
  (`(roblox :: any).Vector3`, etc. — the `:: any` cast works around
  Lune 0.10.5's `@lune/roblox` type definitions omitting these
  constructors even though they exist at runtime). `buffer` needs no
  shim; it's a native Luau global Lune ships without help. Add the same
  pattern for any datatype a future fixture needs that isn't listed here
  (`ColorSequence`, `NumberSequence`, ...).
- **Service stubs**: most services auto-vivify as inert stubs the first
  time `GetService` is asked for them. `RunService` gets a real stub
  (`IsRunning`/`IsClient`/`IsServer`/`IsStudio`/a dead `Heartbeat.Connect`)
  because `@flamework/core` (which `@rbxts/runit` depends on) calls these
  directly at module load, not just checks they exist; `Players` gets
  `LocalPlayer = nil`. `Instance.new` supports only `"BindableEvent"`,
  with real `Connect`/`Fire` dispatch — `@flamework/core`'s `Modding`
  module constructs one via `@rbxts/signal` unconditionally at module
  load, and needs it to actually work, not just exist.
- **Two separate roots, not one**: `src/tests/*.spec.ts` (correctness)
  and `src/bench/*.bench.spec.ts` (benchmarks) are siblings, not nested —
  `src/index.ts`'s `main()` only ever passes `script.tests` to
  `TestRunner`, so the benchmark suite is structurally excluded from the
  Lune runner rather than filtered out by convention (a benchmark
  suite's `@Fact`s don't assert anything meaningful for a pass/fail
  gate, and their iteration counts would slow down every `mise run ci`
  run for no benefit).
- **The pass/fail signal**: a failing `@Fact` is caught inside `runit`'s
  own `TestRunner`, so the Lune process always exits `0` regardless of
  outcome — `main()`'s reporter parses `runit`'s printed report
  (`Ran N tests...` / `Passed: N` / `Failed: N`) into a `RUNIT_RESULT:`
  sentinel line, and `tests/scripts/check-test-output.mjs` (invoked as
  `node scripts/check-test-output.mjs lune run scripts/lune-test-runner.luau`)
  scrapes that line into a real process exit code, plus a watchdog
  timeout (`SURGE_TEST_TIMEOUT`, default 60s) in case a suite hangs.
  `main()` explicitly checks that more than zero tests ran, not just
  that zero failed — a broken mount (an empty or misconfigured `tests`
  folder) would otherwise report `Ran 0 tests` / `Failed: 0` and the
  sentinel would read as a silent, false-positive `PASSED`.
- **Known boundary**: this covers anything reachable through
  `TS.import`/`require(Instance)` on files that exist on disk under the
  mounted folders — which is all roblox-ts-compiled output, first- or
  third-party — but not arbitrary hand-written Luau packages with their
  own relative-`require("./x")` conventions, since Lune's native
  relative-require resolution doesn't replicate Rojo/Roblox
  Instance-tree semantics the same way. None of this project's current
  dependencies hit that case (`@rbxts/services` and `@rbxts/signal` are
  hand-written but only ever call `game:GetService(...)`/`Instance.new`,
  never a relative `require`), but a future dependency might.

`@rbxts/runit` itself is the same xUnit-style framework (`@Fact`,
`@Theory`, `@InlineData`, `Assert`) already used by an established
roblox-ts starter template (a real, already-maintained roblox-ts
project that depends on `@rbxts/flamework-binary-serializer` today),
which is also direct evidence that multiple type-walking transformers
already coexist in this exact ecosystem, and that their order matters:
its `tsconfig.json`
registers `rbxts-transformer-jecs` _before_ `rbxts-transformer-flamework`,
with an explicit comment — "jecs must run before flamework: flamework
rewrites macros (e.g. runit's `Assert`) into synthetic AST nodes that the
jecs transformer cannot read." Registering this project's own transformer
alongside Flamework's (confirmed compatible in [transformer.md](transformer.md))
is not a new risk, but _where_ in `tests/tsconfig.json`'s `plugins` array
it goes is a real decision, not a detail to skip — this transformer does
not read any Flamework-rewritten macro output, so running before
Flamework's transformer is the safer default, matching how `jecs` is
ordered here for the identical reason (see the comment in
`tests/tsconfig.json` itself).

The concrete plan for everything else:

- **Toolchain**: [`mise`](https://mise.jdx.dev), matching the template's
  own `mise.toml` closely — `node` and `rojo` pinned the same way, plus
  `lune` (`github:lune-org/lune`, not the deprecated `ubi:` backend) for
  the round-trip suite above, and `run-in-roblox` for the benchmark suite
  (see "Running benchmarks via run-in-roblox" below):

    ```toml
    [tools]
    node = "24.18.0"
    "github:rojo-rbx/rojo" = "7.7.0-rc.1"
    "github:lune-org/lune" = "0.10.5"
    "github:rojo-rbx/run-in-roblox" = "0.3.0"
    ```

    One dependency this pulls in that the _shipped_
    `@rbxts/surge`/`rbxts-transformer-surge` packages otherwise wouldn't
    need: `@rbxts/runit`'s README states it "Depends on
    `rbxts-transformer-flamework`", so the `tests/` project needs
    `@flamework/core` and `rbxts-transformer-flamework` as devDependencies
    purely to run the test suite, mapped into `ReplicatedStorage` the same
    way the template's own `default.project.json` already does — these
    stay scoped to `tests/`'s own `package.json`, not either published
    package's dependency list. `tests/` is not an npm workspace member of
    this repo — it's its own standalone project with its own
    `node_modules`, installed with `npm run tests:install` from the repo
    root (a thin `--prefix tests` wrapper) — see Repository layout in
    [architecture.md](architecture.md) for why. `tests/.npmrc` sets
    `install-links=true` so its `file:` dependencies on `@rbxts/surge` and
    `rbxts-transformer-surge` are packed and copied, not symlinked (see
    architecture.md for why a symlink would cycle) — which means
    `tests/node_modules/` holds a **snapshot**, not a live view: after
    editing this package's `src/` or the transformer's source, rerun
    `npm run tests:install` before `npm run tests:compile` (or
    `mise run tests:compile:watch`, which watches `tests/src/` only, never
    the dependency snapshot) to pick the change up.

- **Transformer unit tests** live in `rbxts-transformer-surge`'s own
  `test/` and run in plain Node/Jest, no Luau or Roblox involved — the
  transformer is ordinary code operating on the TypeScript compiler API.
  These cover: type-walk classification (does a given TS type produce the
  expected `Field` IR), property name-sort determinism across
  differently-constructed equivalent types (the fix for fbs's issue #16 —
  exactly the kind of regression a unit test catches cheaply), and
  diagnostic behavior for rejected inputs (ambiguous multi-object unions
  before that phase ships, `Record<SomeUnion, V>`, etc.).
- **Golden/invariant tests on the generated Luau itself** live in _this_
  repo's `test/` instead (they used to sit alongside the transformer's own
  unit tests, before the two-repo split — the fixtures they read,
  `tests/out/`, are only ever produced in this repo) and run in plain Node
  (`node:test`, no extra dependency) — no execution needed, only reading
  the compiled `.luau` text: for a curated set of representative shapes,
  assert the emitted function body contains no shape-based branching (no
  `if kind ==`-style dispatch reappearing) and no recursive call into a
  shared generic serializer for a non-recursive type — the specific,
  falsifiable claim this whole design rests on, checked as an automated
  regression rather than only a one-time manual read of the output (as the
  initial spike did). This requires `tests/`'s own build to run _after_ a
  real `rbxts-transformer-surge` install (whatever repo it's coming from —
  a sibling checkout locally, `github:` otherwise), since `tests/` loads
  it as a `tsconfig.json` plugin by package name, not by source — a
  step-0 build-order constraint, not just a convenience.
- **Round-trip tests**, the primary correctness technique for generated
  code, are `@rbxts/runit` suites in the `tests/` project, under
  `src/tests/*.spec.ts`, depending on both `@rbxts/surge` and
  `rbxts-transformer-surge` (as `file:..` and
  `file:../../rbxts-transformer-surge` respectively for local development
  against a sibling checkout — see Repository layout in
  [architecture.md](architecture.md)) and run headlessly under Lune (see
  "Round-trip tests run under Lune" above) as part of `mise run ci`: for
  each supported `Field` kind and representative combination
  (nested objects, arrays of unions, optional chains, recursive types,
  `Packed<T>` subtrees, `Record`/`Map`/`Set`), a `@Theory` with
  `@InlineData`-provided fixed cases plus at least one `@Fact` per shape
  that loops over many locally-generated random values (`runit` has no
  built-in property-based fuzzing or shrinking, unlike Lync's custom
  harness — an ordinary seeded loop inside the test method reproduces the
  same coverage without needing a new framework feature), asserting
  `Assert.equal` between the original and the round-tripped value.
- **Malformed-input scope**: per the no-bounds-checking decision in
  Transformer Design §7 in [transformer.md](transformer.md),
  `deserialize()` has unspecified behavior on malformed input — so these
  tests only need to cover `deserialize(serialize(x))` round-trips, not
  arbitrary malformed buffers, and a fuzz-style test finding a crash on a
  _malformed_ buffer is not, by itself, a bug report.
- **No automated runtime CI for benchmarks**, unlike the template's
  documented limitation, which used to cover both suites here too:
  `mise run ci` (see Static verification above) now runs the round-trip
  suite headlessly on every push, via Lune — that part of the template's
  limitation ("`mise run ci` compiles the test code but does not execute
  the runtime suite — running tests requires Roblox Studio") no longer
  applies to this project. It still applies to the **benchmark** suite,
  deliberately: it measures real Roblox performance, not just
  correctness (see Benchmarking strategy below), so it stays out of
  `mise run ci` even though `mise run tests:benchmark` (via
  `run-in-roblox`, see below) can run it without a human clicking Play —
  `run-in-roblox` isn't a substitute for Lune's headless correctness gate
  here, since a benchmark run has no pass/fail signal to gate on, only
  numbers to read. Automating the recording/diffing of those numbers on
  every push is a separate, larger undertaking this design does not take
  on (see [future-work/headless-ci.md](future-work/headless-ci.md)).
  Benchmark numbers are only as current as the last person who actually
  ran them; round-trip correctness no longer has that limitation.

## Benchmarking strategy

Benchmarks stay on real Roblox (Studio, or `run-in-roblox`) even though
the round-trip suite now runs under Lune — deliberately, not because
compiled output can't run there (it can, per above). Lune is a separate
Luau implementation/VM build from Roblox's own engine; `os.clock()`
timings measured under it are not evidence of real in-game throughput,
only of correctness. A benchmark number this design publishes has to come
from the actual engine it claims to be fast on. Zap is, at minimum, not
straightforwardly usable as a runnable baseline either way: its event-level
`irgen`-produced writes target a module-global `outgoing_buff`/
`outgoing_apos`, and the public surface for those is `Fire`/`FireAll`/`On`
wired to real `RemoteEvent` instances at module load, not a callable
`Zap.encode(shape, value)`. **Unconfirmed either way**: Zap's `.zap` DSL
also supports named, reusable `type` declarations, which Zap compiles to
their own shared function (`push_tydecl`) specifically so they can be
referenced from multiple events — it's plausible those are exposed as
directly-callable pure encode/decode functions in Zap's generated output
for at least that case, which would make a real Zap baseline possible for
`type`-declared shapes. This wasn't verified in either direction (prior
research on Zap's output module structure was inconclusive), so it isn't
assumed here — but it's worth a direct check before fully committing to
two baselines instead of three.

This design benchmarks inside real Roblox — Studio, via the `tests`
place, or `run-in-roblox` (`mise run tests:benchmark`) for an
automatable-but-still-real-engine run — using `os.clock()` around many
iterations, reported through the same runner output `@rbxts/runit`
already prints to. Against two baselines, not three:

1. **fbs**, via `createBinarySerializer<T>()` for the identical shape —
   the actual comparison this whole project is justified by.
2. **A hand-written, non-generated "ideal" flat serializer** for a subset
   of shapes — a manually written straight-line function doing the same
   writes with no transformer involved. This measures whether the
   transformer's emitted code actually reaches the flatness it claims, or
   introduces avoidable overhead (extra temporaries, an unnecessary
   function layer) beyond what the shape structurally requires — a check
   the fbs comparison alone cannot catch. For shapes expressible in Zap's
   schema DSL too, this same hand-written baseline can be built by
   transcribing the flat write/read statement sequence Zap's `irgen` would
   produce for that shape (extracted and re-hosted by hand, not a runnable
   Zap artifact) — the closest honest stand-in for "how Zap would do it,"
   without claiming to run Zap itself.

Representative shapes (a small flat struct, a deeply nested object, a
large array/`Record`, a string-heavy shape, an enum-heavy shape — the
concrete case where this design's O(1) lookup should beat fbs's `indexOf`
scan — a union-heavy shape, a `Packed<T>` vs. unpacked variant, and one
deliberately large shape to exercise the Luau function-size risk in
practice) live as their own `@rbxts/runit` suite, separate from the
correctness suites, so a benchmark failing to compile/run is never
confused with a behavioral regression.

### Running benchmarks via run-in-roblox

`mise run tests:benchmark` builds the `tests` place (`rojo build`) and
runs it through [`run-in-roblox`](https://github.com/rojo-rbx/run-in-roblox)
with `tests/scripts/run-in-roblox-benchmarks.luau` as the injected script
(`tests/scripts/ensure-dist.mjs` creates `dist/` first, since it's
gitignored and `rojo build` doesn't create its own output directory).
Confirmed empirically, not assumed:

- `run-in-roblox --script` runs the given file as its own real Script
  instance (`script` resolves to it, unlike the Studio command bar, where
  `script` is nil) — so `require(tests):runBenchmarks()` works exactly as
  it does from the disabled `MainBenchmarks` Script (see "Round-trip
  tests run under Lune" above for the same `script`-is-nil pitfall this
  avoids).
- It does not simulate Play: `ServerScriptService`'s `MainServer` and
  `MainBenchmarks` Scripts never fire on their own, only the explicitly
  injected script runs. There is exactly one thing running per invocation.
- It loads a place depending on `@flamework/core`/
  `rbxts-transformer-flamework` (the same dependency `@rbxts/runit`
  itself has) and completes on its own, without requiring interaction,
  which is what makes it usable from a task instead of only from a human
  pressing Play.

This is a different mechanism from the Lune runner above, not a
replacement for it: `run-in-roblox` drives the actual Roblox engine, so
its timings are real, but a benchmark run has no pass/fail signal —
`tests/scripts/run-in-roblox-benchmarks.luau` has no equivalent of the
Lune runner's `RUNIT_RESULT:` sentinel, and `mise run tests:benchmark` is
deliberately not part of `mise run ci` (see "No automated runtime CI for
benchmarks" above). Read the printed throughput numbers from its output
and record them by hand, the same as a Studio-based run.

**Recording results is not automated in this design**, unlike Lync's
committed-and-diffed baseline (straightforward for Lync since its
`lune run` scripts have ordinary filesystem access to write a report file
on every run). Results here are read from the runner's printed output and
recorded by hand (e.g. in a checked-in benchmark log) after a deliberate
benchmarking pass, not on every change. Automating this further is a
possible future improvement, not something this design depends on — the
obvious route, if it's ever wanted, is `HttpService` to a local collector
script, since the `tests` place already enables `HttpEnabled` for the
template this design follows.

**Metrics per row**: throughput (values/sec) for serialize and
deserialize separately, and generated Luau size (line/byte count) — size
matters here specifically because full inlining trades code size for
speed, and the one large-shape row exists to make that trade-off, and the
Luau function-size risk (see Risks in [transformer.md](transformer.md)),
visible in real numbers instead of only discussed. Because this all runs
inside real Roblox (not Lune), these numbers are already the real, final
production numbers — there is no separate "validate against real Roblox"
pass needed, unlike the Lune-based approach this section replaced.
