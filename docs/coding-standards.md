# surge: coding standards

Part of the [surge](architecture.md) design. Conventions for TypeScript in
this repository, enforced by ESLint, Prettier, and the compiler, and
verified by `mise run ci` (see [testing.md](testing.md)).

These follow an established roblox-ts starter template's own
conventions closely — the same ecosystem convention this design
already follows for its toolchain and testing setup (see
[testing.md](testing.md)) — deviating only where this project's shape
requires it: two separate repositories (see Repository layout in
[architecture.md](architecture.md)), one of which
(`rbxts-transformer-surge`) is a plain Node/CommonJS package rather than a
roblox-ts-compiled one, and neither of which has the template's
client/server/shared "realm" split.

## Tooling

| Tool         | Config               | Run                                             |
| ------------ | -------------------- | ----------------------------------------------- |
| ESLint       | `eslint.config.ts`   | `mise run lint:check` / `mise run lint:fix`     |
| markdownlint | `.markdownlint.json` | `mise run lint:check` / `mise run lint:fix`     |
| Prettier     | `.prettierrc`        | `mise run format:check` / `mise run format:fix` |
| cspell       | `cspell.json`        | `mise run spell`                                |

`lint:check`/`lint:fix` run both ESLint and markdownlint (`lint:eslint`
and `lint:md` individually, if only one is needed).

Run `lint:fix` and `format:fix` (in whichever repo was touched) before
treating a change as finished, not just the `check` variants `mise run ci`
gates on — catching auto-fixable issues locally is cheaper than leaving
them for CI or the next contributor to trip over.

Each repository keeps its own copy of all four configs — there is no
longer a single shared root, since the two repos don't share a
`node_modules` or a checkout — trimmed to what that repo actually needs
(the transformer repo's ESLint config, for instance, has no
`roblox-ts/no-any` block, since none of its code is compiled by
roblox-ts). `.vscode/settings.json` and `.vscode/extensions.json` wire the
same tools into the editor (format-on-save, recommended
ESLint/Prettier/roblox-ts/task-buttons extensions), matching the
template, again once per repo. `.vscode/tasks.json` maps every `mise`
task to a VS Code task (with a Windows shell override to Git Bash, since
mise tasks assume a POSIX shell), labeled `surge: <task>` /
`transformer: <task>` rather than the bare `mise: <task>` the template
uses — see Editing both repos together in
[architecture.md](architecture.md) for why the prefix is load-bearing,
not cosmetic.

`.vscode/settings.json`'s `VsCodeTaskButtons.tasks` surfaces the common
ones (`Compile`, `Fix`, `CI`) as one-click buttons — but only when that
repo is opened as its own standalone VS Code window. `VsCodeTaskButtons.*`,
`material-icon-theme.*`, and `js/ts.tsdk.*` are all window-scoped
settings, which VS Code only reads from a folder's own
`.vscode/settings.json` when that folder _is_ the whole window; opened as
part of `surge.code-workspace`'s multi-root window instead, those same
keys in either folder's `settings.json` are silently ignored. The
combined `.code-workspace` file carries its own top-level `settings`
block with the equivalent (task buttons referencing both repos' now-
distinctly-labeled tasks, the icon associations, and the TS SDK picker)
for that reason — see Editing both repos together in
[architecture.md](architecture.md).

## Formatting

Prettier owns formatting, with the same settings as the template:

- Tabs for indentation, width 4.
- A print width of 120 columns.
- Trailing commas everywhere.

Imports are sorted and grouped automatically by
`@trivago/prettier-plugin-sort-imports`. This repo has no Roblox-services/
Flamework/realm layering to sort by, so the order is simpler than the
template's: `typescript` (the compiler API) first, then `@rbxts/*`
packages, then relative imports. Do not reorder imports by hand — run
`mise run format:fix`.

## Types

- `strict` mode is on everywhere. `mise run compile` is the type-check.
- `any` is discouraged everywhere, and banned outright in this package's
  own `src/` and in `tests/` via `roblox-ts/no-any` (both are
  roblox-ts-compiled). `rbxts-transformer-surge` is plain Node/CommonJS
  and never compiled by roblox-ts, so `roblox-ts/no-any` doesn't apply
  there; `@typescript-eslint/no-explicit-any` covers it instead — the
  TypeScript compiler API that package operates on is fully typed, so
  `any` should be rare regardless.

## Naming

- `PascalCase` for types, classes, and enums.
- `camelCase` for variables, functions, and methods.
- File names reflect their primary export's concept; use `kebab-case` for
  multi-word file names.
- `Field` IR node kind names (`num`, `bool`, `dict`, `taggedUnion`, …) are
  already specified in [transformer.md](transformer.md) — follow that
  naming exactly rather than inventing new casing for it.

## Package boundaries

The template enforces intra-package realm/place boundaries
(`shared`/`client`/`server`, multiple Rojo "places") with
`eslint-plugin-import-x`'s `no-restricted-paths`. This project has no
equivalent intra-package split to protect the same way — its boundaries
are between the two repositories, already enforced by each package's own
declared dependencies rather than needing a separate lint rule:

- This package's own `src/` must never depend on
  `rbxts-transformer-surge`.
- `rbxts-transformer-surge` must never depend on `@rbxts/surge` at
  runtime — it only needs to recognize its ambient declarations through
  the TypeScript checker of whatever program it's running inside (see
  Transformer Design §1 in [transformer.md](transformer.md)), not to
  import the package itself.
- `tests/` (nested in this repo, but its own standalone npm project) is
  the one place allowed to depend on both.

## Comments

Comments are exceptional, not expected — prefer self-documenting code
through clear naming and small functions. Use `//` only when the reason
behind the code would not be obvious from the code itself: intent,
invariants, or a workaround, not a restatement of what the code does. Use
`/** */` doc comments on exported functions/types to describe behavior a
caller needs to know, not how the implementation works.
