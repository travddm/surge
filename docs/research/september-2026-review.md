# The September 2026 review: findings and what landed

2026-09-18, disposition as of 2026-09-23 · surge `bc06cf7` → `07d0f33` ·
rbxts-transformer-surge `6908124` → `aa6f04b` · Node with TypeScript 5.5.3

## Abstract

An adversarial review of both repositories on 2026-09-18 took each promise
the design documents made and checked it by executing the compiled
transformer against constructed programs, rather than by reading it. It filed
fifteen units of work. Seven were confirmed defects in shipped behavior, five
of them silent — wrong bytes for a generic instantiation, a read that
desynchronized, an encoding that depended on unrelated files, an enum index
that truncated, and Roblox types walked structurally instead of passed
through. The other eight were gaps: no transformer unit tests, no round-trip
suite, no benchmark harness, no user documentation. Five days later seven of
the fifteen are closed and eight are open in part. Four further defects in
the same code, three of them silent, were found afterwards — every one by
something that ran the generated code, and none by reading the transformer
again.

## Background

Both packages were written against a design in `docs/`, and that design made
checkable promises: field order is "a pure function of the property names in
the type, independent of file, compiler version, or iteration state"; a type
that reappears on its own walk path "compiles to a named helper"; the enum
index is "a compile-time-computed lookup table"; `Instance` and the Roblox
datatypes pass through a blob channel. The implementation status in
`architecture.md` called steps 0 to 8 built and verified end to end. What had
actually verified them was eight round-trip facts over the whole type
coverage table, none of which compared a whole value.

## Method

The review read each promise in the design documents, then constructed the
smallest program that would test it and ran the compiled transformer over it
under Node — walking throwaway `ts.Program`s, printing the emitter's output,
and compiling probe files with `rbxtsc` where the question was whether the
generated code builds. Each document states how its findings were confirmed
and marks its exceptions: one union case in `walker-emitter-robustness.md` is
from code reading, and the enum index overflow rests on a member count taken
from the installed `@rbxts/types`. Everything else names a case a reader can
re-run.

Each finding became one document under `docs/future-work/`, with what, why it
was deferred, and how it would be fixed; the index ordered them and said why
each came where it did. A second pass the same day re-checked every claim in
those documents against surge `7cce55e` and rbxts-transformer-surge `0e7c10d`
and reordered the index as a result.

The review did not run the generated code against values. That boundary is
what the Discussion is about.

## Results

### What it found, and where each stands

| Filed as                            | Finding                                                                                                                                                                                                                | Today                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `walk-type-identity.md`             | The walker's caches were keyed by `ts.Symbol`, so every instantiation of one generic declaration shared an entry: `Box<string>` came back as `Box<number>`, and `serialize` called `buffer.writef64` on a string.      | Closed, transformer `9ef1c2e`                                         |
| `recursive-union-types.md`          | A type that re-entered its own walk through a union was never marked in progress, so the walk did not terminate.                                                                                                       | Closed, transformer `9ef1c2e`                                         |
| `read-order-side-effects.md`        | A helper call and a blob read came back as bare side-effecting expressions with no statement, so the read cursor and the blob channel could desynchronize.                                                             | Closed, transformer `9ef1c2e`                                         |
| `wire-format-determinism.md`        | Literal, guarded-union, and discriminant order came from the checker's type-id order, so an unrelated file changed the bytes. Packed padding was not deterministic either.                                             | Closed, transformer `9ef1c2e`                                         |
| `enum-encoding.md`                  | An enum index was always written with `writeu8`, and 27 of `Enum.KeyCode`'s members truncate to a different key. The promised lookup table was a linear scan.                                                          | Overflow and lookup closed, transformer `9ef1c2e`; one item open      |
| `blob-classification.md`            | `Instance` and the Roblox datatypes were walked structurally instead of passed through, and function, `symbol`, `bigint`, `null`, template-literal, and index-signature types were misclassified in silence.           | Closed, transformer `8616c93` and `0e7c10d`; one design question open |
| `walker-emitter-robustness.md`      | Non-identifier property names, datatype and recursive union members, a re-aliased `Packed<T>`, and a user declaration named after an injected import each crashed the transformer or produced code that did not build. | Closed, transformer `4067844`                                         |
| `transformer-unit-test-coverage.md` | The transformer had no unit tests, because its tests had no `@rbxts/surge` to resolve a brand against.                                                                                                                 | Harness closed, transformer `619246c`; cases land with their fixes    |
| `round-trip-test-coverage.md`       | Eight facts covered the whole type coverage table, none of them a fuzz loop, a `@Theory`, or a whole-value comparison.                                                                                                 | Closed, surge `1109d42`                                               |
| `type-coverage-parity.md`           | Seven Roblox datatypes, `buffer`, and several width brands had no encoding of their own.                                                                                                                               | Tier A closed, transformer `aa59c4a`; Tier B open                     |
| `benchmark-tooling.md`              | No size or speed comparison against any other library, so no claim about either could be checked.                                                                                                                      | Harness and five columns closed; one tier open                        |
| `generated-code-performance.md`     | Six items, from a local-register ceiling that made a wide object fail to compile to one helper call per field.                                                                                                         | Every large item closed; four small ones open                         |
| `deserialize-hardening.md`          | `deserialize` trusted its input completely.                                                                                                                                                                            | Closed, surge `84f3ed5`                                               |
| `documentation-gaps.md`             | No user-facing documentation at all, and a checklist of statements the code contradicted.                                                                                                                              | Open                                                                  |
| `ci-and-release.md`                 | Neither repository's CI could see a broken serializer, and neither had a tag.                                                                                                                                          | Open                                                                  |

The five correctness fixes shipped together, as the index asked, because two
of them changed the wire format and nothing had pinned bytes yet. Bytes were
pinned afterwards, in `bytes.spec.ts`.

### What it did not find

| Defect                                                                                                                                                                                   | Found by                                                         | Today                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| A union of items from two enums merged into one enum under the first enum's name: a build error, or a wrong value with no error when both enums had a member of the same name.           | Landing the robustness fixes it did find (transformer `4067844`) | Diagnostic landed; support open                         |
| An `unknown` property that was absent or `undefined` (`a?: unknown`) shifted every later blob into the wrong field, with no error.                                                       | The round-trip suite it asked for (surge `1109d42`)              | Closed, transformer `5e6c2d7`                           |
| Six shapes whose generated code did not type-check, so the build failed inside code the user cannot open.                                                                                | The same suite, and Tier A after it                              | Closed, transformer `e74935d`, `5e6c2d7`, and `671439f` |
| A `Map` or `Set` keyed by a Roblox datatype or by a literal union generates correct Luau and TypeScript that does not check, with no diagnostic, on a shape the coverage table promises. | Writing the fixtures for the `checks` option                     | Open, `dict-key-typing.md`                              |

Three of the four are silent or invisible to the user until a build fails,
which is the same class the review was looking for.

## Discussion

The method worked on what it covered. Every one of the seven defects was
confirmed on a concrete case before it was filed, none was withdrawn on
inspection, and all seven are closed — the five correctness fixes in one
commit the same day the review filed them.

What it covered was the transformer's output: the `Field` a type walks to,
and the code the emitter prints for it. Every defect it missed needed
something further along. The two silent ones needed a value to be encoded and
decoded and the result compared whole; the six type-check failures needed
`rbxtsc` to compile the generated code, which the transformer's own tests now
do in a second program; the dictionary-key defect needed someone to write a
fixture for a shape the coverage table promised. A review that stops at the
emitter's output cannot see any of them, however carefully it reads. This is
an argument for the suites, not against the review: the review is what asked
for the suites, and the suites are what found the rest.

It is also an argument about what "verified" meant. The claim in
`architecture.md` that steps 0 to 8 were built and verified end to end was
not false about the code that ran; it was a claim about eight facts that
compared too little, over a table of sixty rows. Coverage that is stated as a
table and tested by a handful of examples reads as verification until
something walks the table row by row.

Two limits on this record. The disposition column is a snapshot of
2026-09-23; `future-work/README.md` is the live list, and its order has
already been rewritten more than once as the reason for a step was spent.
And the review examined two repositories written to one design by the same
author who then fixed what it found, so nothing here says what an independent
reviewer, or a reviewer without the design documents, would have found.

## Conclusion

Fifteen units of work, seven of them confirmed defects and five of those
silent, from one day of testing promises against a running transformer.
Seven of the fifteen are closed. The result worth carrying forward is not the
count but the boundary: the review found everything that was visible in the
transformer's output and nothing that was not, and the four defects it missed
were each found by the first thing that ran the generated code on a value.

## Data

- The fifteen documents as filed, at surge `f5d8134`, including the seven
  since deleted. Each states the case its finding was confirmed on.
- The commits named in the tables above, in both repositories.
- The git log of both repositories between `bc06cf7`/`6908124` and
  `07d0f33`/`aa6f04b`.

## Correction, 2026-09-23

This corrects five statements.

- **How the later defects were found.** Abstract: "every one by something that ran the generated
  code"; Conclusion: "each found by the first thing that ran the generated code on a value". The
  table under "What it did not find" says otherwise. Only the `unknown` defect needed a value to
  be encoded and decoded. The enum-union defect was found while transformer `4067844` landed, and
  one of its two forms is a build error. The six shapes and the dictionary-key defect are
  type-check failures, and the dictionary-key defect was found by writing fixtures. The statements
  should have said that one of the four was found by running generated code on a value, and three
  while building or type-checking it. The Discussion's "A review that stops at the emitter's
  output" does not match the Method either: the review compiled probe files with `rbxtsc`.
- **How each defect was confirmed.** Abstract: "checked it by executing the compiled transformer
  … rather than by reading it"; Discussion: "Every one of the seven defects was confirmed on a
  concrete case before it was filed". The Method, as edited in surge `824a279`, names two
  exceptions. One union case in `walker-emitter-robustness.md` is from code reading, and the enum
  index overflow rests on a member count. The statements should have said that each defect was
  confirmed on a concrete case except for those two parts.
- **What "closed" counts.** Discussion: "all seven are closed"; Abstract: "seven of the fifteen
  are closed and eight are open in part". The two count different things. The Abstract's seven
  are the documents deleted by surge `07d0f33`: five defects and two gaps,
  `round-trip-test-coverage.md` and `deserialize-hardening.md`. The fixes for all seven defects
  landed, but `enum-encoding.md` and `blob-classification.md` stay open for one further item each.
  Of the eight documents not closed, six are open in part. Two, `documentation-gaps.md` and
  `ci-and-release.md`, are open in full.
- **The size of the coverage table.** Discussion: "over a table of sixty rows". The type coverage
  table in `docs/transformer.md` has 21 data rows at surge `bc06cf7` and at `f5d8134`, and 22 at
  `7cce55e`. Nothing in the repository supports sixty.
- **How many were silent.** Abstract: "three of them silent"; Discussion: "The two silent ones".
  Per the table, the `unknown` defect is silent. The enum-union defect is silent when both enums
  have a member of the same name, and a build error otherwise. The six shapes and the
  dictionary-key defect fail the build. The Abstract should have said two, one of them in part.
