# surge: testing & verification strategy

Part of the [surge](architecture.md) design. Covers verification for the
whole stack, across both repositories (see Repository layout in
[architecture.md](architecture.md)): static checks (lint/format/spell/
compile/test) in each repo's own `mise run ci`, and the private `tests/`
project's `@rbxts/runit` suites, which depend on both `@rbxts/surge` and
`rbxts-transformer-surge`. The round-trip correctness suite
(`src/tests/*.spec.ts`) runs headlessly under **Lune** (a standalone Luau
runtime), as part of `mise run ci` — no Roblox Studio session needed. The
benchmark harness (`src/bench/`) is a separate root specifically so its
suite is never picked up by the Lune runner. It has two tiers: bytes per
value, which is deterministic and runs under Lune
(`mise run bench:size`, writing
[benchmarks/size.md](benchmarks/size.md)), and values per second, which
needs a real Roblox process driven either by Roblox Studio directly or by
`run-in-roblox` (`mise run bench:speed`, writing
[benchmarks/speed.md](benchmarks/speed.md)). Neither is part of
`mise run ci` — see Benchmarking strategy below.

## Static verification

Lint, format, and spelling conventions — and the exact ESLint/Prettier/
cspell configuration — are specified in
[coding-standards.md](coding-standards.md), once per repo. All three, plus
compilation and unit tests, run through `mise run ci` — separately in
`@rbxts/surge` (this repo) and in `rbxts-transformer-surge` (its own
repo), each against its own copy of the same five steps:

| Step    | Command                 | Checks                                                                                                                                                            |
| ------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint    | `mise run lint:check`   | ESLint rules and markdownlint (see [coding-standards.md](coding-standards.md)).                                                                                   |
| Format  | `mise run format:check` | Prettier formatting.                                                                                                                                              |
| Spell   | `mise run spell`        | Spelling in docs and other text files (cspell).                                                                                                                   |
| Compile | `mise run compile`      | TypeScript types and roblox-ts compilation, for that repo's own package.                                                                                          |
| Test    | `mise run test`         | This repo: golden-Luau checks against `tests/`'s compiled output, and one against this package's own. The transformer repo: its Jest unit-test suite (see below). |

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
fields in Wire format 10.2 in [specs/wire-format.md](specs/wire-format.md), which this
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
reasoning about whether it should work — is what
`tests/scripts/lune-roblox-shim.luau` now does, for
`lune-test-runner.luau` and `lune-size-runner.luau` alike. **Roblox Studio
no longer runs the round-trip suite at all** — only the benchmark speed
tier, which stays on Studio (or `run-in-roblox`) for a different reason:
see "No automated runtime CI for benchmarks" below.

### Round-trip tests run under Lune

The round-trip suite runs headlessly under Lune, through a shim that fakes
enough of the Roblox `Instance` surface for roblox-ts's module resolution to
work. What the shim provides, the sentinel line that carries the result, and
what a run must rebuild first are specified in
[specs/test-harness.md](specs/test-harness.md); how the shim works is in the
comments of `tests/scripts/lune-roblox-shim.luau`.

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
alongside Flamework's (confirmed compatible in [research/compile-time-specialization.md](research/compile-time-specialization.md))
is not a new risk, but _where_ in `tests/tsconfig.json`'s `plugins` array
it goes is a real decision, not a detail to skip — this transformer does
not read any Flamework-rewritten macro output, so running before
Flamework's transformer is the safer default, matching how `jecs` is
ordered here for the identical reason (see the comment in
`tests/tsconfig.json` itself).

The concrete plan for everything else:

- **Toolchain**: [`mise`](https://mise.jdx.dev), with the versions pinned in
  `mise.toml`: `node`, `rojo`, `lune` for the round-trip suite and the size
  tier, and `run-in-roblox` for the speed tier. `@rbxts/runit` depends on
  `rbxts-transformer-flamework`, so `tests/` carries `@flamework/core` and
  `rbxts-transformer-flamework` as devDependencies of its own; neither
  published package depends on them. `tests/` is a standalone npm project
  installed with `npm run tests:install` (see Repository layout in
  [architecture.md](architecture.md) for why). After editing either package,
  run `npm run tests:install` again before `npm run tests:compile`: section 6
  of [specs/test-harness.md](specs/test-harness.md) says why a plain install
  is not enough.
- **Transformer unit tests** and **golden checks**: what each covers is in
  section 3 of [specs/test-harness.md](specs/test-harness.md). The golden
  checks read `tests/out/`, so `tests/` must be built after a real
  `rbxts-transformer-surge` install, since it loads the transformer as a
  tsconfig plugin by package name.
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
  `Packed<T>` subtrees, `Record`/`Map`/`Set`), fixed cases plus at least
  one `@Fact` per shape that loops over many locally-generated random
  values (`runit` has no built-in property-based fuzzing or shrinking,
  unlike Lync's custom harness — an ordinary seeded loop inside the test
  method reproduces the same coverage without needing a new framework
  feature). One suite per area: `numbers`, `strings`, `collections`,
  `literals`, `unions`, `recursion`, `packed`, `roblox`, and `factories`,
  next to the older `basic` and `coverage` regression suites.
    - Fixed cases are a `@Theory` with `@InlineData` where the cases are
      plain values (numbers, strings, literals), and a `@Fact` over a list
      where a case is a table or a datatype, which a decorator argument
      cannot express well.
    - `tests/src/support.ts` (next to `bench/`, so that `src/tests/` holds
      suites only) holds `difference`, which compares two whole
      values and returns the path of the first difference, the seeded
      `Rng`, and `hex`. `difference` treats `NaN` as equal to `NaN` and `0`
      as different from `-0`, which `==` gets wrong for a round-trip
      check. Every fact of the suites above asserts
      `difference(value, result) === undefined` (`basic` and most of
      `coverage` still compare selected fields);
      `support.spec.ts` tests `difference` itself, because a `difference`
      that reports nothing would pass every other suite.
    - A generator produces values that survive their encoding exactly
      (`Rng.f32` for an `f32`, `Color3.fromRGB` for the 3×`u8` `Color3`),
      so the comparison stays exact. The one exception is a `CFrame` with
      a rotation, which is compared per component within `0.0001`.
    - `bytes.spec.ts` pins the exact bytes of shapes whose encoding is
      final. Each expected string is derived by hand from
      [specs/wire-format.md](specs/wire-format.md), not copied from the
      output, so it also checks that specification.
    - `@rbxts/repr` is pinned to `1.0.2` in `tests/package.json`. `1.0.3`
      changed its module to return `{ default = repr }`, and
      `@rbxts/runit` `1.4.8` calls the module itself when it formats the
      arguments of a `@Theory`, so every `@Theory` fails with `1.0.3`
      (`attempt to call a table value`).
- **Malformed-input scope**: per the no-bounds-checking default in
  section 4 of [specs/runtime-api.md](specs/runtime-api.md),
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
  `mise run ci` even though `mise run bench:speed` (via
  `run-in-roblox`, see below) can run it without a human clicking Play —
  `run-in-roblox` isn't a substitute for Lune's headless correctness gate
  here, since a benchmark run has no pass/fail signal to gate on, only
  numbers to read. Automating the recording/diffing of those numbers on
  every push is a separate, larger undertaking this design does not take
  on (see [future-work/headless-ci.md](future-work/headless-ci.md)).
  Benchmark numbers are only as current as the last person who actually
  ran them; round-trip correctness no longer has that limitation.

## Benchmarking strategy

Benchmarks run on real Roblox even though the round-trip suite runs under
Lune. Lune is a separate Luau build, so a timing measured under it is not
evidence of in-game throughput; a byte count is the same on any runtime, which
is why the size tier runs under Lune and the speed tier does not. The harness
— its catalog, the columns it compares, both tiers' protocols, and what each
results file records — is specified in
[specs/benchmark-harness.md](specs/benchmark-harness.md), and what it has
measured is under [research/](research/README.md).

Each comparison column answers its own question. fbs is the library surge is
a drop-in alternative to. serio is a second runtime schema interpreter, which
shows whether a difference against fbs is particular to fbs or common to
interpreting a schema at run time. Blink is an IDL compiler, the closest
published comparison to compile-time specialization. The hand-written baseline
writes surge's exact bytes, so its distance from surge is what the generated
code costs rather than a difference of format.

### Running the speed tier

`mise run bench:speed` needs Roblox Studio installed, and takes about ten
minutes: two runs of about four minutes each, back to back. `run-in-roblox`
runs the injected script as its own Script instance, so `script` resolves as
it does in a place; it does not simulate Play, so the place's own `MainServer`
and `MainBenchmarks` Scripts never run; and it completes without interaction
on a place that depends on `@flamework/core`. The rows reach the terminal as
they are measured, because the suite yields and the plugin flushes its output
on `Heartbeat`.

### Reading a scoped run

`mise run bench:size:only large-array` and `mise run bench:speed:only cframe`
measure only the rows their patterns select. A pattern is one word, because a
mise task argument does not reliably keep its quoting on Windows. The size
tier is the cheap place to confirm a pattern selects what you meant, since the
speed tier only finds out after the place is built and Studio is up.

A scoped size table can be read against
[benchmarks/size.md](benchmarks/size.md) directly, because a byte count is the
same on every run. A scoped speed table cannot: a column is read against the
other columns of the same run, and a scoped run is a run of its own, so read
one against another scoped run of the same patterns. Two separate runs of
unchanged code can still disagree by a quarter on a single cell
([research/noise-in-the-speed-tier.md](research/noise-in-the-speed-tier.md)),
so read medians over many cells, with the untouched columns as the control.
