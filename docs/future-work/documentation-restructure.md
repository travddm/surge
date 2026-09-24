# Future work: finish the documentation restructure

Part of the [surge](../architecture.md) design.

## What

The documentation is laid out around its readers: user pages under `docs/`,
contributor pages beside them, [specs/](../specs/README.md) for what the code
guarantees, [research/](../research/README.md) for what was measured, and
`future-work/` for what is open. [AGENTS.md](../../AGENTS.md) indexes them in
each repository, and [contributing-docs.md](../contributing-docs.md) says what
goes where. What is left is the final sweep:

- Five documents here still describe work that has landed, beyond a sentence
  of context for what is left: [blob-classification.md](blob-classification.md),
  [enum-and-opaque-union-members.md](enum-and-opaque-union-members.md),
  [enum-encoding.md](enum-encoding.md),
  [data-type-surface.md](data-type-surface.md), and
  [transformer-unit-test-coverage.md](transformer-unit-test-coverage.md).
- Citations by section name, such as "Repository layout in surge's
  architecture.md", which a link check cannot see, need a sweep of both
  repositories' sources, tests and documents.
- Every page under `docs/*.md` needs a read against the rules in
  [contributing-docs.md](../contributing-docs.md).

Two conventions are optional and wait for a reason: a `PreToolUse` hook that
blocks edits to the generated files [coding-standards.md](../coding-standards.md)
lists, which would not see a write from a shell; and task skills under
`.claude/skills/`, each written only once its task has been done twice by
hand.

## Why deferred

The sweep follows the move it checks, and the move stopped for review after
the user pages were written.

## How, briefly

1. For each of the five documents, promote what a reader needs to the
   specification, paper or page that owns it, then remove the landed
   content; delete a document that empties.
2. Sweep both repositories for citations of moved or deleted sections, and
   run the link check across both.
3. Read each page under `docs/*.md` against `contributing-docs.md`.
4. Run `mise run ci` in both repositories.

**Done when:** a consumer can install and use surge from `README.md` and
`getting-started.md` without opening a spec; every number under `docs/`
outside `research/` and `benchmarks/` is one a reader acts on; every
normative statement in a spec names the test that pins it or the code that
implements it; `future-work/` lists only open work; no page under
`docs/*.md` exceeds about 150 lines; `AGENTS.md`'s table of which document
each change updates names every document under `docs/`; the citation sweep
finds no stale reference; `mise run ci` passes in both repositories.
