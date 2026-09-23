# Future work: documentation gaps and stale statements

Part of the [surge](../architecture.md) design. The user pages this
document asks for are one part of
[documentation-restructure.md](documentation-restructure.md), which plans
the whole `docs/` tree around its readers; the stale-statement checklist
below is worked off during that move.

## What

**No user-facing documentation.** Everything under `docs/` is design
history written for the maintainer. A consumer has nowhere to find:
installation (both `github:` dependencies, pinned together), the
`tsconfig.json` `plugins` entry and its ordering relative to Flamework's
transformer, a usage example, the supported-types table in user terms
(what is encoded how, what becomes a blob, what is rejected), the wire
format per kind (needed to interoperate with anything else and to reason
about [schema-versioning.md](schema-versioning.md)), the error contract
of `deserialize`, and the non-guarantees (dict order, no bounds checks,
sparse arrays, `@rbxts/types` version coupling of enum indices). The two
READMEs point at design docs instead. Until `docs/usage.md` exists,
nothing outside this directory tells a consumer to mark a serializer
module `//!native` and `//!optimize 2`: `benchmarks/speed.md` used to
carry the recommendation and no longer does, because a generated results
file states what was measured and does not advise.

**Statements the code contradicts** (each checked against the source):

- [transformer.md](../transformer.md) opens with "This is the
  `transformer/` package"; it is a separate repository.
- Type Coverage in transformer.md describes `blob` as "`unknown`,
  `Instance` (and subclasses), any other type this design can't
  structurally encode". The catch-all is wrong since
  [blob-classification.md](blob-classification.md) landed: function,
  `symbol`, `bigint`, `null`, template-literal, and
  index-signature-plus-properties types are rejected with a diagnostic, and
  transformer.md does not mention those diagnostics.
- The `guardedUnion` row of the same table says a union of two or more
  table-shaped variants gets "generated structural guards". Risks in the
  same document says the transformer reports a build-time error instead,
  which is what `classifyUnion` does.
- The last paragraph of transformer.md lists "the lack of automated
  runtime CI" as an open item; the round-trip suite runs in CI under Lune,
  and only benchmark automation is open (see
  [headless-ci.md](headless-ci.md)).
- [testing.md](../testing.md) says golden checks cover "a curated set of
  representative shapes"; there are 13 tests in one file,
  `test/golden.test.mjs`, each pinning one decision rather than sampling
  shapes. The count was six when this entry was written.
- Comments name future-work documents that were deleted when their fixes
  landed: `test/golden.test.mjs` (`recursive-union-types.md`,
  `wire-format-determinism.md`) and `tests/src/tests/coverage.spec.ts`
  (`walk-type-identity.md`, `recursive-union-types.md`,
  `wire-format-determinism.md`). Each should name Transformer Design in
  transformer.md, which now describes the corrected behavior.
- `rbxts-transformer-surge/README.md` and Static verification in
  [testing.md](../testing.md) tell VS Code users to run the `mise: ci`
  task; the tasks are labeled `transformer: ci` and `surge: ci` (renamed
  for the multi-root workspace, per architecture.md).
- Implementation status in architecture.md says steps 0 to 8 are "built
  and verified, end-to-end"; the bugs recorded in this directory show the
  verification was the eight round-trip facts, not the Type Coverage
  table.

**Missing process documentation.** No `CHANGELOG`, no release or tagging
procedure (serde.md requires consumers to pin both repos to the same
release, and neither repository has a tag), no contributor guide beyond
the tooling description, no statement of which Roblox, roblox-ts, and
`@rbxts/types` versions the generated code targets.

## Why deferred

User documentation should be written against fixed behavior. What moved it
has since landed: `deserialize`'s error contract is settled (section 4 of
[specs/runtime-api.md](../specs/runtime-api.md)), and what is
left of Tier B in [type-coverage-parity.md](type-coverage-parity.md) adds a
row to the supported-types table rather than changing one.

Two parts of this document do not wait, and README.md lists both under No
step of its own. The stale-statement checklist does not, because every entry
describes behavior that is already final. Neither do the two Luau file
directives, because they depend on neither step and nothing outside this
directory states them.

## How, briefly

- `docs/usage.md` (install, plugin entry, example, supported types, wire
  format, errors, non-guarantees, and the two Luau file directives — both
  recommended as defaults, with the module shape that makes `//!native` safe
  to default to, per The file-directive recommendation in
  [generated-code-performance.md](generated-code-performance.md)),
  linked from both READMEs. The directives section can be written and
  linked before the rest, since it depends on no open step. The wire-format
  section must state each container's default length width and that
  `DataType.Length<T, L>` changes it, and the three `f32`s a `Vector3` and a
  `CFrame`'s position cost by default and that `DataType.Vector<X, Y, Z>` and
  `DataType.Transform<X, Y, Z>` change them. Each default is part of the
  decision in [data-type-surface.md](data-type-surface.md) rather than a
  detail of it.
- Correct each stale statement in place as its fix lands; the list above
  is the checklist.
- `CHANGELOG.md` and a short release section in serde.md (tag both
  repositories with the same version; see
  [ci-and-release.md](ci-and-release.md)).
