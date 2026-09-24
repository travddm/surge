# AGENTS.md

The entry point for anyone changing surge, person or agent. It links out
rather than explaining. surge is two repositories: this one holds the runtime
package `@rbxts/surge`, the `tests/` project, and all documentation;
[`rbxts-transformer-surge`](https://github.com/travddm/rbxts-transformer-surge)
holds the transformer and its own `AGENTS.md`.

## Documentation

| Document                                                       | Owns                                                                                |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [README.md](README.md)                                         | What surge is, how to install it, and where to go next                              |
| [docs/getting-started.md](docs/getting-started.md)             | Installing, registering the transformer, and a first serializer                     |
| [docs/supported-types.md](docs/supported-types.md)             | What each type is written as, passed through, or rejected                           |
| [docs/data-types.md](docs/data-types.md)                       | The `DataType` brands                                                               |
| [docs/errors-and-guarantees.md](docs/errors-and-guarantees.md) | `checks`, `writeChecks`, what each side raises, and what is not guaranteed          |
| [docs/performance.md](docs/performance.md)                     | The file directives, the module shape, and what to expect                           |
| [docs/contributing.md](docs/contributing.md)                   | Setup, every task, working across both repositories, and the editor                 |
| [docs/coding-standards.md](docs/coding-standards.md)           | Formatting, types, naming, boundaries, file organization, comments, generated files |
| [docs/testing.md](docs/testing.md)                             | What `mise run ci` checks, how to write a suite, and the benchmarks                 |
| [docs/contributing-docs.md](docs/contributing-docs.md)         | What kind of statement goes where, and how to write it                              |
| [docs/architecture.md](docs/architecture.md)                   | Why two repositories, and how they depend on each other                             |
| [docs/specs/](docs/specs/README.md)                            | What the code guarantees: runtime API, wire format, transformer, both harnesses     |
| [docs/research/](docs/research/README.md)                      | Dated papers on what was measured                                                   |
| [docs/benchmarks/](docs/benchmarks/)                           | The generated size and speed tables                                                 |
| [docs/future-work/](docs/future-work/README.md)                | Open work, in order                                                                 |

## Setup

Clone this repository and `rbxts-transformer-surge` side by side, then run
`mise install` in each. [docs/contributing.md](docs/contributing.md) has the
rest.

## Commands

| Command                                                 | Does                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| `mise run ci`                                           | every check, in order                                       |
| `mise run lint:fix`, `mise run format:fix`              | apply the lint and format fixes                             |
| `mise run compile`                                      | build `@rbxts/surge`                                        |
| `mise run tests:test`                                   | run the round-trip suite under Lune                         |
| `mise run bench:size`, `mise run bench:speed`           | record the size and speed tables; speed needs Roblox Studio |
| `mise run bench:size:only`, `mise run bench:speed:only` | measure the rows a pattern selects, and record nothing      |
| `mise run bench:speed:render`                           | rewrite `speed.md` from its trials                          |

The full list is in [docs/contributing.md](docs/contributing.md).

## Where to make changes

- `src/`: the runtime package the generated code calls, compiled by
  roblox-ts.
- `tests/`: a standalone npm project with its own `node_modules`. It depends
  on this package through `file:..` and on the transformer through
  `file:../../rbxts-transformer-surge`, which is why the two repositories
  must be siblings. It holds the round-trip suite (`tests/src/tests/`) and
  the benchmark harness (`tests/src/bench/`).
- `test/`: the golden checks, plain Node, reading `tests/out/`.
- The transformer's `src/` is in the sibling repository. A change there is
  seen here only after `mise run tests:install`, which `mise run ci` runs.

## Rules

Enforced by tooling, so breaking one fails `mise run ci`:

- No `any`.
- `src/` never imports the transformer, the transformer never depends on
  `@rbxts/surge` at run time, and only `tests/` depends on both.
- Every word in a Markdown file and in the last commit message is one cspell
  knows, or one added to `cspell.json`.

Not checked by a machine, and load-bearing:

- A change to any byte an encoding writes changes
  `tests/src/tests/bytes.spec.ts` and the size table in the same commit.
- A measurement is a paper under `docs/research/`, never an edit to a number
  in a page.
- A change that spans both repositories is pushed transformer first: this
  repository's CI checks out the transformer's default branch.

Enforced by review:

- One responsibility per module; generated files are never edited by hand
  ([docs/coding-standards.md](docs/coding-standards.md)).
- `docs/future-work/` holds open work only, and is updated in the same
  change that starts, finishes or reorders any of it.

## Verifying changes

Before a change is complete, run `mise run lint:fix` and
`mise run format:fix`, then `mise run ci`, in each repository the change
touches. [docs/testing.md](docs/testing.md) says what each step checks and
how to fix a failure.

## Updating documentation

Documentation changes in the same commit as the change that makes it
necessary. If a reader after the change would be misled, the document is
part of the change.

| Changed                                                                | Update                                                                                                                                                                                         |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a mise task or an npm script                                           | [docs/contributing.md](docs/contributing.md), and [docs/testing.md](docs/testing.md) if `mise run ci` runs it                                                                                  |
| the repository split, the sibling checkout, or where a package lives   | [docs/architecture.md](docs/architecture.md) and [docs/contributing.md](docs/contributing.md)                                                                                                  |
| the runtime package's exports, or what a factory or `deserialize` does | [docs/specs/runtime-api.md](docs/specs/runtime-api.md), [docs/getting-started.md](docs/getting-started.md), [docs/errors-and-guarantees.md](docs/errors-and-guarantees.md)                     |
| any byte an encoding writes                                            | [docs/specs/wire-format.md](docs/specs/wire-format.md), [docs/supported-types.md](docs/supported-types.md) or [docs/data-types.md](docs/data-types.md), `bytes.spec.ts`, `mise run bench:size` |
| type classification, a diagnostic, or an emission rule                 | [docs/specs/transformer.md](docs/specs/transformer.md), and [docs/supported-types.md](docs/supported-types.md) for what a user sees                                                            |
| a `DataType` brand                                                     | [docs/data-types.md](docs/data-types.md), [docs/specs/wire-format.md](docs/specs/wire-format.md)                                                                                               |
| the benchmark catalog, an adapter, the timing protocol, or a recorder  | [docs/specs/benchmark-harness.md](docs/specs/benchmark-harness.md), and re-record the table it affects                                                                                         |
| how `ci` runs, the Lune shim, a sentinel line, or an exit code         | [docs/testing.md](docs/testing.md) and [docs/specs/test-harness.md](docs/specs/test-harness.md)                                                                                                |
| something measured: a probe, an A/B, or a run worth keeping            | a paper under [docs/research/](docs/research/README.md); a page links to it and never copies the number                                                                                        |
| what the generated code costs, or what a file directive does to it     | [docs/performance.md](docs/performance.md), with a paper under [docs/research/](docs/research/README.md) for the measurement                                                                   |
| a lint rule, a formatter setting, a type rule, or a naming convention  | [docs/coding-standards.md](docs/coding-standards.md)                                                                                                                                           |
| how or when documentation is updated                                   | this table and [docs/contributing-docs.md](docs/contributing-docs.md)                                                                                                                          |
| deferred work started, finished or re-scoped                           | [docs/future-work/](docs/future-work/README.md) and its index                                                                                                                                  |

How to write each kind of document is in
[docs/contributing-docs.md](docs/contributing-docs.md).
