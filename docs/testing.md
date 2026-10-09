# Testing

`mise run ci` at the repository root runs every check a change must pass:
the root files', then the transformer's, then surge's.

```sh
mise run lint:fix && mise run format:fix && mise run ci
```

The round-trip suite runs headlessly under Lune as part of it. Only the
benchmark speed tier needs Roblox Studio, and it is not part of `ci`.

## Static checks

`mise run ci` stops at the first step that fails:

| Step            | Where               | Catches                                                         | To fix                                                                                         |
| --------------- | ------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `tests:install` | surge               | a `tests/` install that cannot resolve either package           | `mise run setup` at the root, which installs the transformer's own dependencies first          |
| `lint:check`    | root, both packages | an ESLint rule or a markdownlint rule                           | `mise run lint:fix`, then fix what it cannot                                                   |
| `format:check`  | root, both packages | Prettier formatting                                             | `mise run format:fix`                                                                          |
| `spell`         | root, both packages | a word cspell does not know, in docs or the last commit message | correct it, or add a real word to the `cspell.json` beside the file; the root's covers `docs/` |
| `compile`       | both packages       | a type error, or roblox-ts refusing the runtime package         | the compiler's message                                                                         |
| `tests:compile` | surge               | a type error in a suite, or in code the transformer generated   | a transformer defect if the error is in generated code                                         |
| `tests:test`    | surge               | a failing round-trip fact                                       | the fact's message names the path of the first difference                                      |
| `test`          | both packages       | a failing golden check, or a failing transformer unit test      | the test's message; a snapshot change is reviewed, then `npx jest -u`                          |

`tests:install` runs first because ESLint resolves `tests/`'s imports against
`tests/node_modules`, which a fresh checkout does not have.

`format:check`, `format:fix` and `spell` record the files that passed in
each project's `node_modules/.cache/`, and check a file again only when the
file, Prettier's options or the `cspell.json` changes. Prettier's record
does not include its plugins' versions: after an update to
`@trivago/prettier-plugin-sort-imports`, delete
`node_modules/.cache/prettier` in each package, or `format:check` can pass a
file the new version would reorder.

## Runtime tests

- **Round-trip suite** (surge, `mise run tests:test`): the `@rbxts/runit`
  suites under `tests/src/tests/`, compiled through the real transformer and
  run under Lune through a shim that fakes enough of Roblox's `Instance`
  surface for roblox-ts's module resolution. What the shim provides, the
  `RUNIT_RESULT:` line that carries the verdict, and what a run rebuilds first
  are in [specs/test-harness.md](specs/test-harness.md).
- **Golden checks** (surge, `mise run test`): Node checks that read the
  compiled Luau under `tests/out/`, and the package's own `out/`, and pin
  decisions about their shape, such as one reservation per run of fixed-size
  fields.
- **Transformer unit tests** (transformer, `mise run test`): Jest suites for
  the walk (`walk.test.ts`), the emitter's output per `Field` kind
  (`emit.test.ts`, with snapshots), the whole transform (`transform.test.ts`),
  and detection (`detect.test.ts`). `transform.test.ts` also type-checks the
  generated code in a second program, as roblox-ts does before it emits.

## Writing suites

- One suite per area: `numbers`, `strings`, `collections`, `literals`,
  `unions`, `recursion`, `packed`, `roblox`, `factories`, `overlap` and
  `checks`, with
  `basic` and `coverage` as regression suites and `bytes` for exact bytes.
- Compare whole values: assert `difference(value, result) === undefined`,
  with `difference` from `tests/src/support.ts`. It returns the path of the
  first difference, treats `NaN` as equal to `NaN`, and tells `0` from `-0`.
  `support.spec.ts` tests `difference` itself.
- Fixed cases are a `@Theory` with `@InlineData` for plain values, and a
  `@Fact` over a list where a case is a table or a datatype.
- Random cases loop over values from the seeded `Rng` in
  `tests/src/support.ts`, never `math.random`, so a failure reproduces. Draw
  values that survive their encoding exactly, such as `Rng.f32` for an `f32`
  and `Color3.fromRGB` for a `Color3`; a `CFrame` with a rotation is compared
  per component within `0.0001`.
- Reset shared state at the start of every fact, tear down what a suite
  changes, and never assert on a value that depends on the machine or the
  clock.
- Once an encoding is final, pin its bytes in `bytes.spec.ts`. Work each
  expected string out by hand from [specs/wire-format.md](specs/wire-format.md),
  so the fact checks the specification as well as the code.
- Lune cannot run every shape: no enum with more than 256 items, no
  `DateTime` as a union member, and no `Map` or `Set` keyed by a `Vector3`.
  Pin those at the transformer level instead
  ([specs/test-harness.md](specs/test-harness.md) 4.5).
- Lune gives an enum item a new object on each access, where Roblox gives it
  one. The shim's stand-in `Enum` gives it one, so the generated code, which
  keys an enum's index by the item, round-trips under Lune; the speed tier
  checks the same round trips in Roblox
  ([specs/benchmark-harness.md](specs/benchmark-harness.md) 6.6).
- A transformer change that could break the generated code's types gets a
  `typeErrorsOfGeneratedCode` case in `transform.test.ts`, and one that
  changes what a caller can assign gets a case that assigns the result.
- `@rbxts/repr` stays pinned to `1.0.2` in `tests/package.json`: `1.0.3`
  changed its module's shape, and `@rbxts/runit` `1.4.8` calls it the old way
  when it formats a `@Theory`'s arguments.
- Without `readChecks`, `deserialize` of bytes no `serialize` wrote is
  unspecified, so a crash on such bytes is not a defect. With `readChecks`, it is
  one, and `checks.spec.ts` is where it is pinned.

## CI

`.github/workflows/ci.yml` runs on every push to `master` and every pull
request into it, through `jdx/mise-action`, on `ubuntu-latest` and on
`windows-latest` through Git Bash. It installs the root and each package
with `npm ci`, restores the Prettier and cspell records of the newest run
with the same lock files, then runs the root `mise run ci`, the task a
contributor runs, and fails if a lock file was rewritten during the run.
Both packages are checked at the same commit, so a transformer change that
breaks the round-trip suite or a golden check fails its own run. Windows is in the run
because roblox-ts projects are built on Windows or macOS, where the
transformer runs inside `rbxtsc`, and because the mise tasks run there
through Git Bash.

To run the same checks before pushing, `mise run hooks:install` installs a
pre-push hook, or run the `repository: ci` VS Code task.

The benchmarks are not part of CI. A timing needs a real Roblox process and
has no pass or fail to gate on;
[future-work/headless-ci.md](future-work/headless-ci.md) is the open item.

## Benchmarks

What the harness measures and how is
[specs/benchmark-harness.md](specs/benchmark-harness.md); what it has found is
under [research/](research/README.md).

- `mise run bench:size` measures each row's bytes under Lune and rewrites
  [benchmarks/size.md](benchmarks/size.md). Bytes are the same on any
  runtime, so the table changes only when an encoding does.
- `mise run bench:speed` times each row in a Roblox Studio process through
  `run-in-roblox`, twice, and rewrites
  [benchmarks/speed.md](benchmarks/speed.md) and its trials. It needs Studio
  installed and takes about ten minutes. `mise run bench:speed:render`
  rewrites `speed.md` from the trials without a run.
- `mise run bench:code` compiles each codec module of the catalog to Luau
  bytecode under Lune and rewrites
  [benchmarks/code-size.md](benchmarks/code-size.md). The table changes when
  the code a library generates for a shape does, so run it after a change to
  what the transformer emits.
- `mise run bench:size:only large-array` and `mise run bench:speed:only cframe`
  measure only the rows their patterns select, and write nothing. A pattern
  is one word, because a mise task argument does not keep its quoting on
  Windows. Try a pattern on the size tier first, which is quick.

Read a scoped size table against `size.md` directly. Read a scoped speed
table only against another scoped run of the same patterns, with the
untouched columns as the control: a column is comparable only within one run,
and two runs of unchanged code can differ widely on a single cell
([research/noise-in-the-speed-tier.md](research/noise-in-the-speed-tier.md)).
A measurement worth keeping is a paper under `research/`, never an edit to a
number in a page.
