# surge: documentation guide

Which kind of statement goes where, when a change has to update a document,
and how to write one. It covers both repositories:
`rbxts-transformer-surge` keeps a `README.md`, an `AGENTS.md` and a
`CLAUDE.md`, and its documentation lives here.

## What lives where

Every statement belongs to one of three kinds. They have different readers and
change at different rates, so mixing them in one document makes it too long for
the reader who needs it and never current for the reader who wrote it.

- **What a user needs.** Install, configure, write a serializer, know what is
  supported and what the bytes and the errors are. Short, stable, no history.
- **What was established by experiment.** A gap measured, a probe run, a mode
  of the harness found. Dated, with its method and its numbers, never edited
  after the fact except to add a later result.
- **What the implementation guarantees.** The wire format, the transformer's
  classification and emission rules, the runtime API. Exact, versioned with the
  code, pinned by tests.

The documents themselves, one line each on what they own, are indexed in
[AGENTS.md](../AGENTS.md), which is the one index.

A statement lives in one document. Everywhere else links to it.

## When to update

Documentation changes in the same commit as the change that makes it
necessary. When in doubt: if a reader of the documentation after the change
would be confused or misled, that document is part of the change. The table
of which document each kind of change updates is Updating documentation in
[AGENTS.md](../AGENTS.md).

## How to write it

Prose, in every document and in code comments:

- Short, direct sentences in active voice, one idea each, in plain words. A
  list where the content is a list, rather than a paragraph of them.
- The same term for the same concept throughout, matching the identifier the
  code uses. Do not vary a term for stylistic interest.
- A condition next to the statement it qualifies. Prefer a concrete statement
  to "some", "various", or "usually".
- **must** is required, **should** is recommended, **may** is permitted.
- File, task, and symbol names in backticks; cross-references as Markdown
  links; a byte diagram or a command in a code block.
- `mise run lint:fix` and `mise run format:fix` before the change is
  finished. markdownlint holds a line to 100 columns outside tables and code
  blocks, and `mise run spell` checks every word — add a real one to
  `cspell.json`.

**User-facing pages** (`docs/*.md`):

- Lead with the task and a code sample. Explanation follows the sample.
- Under about 150 lines. Depth is a link into [specs/](specs/) or
  [research/](research/), not a section.
- No history: no "landed", "since", or "used to", and no dates, commit
  hashes, or review findings.
- No number except one the reader acts on — a width, a limit, a default. A
  measured figure is a link to [benchmarks/](benchmarks/) or to a paper.

**Specifications** and **papers** follow their directory's README:
[specs/README.md](specs/README.md) and
[research/README.md](research/README.md).

**Future-work documents** hold open work only. One file per unit of work, in
the What / Why deferred / How, briefly shape the directory uses, and
[future-work/README.md](future-work/README.md) states the order and the
dependencies between them, including where units are independent. That index
is updated in the same change that starts, finishes, or reorders any of them.

When work lands, in whole or in part, it is removed from its document rather
than struck through, and anything a future reader needs is promoted first: a
decision or a guarantee to the specification that owns it, a measurement to a
paper, a contributor gotcha to [testing.md](testing.md) or
[coding-standards.md](coding-standards.md). A document that empties is
deleted, and dropped from the index.
