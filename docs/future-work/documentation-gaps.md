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
- Type Coverage in transformer.md: enums use "a compile-time-computed
  `{[EnumItem]: index}` lookup table emitted as a module constant"; the
  emitter produces a ternary chain (see [enum-encoding.md](enum-encoding.md)).
- Type Coverage in transformer.md says `Packed<T>` bit-packs `optional`
  and applies the `CFrame` optimization; the Risks section of the same
  document says neither is implemented. The table and the `Packed<T>`
  subsection should state the implemented behavior.
- `surge/src/data-type.ts`'s JSDoc for `Packed<T>` (the one users see in
  their editor) says "`boolean`/`optional` fields inside collapse to 1 bit
  each"; only `boolean` does.
- `surge/src/pack.ts` refers readers to "docs/future-work/ (or the
  follow-up noted in transformer.md)" for packed `CFrame`; no such
  document existed before this review.
- `rbxts-transformer-surge/src/field.ts` says the emitter is
  `emit-write.ts`/`emit-read.ts`; it is `emit.ts`.
- Risks in transformer.md: "a flat sequence of hundreds of
  `buffer.writeXX` calls with no local declarations does not approach"
  the 200-locals limit; the emitter declares two locals per field and
  fails at 100 (see
  [generated-code-performance.md](generated-code-performance.md)).
- Transformer Design §3 claims order is independent of file and iteration
  state; literal and guarded unions are not (see
  [wire-format-determinism.md](wire-format-determinism.md)).
- Type Coverage in transformer.md lists `Instance` as `blob`; it is
  walked structurally (see [blob-classification.md](blob-classification.md)).
- [testing.md](../testing.md) describes `@Theory`/`@InlineData` cases and
  seeded fuzz loops per shape; none exist (see
  [round-trip-test-coverage.md](round-trip-test-coverage.md)). It also
  says golden checks cover "a curated set of representative shapes"; there
  are three regex checks over two files.
- [serde.md](../serde.md) says the factories are "declared here as
  ambient generics" with "no real runtime body"; they have a body that
  throws.
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

User documentation should be written against fixed behavior; several of
the contradictions above are resolved by fixing the code rather than the
prose, so the docs pass belongs after those fixes.

## How, briefly

- `docs/usage.md` (install, plugin entry, example, supported types, wire
  format, errors, non-guarantees), linked from both READMEs.
- Correct each stale statement in place as its fix lands; the list above
  is the checklist.
- `CHANGELOG.md` and a short release section in serde.md (tag both
  repositories with the same version; see
  [ci-and-release.md](ci-and-release.md)).
