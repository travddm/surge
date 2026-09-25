# Contributing

Clone both repositories side by side, install the pinned tools, and run the
checks before every change is finished:

```sh
git clone https://github.com/travddm/surge
git clone https://github.com/travddm/rbxts-transformer-surge
cd surge && mise install && mise run ci
cd ../rbxts-transformer-surge && mise install && mise run ci
```

`mise install` installs the tools each repository pins in its `mise.toml`
(Node, and in surge Rojo, Lune, `run-in-roblox`, Blink and Zap) and runs
`npm install` after. surge's `tests/` project depends on the transformer
through `file:../../rbxts-transformer-surge`, so the two must be siblings.

## Commands

Both repositories:

| Task                                           | Does                                                      |
| ---------------------------------------------- | --------------------------------------------------------- |
| `mise run ci`                                  | every check, in order; must pass before a change is done  |
| `mise run compile`                             | build the package                                         |
| `mise run lint:fix`, `mise run format:fix`     | apply ESLint, markdownlint and Prettier fixes             |
| `mise run lint:check`, `mise run format:check` | the same checks, reporting without fixing                 |
| `mise run spell`                               | cspell over the documentation and the last commit message |
| `mise run test`                                | the transformer's unit tests, or surge's golden checks    |
| `mise run hooks:install`                       | opt in to a pre-push hook that runs `mise run ci`         |

surge only:

| Task                                                    | Does                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `mise run tests:install`                                | reinstall `tests/` with fresh copies of both packages         |
| `mise run tests:compile`, `mise run tests:test`         | build the test place, and run the round-trip suite under Lune |
| `mise run bench:size`, `mise run bench:speed`           | record the size and speed tables ([testing.md](testing.md))   |
| `mise run bench:size:only`, `mise run bench:speed:only` | measure only the rows a pattern selects, and record nothing   |
| `mise run bench:speed:render`                           | rewrite the speed table from its trials, without a run        |
| `mise run bench:definitions`                            | recompile the Blink and Zap definitions the benchmark drives  |
| `mise run dev:tests`                                    | watch-compile the test place and serve it to Studio with Rojo |
| `mise run tests:compile:watch`, `mise run tests:serve`  | the two halves of `dev:tests`, one at a time                  |
| `mise run tests:sourcemap`                              | write the test place's Rojo sourcemap                         |
| `mise run tests:build`                                  | build the test place into a `.rbxl`                           |

## Working across both repositories

- `tests/` holds copies of both packages, not links. After a change to
  either one, `mise run tests:install` copies it again; `mise run ci` and the
  benchmark tasks do that first
  ([specs/test-harness.md](specs/test-harness.md) section 6).
- surge's GitHub workflow checks out the transformer's default branch, not a
  pinned commit. Push the transformer first when a change spans both, or
  surge's run tests against the old transformer.
- A change that moves bytes changes `tests/src/tests/bytes.spec.ts` and the
  size table in the same commit.
- Documentation changes in the same commit as the code it describes; the
  table of which document each kind of change updates is Updating
  documentation in [AGENTS.md](../AGENTS.md).

## Editors

Each repository's `.vscode/tasks.json` maps its `mise` tasks to VS Code
tasks, labeled `surge: <task>` or `transformer: <task>`, except surge's
`bench:definitions` and the two `:only` tasks, with a Windows shell
override to Git Bash because the tasks assume a POSIX shell.

`surge.code-workspace` opens both repositories in one window, and expects
the sibling layout above. It carries its own `settings` block because VS Code
reads window-scoped settings, such as the task buttons, the TypeScript SDK
path and the icon theme, only from the workspace file when more than one
folder is open. The labels carry the repository's name so that the task
buttons can tell the two repositories' tasks apart in that window. The
transformer disables `luau-lsp`'s sourcemap in its own settings, since it has
no Luau. Nothing depends on the workspace file; opening one repository alone
works the same way.

## Where to look

- [coding-standards.md](coding-standards.md): formatting, types, naming, file
  organization, comments, and which files are generated.
- [testing.md](testing.md): what each step of `mise run ci` checks, how to
  write a suite, and how to run the benchmarks.
- [architecture.md](architecture.md): why there are two repositories and how
  they depend on each other.
- [specs/](specs/README.md): what the code guarantees, statement by statement.
- [future-work/](future-work/README.md): what is open, in order.
