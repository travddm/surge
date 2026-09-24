# Coding standards

The rules for code in both repositories. Tooling enforces formatting, types
and the lint rules, and `mise run ci` fails on a break; review enforces the
rest.

## Tooling

| Tool         | Config               | Run                                             |
| ------------ | -------------------- | ----------------------------------------------- |
| ESLint       | `eslint.config.ts`   | `mise run lint:check` / `mise run lint:fix`     |
| markdownlint | `.markdownlint.json` | `mise run lint:check` / `mise run lint:fix`     |
| Prettier     | `.prettierrc`        | `mise run format:check` / `mise run format:fix` |
| cspell       | `cspell.json`        | `mise run spell`                                |

Run `mise run lint:fix` and `mise run format:fix` in each repository a change
touches before `mise run ci`. Each repository keeps its own copy of every
config, trimmed to what it needs: the transformer is plain Node, so its
ESLint config has no roblox-ts rules. cspell checks Markdown, text and YAML,
and the last commit message; add a real word to `cspell.json`.

## Formatting

Prettier owns formatting: tabs of width 4, a print width of 120 columns, and
trailing commas everywhere. `@trivago/prettier-plugin-sort-imports` sorts
imports: `typescript` first, then `@rbxts/*`, then relative imports. Do not
order them by hand. markdownlint holds a Markdown line to 100 columns outside
tables and code blocks.

## Types

- `strict` is on everywhere, and `mise run compile` is the type check.
- No `any`. `roblox-ts/no-any` bans it in surge's `src/` and in `tests/`,
  which roblox-ts compiles; `@typescript-eslint/no-explicit-any` bans it in
  the transformer.

## Naming

- `PascalCase` for types, classes and enums; `camelCase` for variables,
  functions and methods.
- A file is named for its concept, in `kebab-case` when it takes more than
  one word.
- `Field` kind names (`num`, `bool`, `dict`, `taggedUnion`, ...) are the ones
  [specs/wire-format.md](specs/wire-format.md) uses, in the same case.

## DataType brands

Every brand in `DataType` follows these rules, so that a new one does not
have to invent an answer:

1. A brand is `T & { readonly _surge_<name>?: ... }`. It erases to `T`, so an
   unbranded value still assigns to a branded field.
2. Parameters are types, never values. A width is one of the width brands; a
   count or a bound is a number literal type.
3. The first parameter is the value type, and configuration follows it. A
   brand that fixes its own value type, as `Vector<X, Y, Z>` and
   `Transform<X, Y, Z>` do, takes configuration only, and so is never the
   outer brand of a composition.
4. A configuration parameter has a default wherever one value encodes exactly
   what the unbranded type encodes, and a brand with all of its defaults
   encodes that. This keeps every buffer `bytes.spec.ts` pins unchanged as a
   brand lands. `Range<T, Min, Max>` has no such bounds, so its bounds have no
   default.
5. A brand applies to the type it wraps, not to that type's subtree.
   `Packed<T>` is the one exception.

A default is part of the brand, never a project-wide setting in
`tsconfig.json`: two projects compiled with different settings could not
exchange bytes, and nothing in the type would say so. A brand is not named
after a TypeScript global such as `String`, `Map` or `Set`, which it would
shadow for the rest of the namespace.

A brand is declared in surge's `src/data-type.ts` and in the transformer's
`test/fixtures/rbxts-surge/data-type.ts` in the same change. One that takes
arguments is also a row of `PARAMETERIZED_BRANDS` in the transformer's
`detect.ts`, which recognizes it by alias and, re-aliased, by its brand
property ([specs/transformer.md](specs/transformer.md) 4.3).

## Package boundaries

- surge's `src/` never depends on `rbxts-transformer-surge`.
- The transformer never depends on `@rbxts/surge` at run time. It recognizes
  the runtime package's declarations through the TypeScript checker of the
  program it runs in ([specs/transformer.md](specs/transformer.md) 3.1).
- `tests/` is the one project that depends on both.

Each package's declared dependencies enforce these; no lint rule is needed.

## File organization

- One responsibility per module, with a name that says what it is without an
  "and". A file past about 150 lines is a prompt to ask what else it has
  taken on, not a limit.
- Entry modules stay thin: the transformer's `src/index.ts` and the test
  place's `tests/src/index.ts` call into modules that can be tested alone.
- A directory per concern, with a barrel where sibling definitions
  accumulate, as the benchmark's `adapters/` and `fixtures/` do.
- Factor out the third copy, not the second.
- Splitting a module is a refactor: move code as it is, keep exports working,
  and verify with `mise run ci`.

## Comments

- Comments are exceptional. Prefer names and small functions that say what
  the code does.
- `/** */` on an exported function or type says what a caller needs, never
  how it works.
- `//` says why: an intent, an invariant, or a workaround. A comment should
  stay true if the implementation changes and the intent does not.
- A comment cites a document by statement and file, as in "Transformer 5.3
  in docs/specs/transformer.md", and links to a measured figure rather than
  copying it.
- `TODO` only with the follow-up it needs, stated.
- The prose rules in [contributing-docs.md](contributing-docs.md) apply to
  comments as much as to documents.

## Generated files

Never edit these by hand; regenerate them:

| Path                                                                                                              | Regenerated by               |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `out/` and `include/` in surge, `lib/` in the transformer                                                         | `mise run compile`           |
| `node_modules/`, `package-lock.json`                                                                              | `npm install`                |
| `tests/out/`, `tests/include/`                                                                                    | `mise run tests:compile`     |
| `tests/dist/`                                                                                                     | `mise run tests:build`       |
| `server.luau` and `client.luau` under `tests/src/bench/blink/` and `tests/src/bench/zap/`, and `zap/tooling.luau` | `mise run bench:definitions` |
| `docs/benchmarks/size.md`                                                                                         | `mise run bench:size`        |
| `docs/benchmarks/speed.md`, `docs/benchmarks/speed-trials.tsv`                                                    | `mise run bench:speed`       |

The `.d.ts` files beside the Blink and Zap modules, and `zap/deferred.luau`,
are written by hand: neither compiler's own TypeScript output describes the
calls the benchmark adapters make.
