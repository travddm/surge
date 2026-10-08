# AGENTS.md

The entry point for anyone changing `rbxts-transformer-surge`, person or
agent. This directory holds the transformer only. The repository's
[AGENTS.md](../AGENTS.md) holds the rules and the commands for both packages.
The documentation is in [docs/](../docs/), the runtime package the
transformer generates calls to is in [surge/](../surge/), and the tests that
run what it generates are in `surge/tests/`.

## Documentation

Every document is in the repository's `docs/`. The ones this package answers to:

| Document                                             | Owns                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| [specs/transformer.md](../docs/specs/transformer.md) | What the transformer detects, classifies, emits and reports            |
| [specs/wire-format.md](../docs/specs/wire-format.md) | The bytes the generated code writes                                    |
| [specs/runtime-api.md](../docs/specs/runtime-api.md) | The runtime functions the generated code calls                         |
| [supported-types.md](../docs/supported-types.md)     | What a user is told about each type                                    |
| [contributing.md](../docs/contributing.md)           | Setup, every task, and working across both packages                    |
| [coding-standards.md](../docs/coding-standards.md)   | Formatting, types, naming, file organization and comments              |
| [testing.md](../docs/testing.md)                     | What `mise run ci` checks, and how to write a test                     |
| [AGENTS.md](../AGENTS.md)                            | the repository's rules, and which document each kind of change updates |

## Setup

Run `mise run setup` at the repository root;
[contributing.md](../docs/contributing.md) has the rest.

## Commands

In this directory. At the repository root, `mise run ci`, `mise run lint:fix`
and `mise run format:fix` also cover surge and the root files:

| Command                                    | Does                                            |
| ------------------------------------------ | ----------------------------------------------- |
| `mise run ci`                              | lint, format, spell, compile and test, in order |
| `mise run lint:fix`, `mise run format:fix` | apply the lint and format fixes                 |
| `mise run compile`                         | build `lib/`, deleting output with no source    |
| `mise run test`                            | the Jest suites under `test/`                   |

## Where to make changes

- `src/walk.ts` turns a TypeScript type into a `Field` tree, and
  `src/field.ts` defines the tree. `src/emit/` turns the tree into
  statements, one module per concern; `src/field.ts` lists every switch a new
  kind needs. `src/index.ts` finds call sites and reads their options, and
  `src/detect.ts` recognizes surge's factories and brands.
- `test/fixtures/rbxts-surge/` is a stand-in for `@rbxts/surge`'s public
  declarations, which this package does not depend on. Change it in the
  same commit as a change to what surge exports.
- What the generated code does when it runs is tested by surge's round-trip
  suite in `surge/tests/`, which compiles through this transformer. Run
  `mise run ci` at the repository root after a change here: it checks this
  package, then surge, whose `tests:install` copies this package first.

## Rules

- No `any`; `mise run ci` fails on one.
- Never depend on `@rbxts/surge` at run time. Recognize its declarations
  through the checker of the program being transformed.
- A diagnostic is how a type the transformer cannot encode is reported. Never
  fall back to something that compiles but is wrong.
- A change to what the generated code does, or to a diagnostic, changes
  the specifications in `docs/specs/` in the same commit; see the
  repository's [AGENTS.md](../AGENTS.md).
- Review a snapshot change before accepting it with `npx jest -u`.

## Verifying changes

Before a change is complete, run `mise run lint:fix` and
`mise run format:fix`, then `mise run ci`, at the repository root.
