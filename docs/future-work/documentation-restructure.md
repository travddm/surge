# Future work: restructure the documentation around its readers

Part of the [surge](../architecture.md) design.

## What

`docs/` is about 5,000 lines, and nearly all of it is a maintainer's
engineering journal: design rationale, measurement narratives with the
numbers inline, dated status, commit hashes, and the findings of one
review. [documentation-gaps.md](documentation-gaps.md) records that a
consumer has nowhere to find how to install or use surge. The problem is
wider than a missing page: the existing documents mix three kinds of
content that have different readers and age at different rates, so each
one is too long for the reader who needs it and never quite current for
the reader who wrote it.

The three kinds, and which document owns each, are in
[contributing-docs.md](../contributing-docs.md).

This document is the plan for separating them. Nothing in it changes
behavior, and none of it should be done piecemeal without the migration
map below, or two copies of the same statement will drift.

### Target layout

```text
AGENTS.md                    entry point for contributors and agents: index, commands, rules
CLAUDE.md                    points at AGENTS.md; adds only what is specific to Claude Code
README.md                    one screen: what it is, install, example, links
docs/
  getting-started.md         both packages, tsconfig plugins entry, first serializer
  supported-types.md         what is encoded, what becomes a blob, what is rejected
  data-types.md              the DataType.* surface, Packed<T>, Length<T, L>
  errors-and-guarantees.md   deserialize's error contract, non-guarantees
  performance.md             the two file directives, what to expect, link to results
  contributing.md            setup, mise tasks, ci, hooks, working in both repositories
  coding-standards.md        style, lint, type, file-organization, and comment conventions
  testing.md                 what ci checks, how to fix a failure, how to write a suite
  contributing-docs.md       what lives where, when to update docs, how to write them
  architecture.md            how the two repositories fit together (shrunk)
  benchmarks/                generated results, unchanged: size.md, speed.md, trials
  specs/                     technical specifications (normative)
  research/                  research papers (descriptive, dated)
  future-work/               open work only
.claude/skills/              optional: step-by-step guides for recurring tasks
```

The transformer repository gets the same `AGENTS.md`, `CLAUDE.md`, and
`README.md` shape, with its own commands and rules; its detailed
documentation stays here, and its `AGENTS.md` index points across.

**User-facing pages** (`docs/*.md`) are written to the rules in
[contributing-docs.md](../contributing-docs.md), and every page this plan
produces is held to them.

**Specifications** (`docs/specs/`) are normative and versioned with the
code, in the format [specs/README.md](../specs/README.md) states.
Every specification this plan named is written, and
[specs/README.md](../specs/README.md) indexes them.

**Research papers** (`docs/research/`) report what was measured and never
advise, in the format [research/README.md](../research/README.md) states.
Every paper this plan named is published, and
[research/README.md](../research/README.md) indexes them.

**Future work** (`docs/future-work/`) holds open work only, per the rule in
[contributing-docs.md](../contributing-docs.md). Six documents still hold
more than that.
[generated-code-performance.md](generated-code-performance.md) keeps the
file-directive recommendation until `performance.md` exists. Five still
describe work that has landed, beyond a sentence of context for what is
left: [blob-classification.md](blob-classification.md),
[enum-and-opaque-union-members.md](enum-and-opaque-union-members.md),
[enum-encoding.md](enum-encoding.md),
[data-type-surface.md](data-type-surface.md), and
[transformer-unit-test-coverage.md](transformer-unit-test-coverage.md). The
final sweep removes that content, after promoting what a reader needs.

### Conventions to adopt

The maintainer's other roblox-ts repositories settled on a set of
documentation and repository conventions that this repository lacks. They
were restated here in full, adapted to this project's shape, so that
nothing in this plan depends on a file outside this repository. What has
since been adopted has moved out of it: the documentation rules and the
trigger table are in [contributing-docs.md](../contributing-docs.md), and
the two format definitions are in the READMEs of [specs/](../specs/) and
[research/](../research/). What is left to adopt:

**An `AGENTS.md` in each repository is the entry point.** It is read first
by a contributor or an agent, and it links out rather than explaining. Its
sections, in order:

1. **Documentation index.** A table of every document with one line on
   what it owns, mirrored in `README.md` for discoverability. It is the
   canonical index; `architecture.md`'s list is retired.
2. **Setup.** `mise install` once; the rest is a link into `README.md`.
3. **Commands.** The essentials only, each with one line: `mise run ci`,
   `compile`, `lint:fix` and `format:fix`, `tests:test`, `bench:size`,
   `bench:speed`, their `:only` forms, and `bench:speed:render`. The full
   task reference lives in
   `README.md`.
4. **Where to make changes.** The runtime package's `src/`, the standalone
   `tests/` project, and the transformer's `src/` in the sibling
   repository, with the `file:` dependency and the sibling-checkout
   requirement stated once here.
5. **Rules to follow**, in three groups. Enforced by tooling, so breaking
   one fails `mise run ci`: no `any`; the package boundaries (the runtime
   package never depends on the transformer, the transformer never depends
   on the runtime package at run time, `tests/` alone may depend on both).
   Invariants that are not machine-checked but are load-bearing: a byte
   change is a `bytes.spec.ts` change and a size-table change in the same
   commit; a measurement is a paper, never an edit to a number in a page.
   Review-only conventions: one responsibility per module, generated files
   are never hand-edited, and `future-work/` stays current (the rule in
   [contributing-docs.md](../contributing-docs.md)).
6. **Verifying changes.** `mise run ci` before a change is complete, in
   whichever repository was touched, and `lint:fix` and `format:fix`
   before that; `testing.md` says what each step checks and how to fix a
   failure.
7. **Updating documentation.** The trigger table, which moves here from
   [contributing-docs.md](../contributing-docs.md) and is linked, not
   copied, from there afterwards, with its rows rewritten as the specs and
   the user pages take over from today's documents.

`CLAUDE.md` is a pointer to `AGENTS.md` with only what is specific to
Claude Code (the shell to use on Windows, for instance); where the two
conflict, `AGENTS.md` wins.

**`coding-standards.md` gains three sections it does not have.** The
existing tooling, formatting, types, naming, and package-boundary sections
stay, shortened to the rules themselves (the editor-window narrative moves
to `contributing.md`). Added:

- **File organization**, review-enforced: one responsibility per module,
  with a file name that describes it without an "and"; a file past
  roughly 150 lines is a prompt to ask what else it has taken on, not a
  limit; composition roots stay thin (the transformer's entry module, the
  tests place's `index.ts`), with logic that could be tested on its own in
  a module they call; a directory per concern with a barrel where sibling
  definitions accumulate (the benchmark adapters and fixtures already
  are); factor out the third copy, not the second. Splitting a module is
  a refactor: move code as it is, keep exports working, verify with
  `mise run ci`.
- **Comments**: exceptional, not expected; `/** */` on exported functions
  and types for what a caller needs, never how it is implemented; `//`
  only for intent, an invariant, or a workaround; a comment should stay
  correct if the implementation changes but the intent does not; `TODO`
  only with a clear follow-up. The prose rules in
  [contributing-docs.md](../contributing-docs.md) apply to a comment as
  much as to a document.
- **Generated files**, with the canonical list: `out/`, `dist/`,
  `include/`, `node_modules/`, `package-lock.json`, `tests/out/`,
  `tests/dist/`, `tests/include/`, the compiled Blink and Zap modules
  under `tests/src/bench/blink/` and `tests/src/bench/zap/` (regenerated
  by `mise run bench:definitions`), and the three files under
  `docs/benchmarks/` (regenerated by the two `bench:` tasks). None is
  hand-edited. A `PreToolUse` hook that blocks `Edit` and `Write` to those
  paths is optional and, if added, keeps its list in sync with this one;
  it does not see a shell-driven write, so review still catches those.

**`testing.md` takes a fixed shape**, so a contributor knows where to
look: Static checks (each step of `mise run ci`, what it catches, how to
fix it), Runtime tests (`mise run tests:test` under Lune, what the shim
provides), Writing suites (reset shared state at the start of every fact;
tear down what a suite mutates; never assert on an environment-dependent
value; compare whole values with `difference` from `tests/src/support.ts`;
pin bytes in `bytes.spec.ts` once an encoding is final), CI (what the
workflow runs, in both repositories), and Benchmarks (how to run, scope,
and record; how to read a scoped run). The sentinel lines, exit codes,
anchored parses, and timeout of the runner scripts are the harness
contract and go in `specs/test-harness.md`, linked from here.

**Task skills are optional.** A `.claude/skills/<task>/SKILL.md` is a
step-by-step guide for a recurring task, and each step links to the spec
that owns the rule rather than restating it. Candidates: add a `DataType`
kind end to end (IR, walker, emitter, runtime, `bytes.spec.ts`, the size
table); add a benchmark fixture (one shape per library, the Blink and Zap
twins, `bench:definitions`); record the benchmarks; re-measure a claim
against a control in the same run, the way the papers under `research/` do.
Write one only when the task has been done twice by hand.

### Migration map

| Today                                       | Goes to                                                                                                            | Dropped                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `AGENTS.md`, `CLAUDE.md` (both repos)       | New, per Conventions to adopt                                                                                      |                                                  |
| `README.md` (both repos)                    | Rewritten to one screen, plus a getting-started and task-reference section for contributors and the mirrored index |                                                  |
| `architecture.md`                           | Shrunk to repository shape and cross-cutting decisions; goal and build history to the review paper                 | Implementation status, build order               |
| `transformer.md` (deleted)                  | `supported-types.md` still takes the user's view of what is supported, from Transformer 4.1                        |                                                  |
| `serde.md`                                  | `getting-started.md` (install and version pinning); `specs/runtime-api.md` has taken the contract                  |                                                  |
| `coding-standards.md`                       | Kept and shortened; gains file organization, comments, and generated files per Conventions to adopt                | The editor-window narrative (to contributing.md) |
| `testing.md`                                | Kept, in the fixed shape above; `specs/test-harness.md` and `specs/benchmark-harness.md` have taken the contracts  | The history of why each runner exists            |
| `benchmarks/*`                              | Unchanged; their generated prose shortened to point at the harness spec                                            |                                                  |
| `future-work/generated-code-performance.md` | `performance.md` takes the file-directive recommendation; the open items stay                                      |                                                  |
| `future-work/benchmark-tooling.md`          | Its open items stay; `specs/benchmark-harness.md` has taken the harness design                                     |                                                  |
| `future-work/documentation-gaps.md`         | The user pages it lists, then deleted; its stale-statement checklist is worked off during the move                 |                                                  |
| Other `future-work/*.md`                    | Unchanged if open; deleted if landed, with a spec or paper carrying the record                                     |                                                  |

### What must survive the move

- Code comments and tests cite documents by section. Every citation of a
  moved or deleted section now names a statement in a specification or a
  finding in a paper. When a later step moves a section, sweep `src/`,
  `tests/`, `test/`, `scripts/`, both `README.md`s, and the transformer
  repository for `.md` mentions and update each to the new location and
  section. Do not leave redirect stubs; a stub is a second place the
  statement lives.
- `architecture.md`'s "Documents in this design" list is the entry point
  and must be rewritten with the layout above, not appended to.
- Nothing is duplicated between an old and a new location for longer than
  one step of the sequence below.

## Why deferred

The user pages should describe fixed behavior, and nothing still moves it.
`deserialize`'s error contract, which `errors-and-guarantees.md` is the
page for, is settled (section 4 of
[specs/runtime-api.md](../specs/runtime-api.md)). What is left of Tier B of
[type-coverage-parity.md](type-coverage-parity.md) is not a reason to wait
either: each remaining brand adds a row to `supported-types.md` and
`data-types.md`, which is what the trigger table in
[contributing-docs.md](../contributing-docs.md) is for, and holding
the move for it would only add more of the documents it has to untangle.
And the move touches
every cross-reference in both repositories, so it is one unit of work
with a sequence, not a series of opportunistic edits.

## How, briefly

In order; each step is one change that leaves the tree consistent:

1. Write the user pages, `contributing.md`, and the shortened
   `coding-standards.md` and `testing.md`, working off
   documentation-gaps.md's checklist as each statement is rewritten;
   write `AGENTS.md` and `CLAUDE.md` in both repositories, moving the
   trigger table into `AGENTS.md`; rewrite both READMEs and
   architecture.md; delete documentation-gaps.md.
2. Final sweep: remove the landed work the five documents under Future
   work above still hold, link check across both repositories, `mise run
ci`, and a read of every page under `docs/*.md` against
   [contributing-docs.md](../contributing-docs.md).

**Done when:** a consumer can install and use surge from `README.md` and
`getting-started.md` without opening a spec; every number under `docs/`
outside `research/` and `benchmarks/` is one a reader acts on; every
normative statement in a spec names the test that pins it or the code
that implements it; `future-work/` lists only open work; no page under
`docs/*.md` exceeds about 150 lines; `AGENTS.md`'s trigger table names
every document under `docs/`; no struck-through entry remains under
`future-work/`; the citation sweep finds no stale reference;
`mise run ci` passes in both repositories.
