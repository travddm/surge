# Future work: documentation gaps and stale statements

Part of the [surge](../architecture.md) design.

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
READMEs point at design docs instead.

**Statements the code contradicts** (each checked against the source):

- [transformer.md](../transformer.md) opens with "This is the
  `transformer/` package"; it is a separate repository.
- Type Coverage in transformer.md says `CFrame` gets a size optimization
  inside `Packed<T>`; the Risks section of the same document says it is
  not implemented. The table row should state the implemented behavior.
  (The `optional` half of this entry is resolved: packed `optional` has
  landed, and `DataType.Packed`'s JSDoc is now accurate.)
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
  representative shapes"; there are six tests (eight assertions) over two
  files.
- [serde.md](../serde.md) says the factories are "declared here as
  ambient generics" with "no real runtime body"; they have a body that
  throws.
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
- Benchmarking strategy in [testing.md](../testing.md) leaves it
  "unconfirmed either way" whether Zap exposes callable functions for
  `type` declarations. Resolved by reading Zap 0.6.29: only recursive
  declarations get `write_X`/`read_X`, and the `types` table holding them
  is module-local, so there is no callable Zap codec (see
  [benchmark-tooling.md](benchmark-tooling.md)).
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

User documentation should be written against fixed behavior, so
`docs/usage.md` comes late in [README.md](README.md)'s order. The
stale-statement checklist does not need to wait. One group of entries is
resolved by code and not by prose: the packed `CFrame` statement (Tier A
item 3 of
[type-coverage-parity.md](type-coverage-parity.md)). Until that lands, the
prose must state the implemented behavior. Every other entry describes
behavior that is already final.

## How, briefly

- `docs/usage.md` (install, plugin entry, example, supported types, wire
  format, errors, non-guarantees, the `--!native`/`//!native` opt-in noted
  in [generated-code-performance.md](generated-code-performance.md)),
  linked from both READMEs.
- Correct each stale statement in place as its fix lands; the list above
  is the checklist.
- `CHANGELOG.md` and a short release section in serde.md (tag both
  repositories with the same version; see
  [ci-and-release.md](ci-and-release.md)).
