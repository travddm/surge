# surge: documentation guide

Part of the [surge](architecture.md) design. What each document owns, when a
change has to update one, and how to write one. It covers both repositories:
`rbxts-transformer-surge` keeps a `README.md` and nothing else, and its
documentation lives here (see Repository layout in
[architecture.md](architecture.md)).

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

| Document                                             | Owns                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [../README.md](../README.md)                         | What surge is, how to install it, and where to go next. The transformer repository's own `README.md` does the same for it, and points here. |
| [architecture.md](architecture.md)                   | How the two repositories fit together, the cross-cutting decisions behind that shape, and the index of the documents below.                 |
| [getting-started.md](getting-started.md)             | Installing both packages, registering the transformer, and a first serializer.                                                              |
| [supported-types.md](supported-types.md)             | What each type is written as, what goes into `blobs`, and what is rejected.                                                                 |
| [data-types.md](data-types.md)                       | The `DataType` brands: number widths, `Length`, `Vector`, `Transform` and `Packed`.                                                         |
| [errors-and-guarantees.md](errors-and-guarantees.md) | What `checks` and `writeChecks` reject, what each side raises, and what the bytes do not carry.                                             |
| [performance.md](performance.md)                     | The two file directives, the module shape they need, and what to expect against other libraries.                                            |
| [coding-standards.md](coding-standards.md)           | TypeScript conventions, and the tooling that enforces them.                                                                                 |
| [testing.md](testing.md)                             | What each step of `mise run ci` checks, how to write a suite, and how to run a benchmark tier and read its result.                          |
| `contributing-docs.md`                               | This document.                                                                                                                              |
| [benchmarks/](benchmarks/)                           | Recorded results, written by `mise run bench:size` and `mise run bench:speed`. Generated, and never hand-edited.                            |
| [specs/](specs/)                                     | Normative specifications, versioned with the code. [specs/README.md](specs/README.md) has the format.                                       |
| [research/](research/)                               | Papers reporting what was measured. [research/README.md](research/README.md) has the format.                                                |
| [future-work/](future-work/)                         | Open work, one document per unit, in the order [future-work/README.md](future-work/README.md) states.                                       |

A statement lives in one document. Everywhere else links to it.

## When to update

Documentation changes in the same commit as the change that makes it
necessary. When in doubt: if a reader of the documentation after the change
would be confused or misled, that document is part of the change.

| Trigger                                                                                             | Update                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Added, removed, or renamed a mise task or an npm script                                             | The `README.md` of the repository that has it, and [testing.md](testing.md) if `mise run ci` runs it                                                                                                        |
| Changed the repository split, the sibling-checkout arrangement, or where a package lives            | [architecture.md](architecture.md)                                                                                                                                                                          |
| Changed the runtime package's exports, or the contract of `createBinarySerializer` or `deserialize` | [specs/runtime-api.md](specs/runtime-api.md), and [getting-started.md](getting-started.md) and [errors-and-guarantees.md](errors-and-guarantees.md) where they state it                                     |
| Changed any byte an encoding writes: a width, a length prefix, the packed region, an enum index     | [specs/wire-format.md](specs/wire-format.md), [supported-types.md](supported-types.md) or [data-types.md](data-types.md) where they give a size, `tests/src/tests/bytes.spec.ts`, and `mise run bench:size` |
| Changed type classification, a diagnostic, or an emission rule                                      | [specs/transformer.md](specs/transformer.md), and [supported-types.md](supported-types.md) for classification and diagnostics                                                                               |
| Changed the benchmark catalog, an adapter, the timing protocol, or a recorder                       | [specs/benchmark-harness.md](specs/benchmark-harness.md), and re-record the results file it affects                                                                                                         |
| Measured something: a probe, an A/B, a re-measurement, or a full run worth keeping                  | A paper under [research/](research/). A page links to the paper and never carries the number                                                                                                                |
| Changed a lint rule, a formatter setting, a type rule, or a naming convention                       | [coding-standards.md](coding-standards.md)                                                                                                                                                                  |
| Changed how `ci` runs, the Lune shim, a sentinel line, or an exit code                              | [testing.md](testing.md) and [specs/test-harness.md](specs/test-harness.md)                                                                                                                                 |
| Changed how or when documentation is updated                                                        | This document                                                                                                                                                                                               |
| Started, finished, or re-scoped deferred work                                                       | [future-work/](future-work/), per the rule below                                                                                                                                                            |

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
