# surge: research papers

Part of the [surge](../architecture.md) design. A paper here reports what was
measured: the question, the method, the numbers, and what they do and do not
show. It never advises. A recommendation a reader acts on belongs in a page
under `docs/`, which links here for the evidence.

## Format

Every paper has this shape:

```text
# <Title>

<date> · surge <commit> · rbxts-transformer-surge <commit> · <runner and version>

Abstract      the question and the answer, five sentences at most
Background    what was known, and why the question mattered
Method        the harness, the protocol, what was varied, what was held as
              a control
Results       tables; every number with its spread; the data file named
Discussion    what the result does and does not show; threats to validity
Conclusion    one paragraph
Data          the trials file or run output the tables were made from
```

- The header line records the state that was measured: the date, a commit in
  each repository, and what ran the code — a Roblox Studio version for the
  speed tier, a Lune version for what the shim runs. A measurement whose
  commits are not recorded cannot be repeated.
- `Method` names the control. A ratio between two runs is worth nothing
  without one: the libraries, columns, or rows that did not change are what
  say how much of the difference is drift.
- Every number carries its spread, and every table names the data file it was
  read from. A table with nothing behind it is not a result.
- `Discussion` states what the measurement does not reach, including the
  configuration it did not run in, so that a later reader knows which
  conclusions a change of configuration reopens.
- A paper is not edited after publication, except to append a correction with
  its own date and what it corrects. A later measurement is a new paper, or a
  numbered revision that leaves the first in place.
- A page or a comment that needs a figure links to the paper. It never copies
  the number.

Prose follows [../contributing-docs.md](../contributing-docs.md).

## Published papers

| Paper                                                                            | Reports                                                                                                                            |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [frame-starvation.md](frame-starvation.md)                                       | What a Studio benchmark run that never yields does to its own numbers, and where the onset is.                                     |
| [september-2026-review.md](september-2026-review.md)                             | What the review of 2026-09-18 found by executing the transformer, what has landed since, and what it did not find.                 |
| [per-call-overhead.md](per-call-overhead.md)                                     | What surge's per-call work costs: the blob side channel at 25.7 ns a call, and `finishWrite`'s copy at nothing.                    |
| [file-directives-on-generated-code.md](file-directives-on-generated-code.md)     | What `--!native` is worth on the generated code: 1.335× on encode, where the figure on record was 1.02×.                           |
| [noise-in-the-speed-tier.md](noise-in-the-speed-tier.md)                         | What a cell's trials disagree by, what two invocations of unchanged code disagree by, and which of the two matters.                |
| [generated-code-against-hand-written.md](generated-code-against-hand-written.md) | What the inline reservation bought, at 1.54× on encode against 4.15× on record, and the per-call gap to hand-written Luau it left. |
| [serialized-size-across-libraries.md](serialized-size-across-libraries.md)       | surge's bytes against fbs, serio, Blink and Zap on sixteen rows, and what every difference is.                                     |

A paper's own run output, where nothing else records it, is under
[data/](data/). Which papers are planned, and where the measurements behind
each one are recorded today, are in
[../future-work/documentation-restructure.md](../future-work/documentation-restructure.md).
Each is listed here as it lands.
