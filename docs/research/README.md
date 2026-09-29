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

| Paper                                                                            | Reports                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [packed-bits-read-in-place.md](packed-bits-read-in-place.md)                     | What reading each byte of a packed region once and testing its bits in place is worth: 1.94× on the packed toggles' decode, 299 ns a call, and that decode at the hand-written codec's rate.                                                                  |
| [hand-written-union-and-packed-bits.md](hand-written-union-and-packed-bits.md)   | The tagged union and the packed toggles against hand-written Luau writing the same bytes: 1.17× on the tagged union's encode, 1.93× on the packed toggles' decode, about 25 ns for each bit read through `unpackBit`, and the other halves within the band.   |
| [size-and-read-locals.md](size-and-read-locals.md)                               | What reading a sized write's value through its own locals and holding a `deserialize`'s read state in locals are worth: 1.065× on the deeply nested object's encode, up to 1.37× on decode, and the three baseline rows within the band of hand-written Luau. |
| [exact-sizing-with-loops.md](exact-sizing-with-loops.md)                         | What sizing a shape by a loop ahead of its result is worth: 1.18× on the guarded union's encode and 1.05× to 1.11× on the tagged union's, and 0.92× on an array of strings, which keeps the scratch buffer.                                                   |
| [nested-object-values.md](nested-object-values.md)                               | What reading a nested object's value once is worth: 1.050× on the deeply nested object's encode, 11 ns a call, and its gap to hand-written Luau from 26 ns to 17 ns.                                                                                          |
| [per-element-encode.md](per-element-encode.md)                                   | What reading a `CFrame`'s position once is worth, 8.0 ns per element on encode and the `CFrame` array within 0.3% of hand-written Luau, and why a numeric write loop was reverted: 0.887× on a thousand `u16`s.                                               |
| [sized-read-tables.md](sized-read-tables.md)                                     | What creating a read's table at its size and storing each element at its index is worth: 4.9 to 10.3 ns per element on decode, and the `CFrame` array within 14 ns a call of hand-written Luau.                                                               |
| [exact-sizing.md](exact-sizing.md)                                               | What creating the result at its exact size is worth: 1.13× to 1.23× on encode on seven rows, and the flat struct within 3.7 ns a call of hand-written Luau.                                                                                                   |
| [one-reservation-per-string.md](one-reservation-per-string.md)                   | What reserving a string's count and bytes at once is worth: 3.5 to 4.8 ns per string on encode, 1.155× on a 200-key dictionary, and a reference run that drifted 3% on its own.                                                                               |
| [one-reservation-per-array.md](one-reservation-per-array.md)                     | What reserving an array's fixed-size elements once is worth: 2.20× on the encode of a thousand `u16`s, 1.34× on a thousand booleans, and nothing measurable on the `CFrame` array.                                                                            |
| [read-checks-cost.md](read-checks-cost.md)                                       | What `readChecks` costs: 0.957× of the unchecked decode throughput over the catalog, 0.922× to 0.991× per row, and nothing on encode.                                                                                                                         |
| [tables-around-serialize.md](tables-around-serialize.md)                         | What the tables around a `serialize()` call cost: 106.8 ns for the two it returns, 70.3 ns for the benchmark adapter's own, and nothing measurable for the call to `finishWrite`.                                                                             |
| [frame-starvation.md](frame-starvation.md)                                       | What a Studio benchmark run that never yields does to its own numbers, and where the onset is.                                                                                                                                                                |
| [september-2026-review.md](september-2026-review.md)                             | What the review of 2026-09-18 found by executing the transformer, what has landed since, and what it did not find.                                                                                                                                            |
| [per-call-overhead.md](per-call-overhead.md)                                     | What surge's per-call work costs: the blob side channel at 25.7 ns a call, and whether `finishWrite`'s copy grows with the payload.                                                                                                                           |
| [file-directives-on-generated-code.md](file-directives-on-generated-code.md)     | What `--!native` and `--!optimize 2` are worth on the generated code: 1.335× on encode and nothing, against 1.02× and nothing on record.                                                                                                                      |
| [noise-in-the-speed-tier.md](noise-in-the-speed-tier.md)                         | What a cell's trials disagree by, what two invocations of unchanged code disagree by, and which of the two matters.                                                                                                                                           |
| [generated-code-against-hand-written.md](generated-code-against-hand-written.md) | What the inline reservation bought, at 1.54× on encode against 4.15× on record, and the per-call gap to hand-written Luau it left.                                                                                                                            |
| [serialized-size-across-libraries.md](serialized-size-across-libraries.md)       | surge's bytes against fbs, serio, Blink and Zap on sixteen rows, and what every difference is.                                                                                                                                                                |
| [type-coverage-across-libraries.md](type-coverage-across-libraries.md)           | What surge, fbs, serio, Blink and Zap can each express and at what cost, read from source, and what surge leaves out on purpose.                                                                                                                              |
| [compile-time-specialization.md](compile-time-specialization.md)                 | Where fbs's per-call cost is, that a roblox-ts transformer can emit flat code instead, and six compiler behaviors it routes around.                                                                                                                           |
| [packed-against-unpacked.md](packed-against-unpacked.md)                         | What `Packed<T>` does to speed on the two catalog pairs that encode the same values both ways: 0.576× on the toggles decode and 0.644× on the `CFrame` encode.                                                                                                |

A paper's own run output, where nothing else records it, is under
[data/](data/). A speed run keeps its trials file there beside its table,
because the table keeps only printed medians. A new paper follows the format
above and is listed here.
