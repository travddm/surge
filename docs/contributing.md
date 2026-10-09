# Contributing

Clone the repository, install the pinned tools, and run the checks before
every change is finished:

```sh
git clone https://github.com/travddm/surge
cd surge && mise run setup && mise run ci
```

The repository holds two packages, each in a directory of its own: `surge/`
is `@rbxts/surge`, and `rbxts-transformer-surge/` is the transformer.
`docs/` and the files at the root belong to both. `mise run setup` installs
the tools that the root's `mise.toml` pins (Node) and each package's
(surge's Rojo, Lune, `run-in-roblox`, Blink and Zap), and runs `npm install`
in the root and in each package. Run it again after a tool's version
changes. mise asks to trust each `mise.toml` the first time it reads it.

## Commands

At the root, each task covers the root files and both packages:

| Task                                           | Does                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| `mise run setup`                               | install every tool and every npm project                                  |
| `mise run ci`                                  | every check, in order; must pass before a change is done                  |
| `mise run lint:fix`, `mise run format:fix`     | apply ESLint, markdownlint and Prettier fixes                             |
| `mise run lint:check`, `mise run format:check` | the same checks, reporting without fixing                                 |
| `mise run spell`                               | cspell over the documentation, the last commit message, and both packages |
| `mise run hooks:install`                       | opt in to a pre-push hook that runs `mise run ci`                         |

In a package's directory, a task of the same name covers that package only,
and these tasks are added. Both packages:

| Task               | Does                                                   |
| ------------------ | ------------------------------------------------------ |
| `mise run compile` | build the package                                      |
| `mise run test`    | the transformer's unit tests, or surge's golden checks |

surge only:

| Task                                                    | Does                                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `mise run tests:install`                                | reinstall `tests/` with fresh copies of both packages                                        |
| `mise run tests:compile`, `mise run tests:test`         | build the test place, and run the round-trip suite under Lune                                |
| `mise run bench:size`, `mise run bench:speed`           | record the size and speed tables ([testing.md](testing.md))                                  |
| `mise run bench:code`                                   | record the size of each codec module's bytecode                                              |
| `mise run bench:size:only`, `mise run bench:speed:only` | measure only the rows a pattern selects, and record nothing                                  |
| `mise run bench:speed:render`                           | rewrite the speed table from its trials, without a run                                       |
| `mise run bench:definitions`                            | recompile the Blink and Zap definitions and the Flamework 2 serializers the benchmark drives |
| `mise run dev:tests`                                    | watch-compile the test place and serve it to Studio with Rojo                                |
| `mise run tests:compile:watch`, `mise run tests:serve`  | the two halves of `dev:tests`, one at a time                                                 |
| `mise run tests:sourcemap`                              | write the test place's Rojo sourcemap                                                        |
| `mise run tests:build`                                  | build the test place into a `.rbxl`                                                          |

## Working across both packages

- `surge/tests/` holds copies of both packages, not links. After a change to
  either one, `mise run tests:install` copies it again; `mise run ci` and the
  benchmark tasks do that first
  ([specs/test-harness.md](specs/test-harness.md) section 6).
- A change that spans both packages is one commit. CI checks both packages
  at every commit (see CI in [testing.md](testing.md)).
- A change that moves bytes changes `tests/src/tests/bytes.spec.ts` and the
  size table in the same commit.
- Documentation changes in the same commit as the code it describes; the
  table of which document each kind of change updates is Updating
  documentation in [AGENTS.md](../AGENTS.md).

## Editors

Each package's `.vscode/tasks.json` maps its `mise` tasks to VS Code tasks,
labeled `surge: <task>` or `transformer: <task>`, except surge's
`bench:code`, `bench:definitions` and the two `:only` tasks. The root's adds
`repository: <task>` for the root tasks. Each has a Windows shell override to
Git Bash, because the tasks assume a POSIX shell.

`surge.code-workspace` opens three folders in one window: surge, the
transformer, and the repository root, which shows `docs/` and the root files
and hides the two package directories. It carries its own `settings` block
because VS Code reads window-scoped settings, such as the task buttons, the
TypeScript SDK path and the icon theme, only from the workspace file when
more than one folder is open. The labels carry each folder's name so that
the task buttons can tell the folders' tasks apart in that window. The
transformer and the root disable `luau-lsp`'s sourcemap in their own
settings, since neither has Luau. Nothing depends on the workspace file;
opening the repository root, or one package's directory, alone works the
same way.

## Where to look

- [coding-standards.md](coding-standards.md): formatting, types, naming, file
  organization, comments, and which files are generated.
- [testing.md](testing.md): what each step of `mise run ci` checks, how to
  write a suite, and how to run the benchmarks.
- [architecture.md](architecture.md): the two packages, how they are built
  together, and how a release reaches a user.
- [specs/](specs/README.md): what the code guarantees, statement by statement.
- [future-work/](future-work/README.md): what is open, in order.
