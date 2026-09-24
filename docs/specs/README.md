# surge: specifications

Part of the [surge](../architecture.md) design. A specification here is
normative: it states exactly what the implementation guarantees, and it is
versioned with the code that implements it. Why a guarantee is what it is
belongs in [../research/](../research/) or
[../future-work/](../future-work/); a task a user performs belongs in a page
under `docs/`.

## Format

Every specification has this shape:

```text
# <Name> specification

Status: <draft | current>
Applies to: @rbxts/surge x.y, rbxts-transformer-surge x.y

1. Scope          what this specifies, and what it leaves to another spec
2. Terms          each term once, with the identifier the code uses
3. <Normative sections>
                  numbered statements; tables and byte diagrams in code
                  blocks where they read better than prose
n. Conformance    which test pins each statement, or which source
                  implements it

Changes           one line per change, newest first
```

- `Status` is `current` when every statement describes shipped behavior, and
  `draft` while any of them does not. A single section ahead of the code is
  marked `draft` where it stands, and the rest of the document stays
  `current`.
- `Applies to` names a version of each package, because the two only work
  together at the version each was built against (see Package name and
  distribution in [../serde.md](../serde.md)). Until the first tagged
  release, it names a commit in each repository instead.
- Every normative statement is numbered, so a test, a comment, or another
  document can cite it as `4.2`. One statement states one requirement.
- **must** is a requirement: an implementation that does otherwise is wrong.
  **should** is a recommendation: deviating from it needs a stated reason.
  **may** is permitted: a caller cannot depend on it either way. Never write
  "should" for something required.
- `Conformance` names the test that pins each statement — a fact under
  `tests/src/tests/`, a golden check in `test/golden.test.mjs`, a
  transformer unit test — or, where nothing pins it, the source that
  implements it. A statement with neither is unverified and says so.
- `Changes` records one line per change, newest first, naming the statements
  it touched. A specification is edited in the same change as the code it
  describes.

Prose follows [../contributing-docs.md](../contributing-docs.md). A
specification carries no history, no measurements, and no rationale beyond
what a reader needs in order to apply a statement correctly.

## Published specifications

| Specification                    | Specifies                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [runtime-api.md](runtime-api.md) | `@rbxts/surge`'s consumer API, what `deserialize` does with bad input, the helpers generated code calls, and the version coupling. |
| [wire-format.md](wire-format.md) | The bytes each `Field` kind writes, the brands that change them, `Packed<T>`, the blob channel, and determinism.                   |
| [transformer.md](transformer.md) | Which calls the transformer transforms, how each type is classified, what it emits, and the diagnostics it reports.                |

Which specifications are still planned, what each one owns, and where its
content lives today are in
[../future-work/documentation-restructure.md](../future-work/documentation-restructure.md).
Each is listed here as it lands.
