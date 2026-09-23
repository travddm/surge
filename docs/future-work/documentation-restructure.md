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

- **What a user needs.** Install, configure, write a serializer, know what
  is supported and what the bytes and errors are. Short, stable, no
  history.
- **What was established by experiment.** A gap measured, a probe run, a
  mode of the harness found. Dated, with its method and numbers, never
  edited after the fact except to add a later result.
- **What the implementation guarantees.** The wire format, the
  transformer's classification and emission rules, the runtime API. Exact,
  versioned with the code, pinned by tests.

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

**User-facing pages** (`docs/*.md`) follow these rules:

- Lead with the task and a code sample. Explanation follows the sample.
- Under about 150 lines each. Depth is a link into `specs/` or
  `research/`, not a section.
- No history: no "landed", "since", "used to", dates, commit hashes, or
  review findings.
- No numbers except ones the reader acts on (a width, a limit, a default).
  A benchmark figure is a link to `benchmarks/` or a paper.
- One term per concept, matching the specs' terms. The prose rules already
  in [coding-standards.md](../coding-standards.md) apply.
- Never duplicate a statement; link to the one place it lives. File and
  symbol names in backticks, cross-references as Markdown links.

**Specifications** (`docs/specs/`) are normative and versioned with the
code. Proposed format, defined once in `docs/specs/README.md` and used by
every spec:

```text
# <Name> specification
Status: <draft | current>   Applies to: @rbxts/surge x.y, rbxts-transformer-surge x.y
1. Scope            what this specifies and what it leaves to another spec
2. Terms            each term once, with the identifier the code uses
3. <Normative sections>   numbered statements; MUST / SHOULD / MAY as in
                    coding-standards.md; tables and byte diagrams where
                    they read better than prose
n. Conformance      which test pins each statement (bytes.spec.ts, golden
                    checks, transformer tests), or which source implements it
Changes             one line per change, newest first
```

The specs to write, and where their content is today:

| Spec                         | Content                                                                                                                                    | From                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `specs/wire-format.md`       | Byte layout per kind, length widths and `Length<T, L>`, the packed region, `CFrame` forms, enum index width, the blob channel, determinism | transformer.md Type Coverage and Wire format, serde.md, `bytes.spec.ts`, data-type-surface.md              |
| `specs/transformer.md`       | Detection, type walk, classification rules, the diagnostics list, emission rules (reservation runs, block splitting, directive hoisting)   | transformer.md Transformer Design §1–9 and Risks                                                           |
| `specs/runtime-api.md`       | `@rbxts/surge` exports, `createBinarySerializer`, the version coupling between the two packages                                            | serde.md                                                                                                   |
| `specs/benchmark-harness.md` | The catalog, adapters, tiers, protocol (chunked timing, yields, trials, scoped runs), and what each results file records                   | testing.md Benchmarking strategy and the run-in-roblox section, benchmark-tooling.md, the recorder scripts |
| `specs/test-harness.md`      | The Lune shim contract, the sentinel lines, what each suite root covers                                                                    | testing.md                                                                                                 |

**Research papers** (`docs/research/`) report what was measured and never
advise. Proposed format, defined once in `docs/research/README.md`:

```text
# <Title>
<date>  ·  surge <commit>  ·  rbxts-transformer-surge <commit>  ·  Roblox <version>
Abstract        the question and the answer, five sentences at most
Background      what was known and why the question mattered
Method          harness, protocol, what was varied, what was held as control
Results         tables; every number with its spread; data file named
Discussion      what the result does and does not show; threats to validity
Conclusion      one paragraph
Data            the trials file or run output the tables were made from
```

A paper is not edited after publication except to append a correction
with its own date. A later measurement is a new paper or a numbered
revision. The papers to write, and where their content is today:

| Paper                                                            | From                                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| The cost of generated serializer code against hand-written Luau  | generated-code-performance.md (baseline gap, shared reservation, inline reservation, per-element probe)       |
| What `--!native` and `--!optimize 2` are worth on generated code | generated-code-performance.md (the lab loops, What native changed, the level-2 run)                           |
| Per-call against per-element overhead                            | generated-code-performance.md (blob channel, `finishWrite` probes)                                            |
| Serialized size across five libraries                            | benchmark-tooling.md results, benchmarks/size.md's reading                                                    |
| Frame starvation in a Studio benchmark run                       | the A/B of 2026-09-23 in `speed.spec.ts` and testing.md, and [speed-remeasurement.md](speed-remeasurement.md) |
| Noise in the speed tier                                          | benchmark-tooling.md (the noise entry), speed-trials.tsv                                                      |
| The September 2026 review: findings and what landed              | future-work/README.md's narrative, the landed halves of the review documents                                  |

The numbers in the first three come after
[speed-remeasurement.md](speed-remeasurement.md), so each paper is written
once with corrected figures.

**Future work** (`docs/future-work/`) keeps its one-document-per-unit
form but holds only open work. The 380-line narrative of landed work at
the head of [README.md](README.md) moves into the review paper and the
git log; the index becomes the three lists it ends with today (ordered
steps, no step of its own, deferred). A document whose work has landed is
deleted, as the convention already says, and its record is the paper or
spec that absorbed it.

### Conventions to adopt

The maintainer's other roblox-ts repositories settled on a set of
documentation and repository conventions that this repository lacks. They
are restated here in full, adapted to this project's shape, so that nothing
in this plan depends on a file outside this repository.

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
   are never hand-edited, and `future-work/` stays current (the rule
   below).
6. **Verifying changes.** `mise run ci` before a change is complete, in
   whichever repository was touched, and `lint:fix` and `format:fix`
   before that; `testing.md` says what each step checks and how to fix a
   failure.
7. **Updating documentation.** The trigger table below, and the rule that
   documentation changes in the same commit that makes it necessary. When
   in doubt: if a reader of the docs after the change would be confused
   or misled, update the relevant file.

`CLAUDE.md` is a pointer to `AGENTS.md` with only what is specific to
Claude Code (the shell to use on Windows, for instance); where the two
conflict, `AGENTS.md` wins.

**`docs/contributing-docs.md` says how documentation is maintained.**
Three sections: a "what lives where" table (one row per document,
including `specs/`, `research/`, and `future-work/`, stating what each
owns), "when to update docs" (same change; the trigger table lives in
`AGENTS.md` and is linked, not copied), and "style guidelines": plain
direct prose, short sentences and bullets over paragraphs, no duplication,
`AGENTS.md` kept concise and actionable with detail in `docs/`, names in
backticks, cross-references as links, plus the reader-kind rules of this
plan.

**The documentation-update trigger table** for this repository, to be
carried in `AGENTS.md`:

| Trigger                                                                                         | Update                                                                                                      |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Added, removed, or renamed a mise task or npm script                                            | `README.md`, and `AGENTS.md` if it is one of the essentials                                                 |
| Changed the repository split, the sibling-checkout arrangement, or where a package lives        | `architecture.md`                                                                                           |
| Changed the runtime package's exports or the contract of `createBinarySerializer`               | `specs/runtime-api.md`; `data-types.md` if the `DataType` surface changed                                   |
| Changed any byte an encoding writes: a width, a length prefix, the packed region, an enum index | `specs/wire-format.md`, `bytes.spec.ts`, `supported-types.md` or `data-types.md`, and `mise run bench:size` |
| Changed type classification, a diagnostic, or an emission rule                                  | `specs/transformer.md`; `supported-types.md` if a user can see it                                           |
| Changed what `deserialize` does on bad input                                                    | `errors-and-guarantees.md` and `specs/runtime-api.md`                                                       |
| Changed the benchmark catalog, an adapter, the timing protocol, or a recorder                   | `specs/benchmark-harness.md`, and re-record the results file it affects                                     |
| Measured something: a probe, an A/B, a re-measurement, a full run worth keeping                 | A paper under `research/`; a user page links to it and never carries the number                             |
| Changed a lint rule, formatter setting, type rule, or file-organization convention              | `coding-standards.md`                                                                                       |
| Changed the file-directive recommendation or what a user should expect of speed                 | `performance.md`                                                                                            |
| Changed how `ci` runs, the Lune shim, a sentinel line, or an exit code                          | `testing.md`; `specs/test-harness.md` for the contract                                                      |
| Changed how or when docs are updated                                                            | `AGENTS.md` and `contributing-docs.md`                                                                      |
| Changed a task a skill documents                                                                | `.claude/skills/`                                                                                           |
| Started, finished, or re-scoped deferred work                                                   | `future-work/`, per the rule below                                                                          |

**`future-work/` stays current and prunes itself.** One file per unit of
work, with the What / Why deferred / How, briefly shape this directory
already uses. Its `README.md` states the order and the dependencies
between documents, and is updated in the same change that starts,
finishes, or reorders any of them; where units are independent it says so,
as parallel tracks. When work lands, in whole or in part, it is removed
from its document, never left as a struck-through line, and anything a
future reader needs is promoted: a decision or a guarantee to the spec
that owns it, a measurement to a paper, a contributor gotcha to
`contributing.md` or `testing.md`. A document that empties is deleted and
dropped from the index. This directory currently breaks the rule in two
ways that the sequence below repairs: [benchmark-tooling.md](benchmark-tooling.md)
keeps its landed steps as struck-through entries, and
[README.md](README.md) opens with a narrative of landed work.

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
  only with a clear follow-up. The prose rules for comments already in
  this file apply.
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
per [speed-remeasurement.md](speed-remeasurement.md). Write one only when
the task has been done twice by hand.

### Migration map

| Today                                       | Goes to                                                                                                                                 | Dropped                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `AGENTS.md`, `CLAUDE.md` (both repos)       | New, per Conventions to adopt                                                                                                           |                                                  |
| `README.md` (both repos)                    | Rewritten to one screen, plus a getting-started and task-reference section for contributors and the mirrored index                      |                                                  |
| `architecture.md`                           | Shrunk to repository shape and cross-cutting decisions; goal and build history to the review paper                                      | Implementation status, build order               |
| `transformer.md`                            | `specs/transformer.md`, `specs/wire-format.md`, `supported-types.md`; the fbs/Zap source reading and the spike to a short research note | Prose the specs restate                          |
| `serde.md`                                  | `specs/runtime-api.md`, `getting-started.md` (install and version pinning)                                                              |                                                  |
| `coding-standards.md`                       | Kept and shortened; gains file organization, comments, and generated files per Conventions to adopt                                     | The editor-window narrative (to contributing.md) |
| `contributing-docs.md`                      | New, per Conventions to adopt                                                                                                           |                                                  |
| `testing.md`                                | Kept, in the fixed shape above; `specs/test-harness.md` and `specs/benchmark-harness.md` take the contracts                             | The history of why each runner exists            |
| `benchmarks/*`                              | Unchanged; their generated prose shortened to point at the harness spec                                                                 |                                                  |
| `future-work/generated-code-performance.md` | Three papers; the open items stay as a short future-work document                                                                       | The narrative                                    |
| `future-work/benchmark-tooling.md`          | `specs/benchmark-harness.md`, the size paper; the open tier stays as a short future-work document                                       | The landed steps                                 |
| `future-work/README.md`                     | The review paper (narrative); an index of open work only                                                                                |                                                  |
| `future-work/documentation-gaps.md`         | The user pages it lists, then deleted; its stale-statement checklist is worked off during the move                                      |                                                  |
| Other `future-work/*.md`                    | Unchanged if open; deleted if landed, with a spec or paper carrying the record                                                          |                                                  |

### What must survive the move

- Code comments and tests cite documents by section: `Transformer Design
§4 in transformer.md`, `Benchmarking strategy in testing.md`,
  `test/golden.test.mjs` and `coverage.spec.ts` name future-work documents,
  and the two recorder scripts write prose that names `size.md` and
  `speed.md`. Sweep `src/`, `tests/`, `test/`, `scripts/`, both
  `README.md`s, and the transformer repository for `.md` mentions and
  update each to the new location and section. Do not leave redirect
  stubs; a stub is a second place the statement lives.
- `.markdownlint.json` (line length 100, tables and code exempt) and
  `cspell.json` apply to every new file; a spec's byte diagrams go in code
  blocks.
- `architecture.md`'s "Documents in this design" list is the entry point
  and must be rewritten with the layout above, not appended to.
- Nothing is duplicated between an old and a new location for longer than
  one step of the sequence below.

## Why deferred

The user pages should describe fixed behavior, and
[deserialize-hardening.md](deserialize-hardening.md) still moves it: it
changes what `deserialize` does on bad input, which
`errors-and-guarantees.md` is the page for. That document is the step
before this one for that reason. What is left of Tier B of
[type-coverage-parity.md](type-coverage-parity.md) is no longer a reason to
wait: each remaining brand adds a row to `supported-types.md` and
`data-types.md`, which is what the trigger table above is for, and holding
the move for it would only add more of the documents it has to untangle.
The performance papers wait on
[speed-remeasurement.md](speed-remeasurement.md). And the move touches
every cross-reference in both repositories, so it is one unit of work
with a sequence, not a series of opportunistic edits.

Three parts do not wait: the two format READMEs (`specs/README.md`,
`research/README.md`), the frame-starvation paper, and the review paper
that absorbs the future-work narrative. None depends on open behavior or
on a re-measurement.

## How, briefly

In order; each step is one change that leaves the tree consistent:

1. Write `docs/specs/README.md` and `docs/research/README.md`: the two
   formats above, and an index each. Write `docs/contributing-docs.md`,
   and put the `future-work/` rule into effect from this step on, since
   both govern the move itself. Add the new directories to
   architecture.md's document list until `AGENTS.md` replaces it.
2. Write the frame-starvation paper from the A/B already recorded, and the
   review paper from the future-work narrative; cut the narrative from
   `future-work/README.md` and leave the three lists.
3. Run [speed-remeasurement.md](speed-remeasurement.md); write the three
   performance papers and the noise paper from its results; reduce
   generated-code-performance.md and benchmark-tooling.md to their open
   items.
4. Write the specs from transformer.md, serde.md, and testing.md, each
   section marked `current` or `draft` where Tier B or hardening will
   change it; delete the prose the specs restate; fix the code and test
   citations.
5. Write the user pages, `contributing.md`, and the shortened
   `coding-standards.md` and `testing.md`, working off
   documentation-gaps.md's checklist as each statement is rewritten;
   write `AGENTS.md` and `CLAUDE.md` in both repositories; rewrite both
   READMEs and architecture.md; delete documentation-gaps.md.
6. Final sweep: link check across both repositories, `mise run ci`, and a
   read of every page under `docs/*.md` against the rules above.

**Done when:** a consumer can install and use surge from `README.md` and
`getting-started.md` without opening a spec; every number under `docs/`
outside `research/` and `benchmarks/` is one a reader acts on; every
normative statement in a spec names the test that pins it or the code
that implements it; `future-work/` lists only open work; no page under
`docs/*.md` exceeds about 150 lines; `AGENTS.md`'s trigger table names
every document under `docs/`; no struck-through entry remains under
`future-work/`; the citation sweep finds no stale reference;
`mise run ci` passes in both repositories.
