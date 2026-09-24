# Future work: documentation gaps and stale statements

Part of the [surge](../architecture.md) design. The statements the move in
[documentation-restructure.md](documentation-restructure.md) corrects as it
rewrites each page, and the process documents a first release needs.

## What

**Statements the code contradicts** (each checked against the source):

- `rbxts-transformer-surge/README.md` tells VS Code users to run the
  `mise: ci` task; the tasks are labeled `transformer: ci` and `surge: ci`
  (renamed for the multi-root workspace, per
  [contributing.md](../contributing.md)).
- Implementation status in architecture.md says steps 0 to 8 are "built
  and verified, end-to-end"; the bugs recorded in this directory show the
  verification was the eight round-trip facts, not the Type Coverage
  table.

**Missing process documentation.** No `CHANGELOG`, no release or tagging
procedure (getting-started.md asks consumers to pin both repos to the same
release, and neither repository has a tag), no contributor guide beyond
the tooling description, no statement of which Roblox, roblox-ts, and
`@rbxts/types` versions the generated code targets.

## Why deferred

The stale-statement checklist is worked off as each statement is rewritten in
the move [documentation-restructure.md](documentation-restructure.md) plans,
and the process documents wait on the first tagged release
([ci-and-release.md](ci-and-release.md)).

## How, briefly

- Correct each stale statement in place as its fix lands; the list above
  is the checklist.
- `CHANGELOG.md` and a short release section in getting-started.md (tag both
  repositories with the same version; see
  [ci-and-release.md](ci-and-release.md)).
