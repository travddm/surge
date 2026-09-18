# surge: architecture

## Goal

Provide a drop-in-ergonomic alternative to
[flamework-binary-serializer](https://github.com/Fireboltofdeath/flamework-binary-serializer)
(fbs) — `createBinarySerializer<T>()`-style, derived purely from a
TypeScript type — that reaches
[Zap](https://github.com/red-blox/zap)-level serialization performance by
generating specialized code per shape at compile time, instead of
interpreting a schema at runtime, while covering fbs's full supported type
surface and extending it with a few TypeScript-idiomatic types fbs cannot
express (`Record<K, V>` / index-signature dictionaries).

## Documents in this design

This document is the entry point: repository shape, cross-cutting
decisions, and the overall build order. Each package/workstream has its
own doc for the detail that belongs to it:

- [transformer.md](transformer.md) — `rbxts-transformer-surge`: why the
  schema-time-specialization approach works (including the fbs/Zap source
  reading and the spike that proved it compiles), the transformer's
  detection/type-walk/codegen design, and the full type coverage table.
- [serde.md](serde.md) — `@rbxts/surge`: the runtime package the
  generated code calls into, and its public API surface.
- [coding-standards.md](coding-standards.md) — lint/format/spell tooling
  and style conventions (each repo keeps its own copy — see below).
- [testing.md](testing.md) — testing and verification strategy for the
  whole stack.
- [future-work/](future-work/) — deferred capabilities with no design yet
  (the `surge-net` networking layer, schema evolution/versioning, and a
  headless CI runner), plus the findings of the September 2026 adversarial
  review: confirmed correctness bugs, determinism gaps, and test, benchmark,
  documentation, and CI coverage gaps, one document per unit of work.

## Repository layout

**Two separate repositories, not a monorepo** — reversed from an earlier
draft of this document after empirically confirming (not just reading
source) that npm's `github:owner/repo#ref::path:subdir` syntax does not
work: `npm-package-arg` parses `::path:` into a `gitSubdir` field, but
nothing downstream in `pacote`/`@npmcli/arborist` ever reads that field —
confirmed by grepping the entire dependency tree of the npm actually
installed on the build machine, both a `v11.5.2`-bundled and a separately
installed `v21`-bundled `pacote`, and then by a real repro: an
`npm install "git+file://<repo>#<ref>::path:sub"` against a throwaway repo
with a subdirectory package installed the _entire_ repository, named
after the _root_ `package.json` (not the subdirectory's), with the
subdirectory just nested inside it — unusable as a dependency. A
monorepo's "one repo, one version, both packages always compatible"
convenience isn't worth shipping something that doesn't install — but
that convenience was doing real work, worth stating plainly now that it's
gone rather than dropping it silently: `rbxts-transformer-surge` emits
calls straight into `@rbxts/surge`'s runtime helpers (`alloc()`, the blob
channel) with no version-negotiation of any kind, so the two only ever
work together at exactly one version each was built against, and nothing
now enforces "released together, same version" the way one repo's
package-lock did — see Package name and distribution in
[serde.md](serde.md) for the manual tag-pinning this now requires instead.
This repo (`travddm/surge`) is this package's own root:

```text
surge/                 = @rbxts/surge itself
├── src/                the runtime source, compiled by roblox-ts
├── out/                compiled output (main/types point here; gitignored,
│                       rebuilt by `prepare` on every install — see serde.md)
├── test/               golden-Luau invariant checks (plain Node, node:test;
│                       reads tests/out — see testing.md)
├── tests/              private nested project (own package.json, own
│                       node_modules): the @rbxts/runit round-trip and
│                       benchmark suites, depending on this package via
│                       `file:..` and on rbxts-transformer-surge via
│                       `file:../../rbxts-transformer-surge` for local
│                       development (see testing.md)
│   └── scripts/         Lune test runner + shim (round-trip suite) and the
│                        run-in-roblox script + wrapper (benchmark suite;
│                        see testing.md)
├── docs/               this design, in full — the transformer repo only
│                       keeps a README pointing back here
├── package.json        the shipped package manifest itself
├── mise.toml, eslint.config.ts, .prettierrc, cspell.json,
│   .markdownlint.json  this repo's own tooling (see coding-standards.md)
├── .github/workflows/  runs `mise run ci`'s steps on every push/PR
├── .vscode/            tasks.json maps every mise task to a VS Code
│                       task (see coding-standards.md)
└── .githooks/           opt-in pre-push hook running `mise run ci`
                        locally, for contributors who push before CI
                        would catch it
```

`rbxts-transformer-surge` lives in its own sibling repository
(`travddm/rbxts-transformer-surge`), with the identical tooling shape
(its own `mise.toml`/`eslint.config.ts`/etc.) scoped to a plain
Node/CommonJS package — no roblox-ts, no `tests/`. See
[serde.md](serde.md) for exactly how a consumer installs each.

- **`@rbxts/surge`** (this repo) — the runtime support package the
  transformer's generated code calls into, _and_ the `@rbxts/runit`
  round-trip/benchmark suite that exercises both packages together. See
  [serde.md](serde.md) and [testing.md](testing.md).
- **`rbxts-transformer-surge`** (sibling repo) — the TS transformer. No
  runtime code. See [transformer.md](transformer.md) for its design.
- **`surge-net`** (future-work, not started) — the deferred networking
  layer. See [future-work/networking.md](future-work/networking.md).
  (Renamed from an earlier draft's `@rbxts/surge`, once `@rbxts/surge`
  was reassigned to the serializer runtime itself — the thing actually
  being built — rather than kept reserved for networking.)

**Why the transformer isn't just folded into this repo too:** it could
be (a single-repo, single-package shape closer to fbs's own
`@rbxts/flamework-binary-serializer`, which piggybacks on Flamework's
already-registered transformer). Kept separate instead, matching
Flamework's own precedent (`rbxts-transformer-flamework` and
`@flamework/core` are separate repos): a transformer is a plain
Node/CommonJS tool loaded by the TS compiler process, and a
roblox-ts-compiled runtime is a package that ships Luau — different
enough consumption models that bundling them doesn't buy much once they
can no longer share one repo's `node_modules`/build step for free. The
two are still developed against each other as if they were one project
(this repo's `tests/` depends on both, as a sibling checkout locally),
just not distributed as one.

**Confirmed in step 0.** roblox-ts resolves `@rbxts/*` (and
`@flamework/*`) packages from a `node_modules/@rbxts` directory that must
sit directly under the same directory as the project's own tsconfig.json —
confirmed by reading roblox-ts 3.0.0's own source
(`createProjectData.js`'s `nodeModulesPath`, derived from
`ts.findPackageJson` walking up from that directory, and
`validateCompilerOptions.js`'s `validateTypeRoots`, which hard-errors if
`typeRoots` points anywhere else). This no longer needs a workaround the
way an earlier npm-workspaces draft of this repo did (that fix, and the
hoisting problem it worked around, no longer exist now that `tests/` is
its own standalone npm project with its own `node_modules` rather than a
workspace member sharing a hoisted one): every one of `tests/`'s
dependencies — `@rbxts/surge`, `rbxts-transformer-surge`,
`@rbxts/runit`, `@flamework/core` — installs directly into
`tests/node_modules` where roblox-ts expects it, no symlink shim needed.

This does mean a real ergonomic cost against the Goal's "drop-in"
framing, worth stating plainly rather than glossing over: an existing fbs
user adds nothing to `tsconfig.json` `plugins` to use it — they only need
Flamework's transformer, which a Flamework project already has
registered. A user adopting this design's transformer must add a second,
separate `plugins` entry themselves. Migration is an import-path change
_plus_ one `tsconfig.json` edit, not import-path-only.

### Editing both repos together

`surge.code-workspace`, checked into this repo's root, is a VS Code
multi-root workspace covering both repos at once (its second folder entry
is `../rbxts-transformer-surge`, so it still expects the sibling-checkout
layout from Repository layout above), for exactly the "developed against
each other as if they were one project" reason above — opening just one
repo's folder loses the other's code navigation and task list while
working across the boundary between them. It's checked in specifically so
contributors don't have to hand-reconstruct its settings (task buttons,
the shared TS SDK path, icon associations) themselves; it's also entirely
optional — nothing here depends on it, and a contributor not using VS
Code, or using it on one repo at a time, never needs it.

Multi-root workspaces have a real settings-scope gotcha, confirmed
against each extension's own `package.json` (its
`contributes.configuration.properties[…].scope`) and VS Code's own
documented default (`window`, when a setting declares no `scope` at
all) rather than assumed: **only resource-scoped settings are read from
a folder's own `.vscode/settings.json` when that folder is part of a
multi-root workspace** — window-scoped settings placed there are
silently ignored, and only take effect when that same folder is opened
standalone instead. `VsCodeTaskButtons.*`
(`spencerwmiles.vscode-task-buttons`, see
[coding-standards.md](coding-standards.md)), `material-icon-theme.*`,
and `js/ts.tsdk.path`/`js/ts.tsdk.promptToUseWorkspaceVersion` are all
window-scoped this way (none of the three declares a `scope` at all).
`surge.code-workspace` carries its own top-level `settings` block with
the equivalent for these three — this is why both repos' `.vscode/`
configs exist twice: once per folder (for a standalone open of that
folder alone) and once combined in the workspace file (for this combined
one).

`luau-lsp.sourcemap.*`/`luau-lsp.ignoreGlobs` (`JohnnyMorganz.luau-lsp`)
looked at first like the same problem, but isn't: they're explicitly
**resource**-scoped in that extension's own `package.json`, so
`surge/.vscode/settings.json`'s copy already applies correctly to
`surge`'s files even in this multi-root workspace — putting them in the
workspace file too, as a first attempt did, was wrong, and caused a
second bug instead of fixing anything: a workspace-level value for a
resource-scoped setting still applies as the fallback default to any
folder that doesn't set its own, and `rbxts-transformer-surge` never
did, so it started running `surge`'s Rojo sourcemap command against
itself and failing (confirmed by the resulting error explicitly naming
that folder). The real bug was always that `rbxts-transformer-surge`
has zero Luau — a pure Node/CommonJS repo — but luau-lsp still
instantiates once per workspace folder regardless, so it fell back to
its own compiled-in default `rojoProjectFile`
(`"default.project.json"`, which doesn't exist there either) and
errored on a Rojo project that was never supposed to exist in that
folder at all. The fix is a per-folder opt-out, not a shared value:
`rbxts-transformer-surge/.vscode/settings.json` sets
`"luau-lsp.sourcemap.enabled": false` directly, and nothing about
`luau-lsp` appears in `surge.code-workspace` itself.

This forced a second, real fix, not just a settings-scope workaround:
`vscode-task-buttons` has no way to tell apart two tasks with the same
label from different folders (confirmed against its own README) — both
repos' `.vscode/tasks.json` originally used the same bare `mise: <task>`
labels, which collide once both are visible in one
window. Each repo's tasks are labeled `surge: <task>` /
`transformer: <task>` instead, specifically so the workspace file's
combined task-button config can address both unambiguously; the
per-folder `settings.json` files were updated to match, so the buttons
still work the same way when a repo is opened standalone.

`js/ts.tsdk.path` in the workspace file is just `node_modules/typescript/lib`
— relative to the _first_ workspace folder (`surge`), not to this file's
own directory, confirmed by a doubled `surge/surge/...` path in the TS
server's own "falling back to bundled TypeScript" log when it was
written as `surge/node_modules/typescript/lib` instead. Since both repos
pin the identical TypeScript version (`5.5.3`), either folder's install
would resolve the same language service either way, so pointing at
`surge`'s specifically is an arbitrary but harmless choice, not a real
dependency on it.

## Non-goals

Zap's other headline speed contributors are networking-layer, not
serializer-layer, and are explicitly out of scope for
`rbxts-transformer-surge` and `@rbxts/surge`: per-`Heartbeat` event
batching, reliable/unreliable channel semantics, and the Fire/On dispatch
API. These two packages produce a serializer/deserializer pair, not a
networking layer — it can sit underneath one (including fbs's own current
use inside Flamework networking) without replacing it. This is not
permanently out of scope for the _project_: see
[future-work/networking.md](future-work/networking.md) for the deferred
`surge-net` package this belongs to.

## Suggested implementation order

Test infrastructure is not a final step — it comes online with step 0 and
every later step adds its own fixtures/benchmark rows to the same harness,
so no increment ships unverified against the previous one.

**Implementation status:** steps 0–8 below are built and verified,
end-to-end, across both repos: `mise run ci` in `rbxts-transformer-surge`
(lint/format/spell/compile, plus its Jest unit suite — type-walk
classification, name-sort/variant-sort determinism, diagnostic rejection);
`mise run ci` in this repo (lint/format/spell/compile, then installing and
compiling `tests/` against the transformer and this package exactly as a
real consumer would — `file:` dependencies with `install-links=true`,
packed and `prepare`-built, not symlinked — then actually running the
`@rbxts/runit` round-trip suite headlessly under Lune, via a fake-Instance
shim adapted from an existing solution to the same problem in another
project (see "Round-trip tests run under Lune" in testing.md), followed by the
golden-Luau invariant checks against that same compiled output); and real
`createBinarySerializer<T>()` fixtures in `tests/src/tests/*.spec.ts`
compiled through both, actually executed, not just compiled. The two-repo
distribution model itself was verified the same way, not just documented:
a local `git init`-and-install repro
against both restructured repos (see serde.md) confirmed a
`github:`-style whole-repo install actually produces a working
`out/init.luau`/`lib/index.js`. Two narrower gaps are carried inside step
6 and step 8 rather than blocking them (see Risks in
[transformer.md](transformer.md)): `Packed<T>` bit-packs `boolean` fields
only, not `optional`/`cframe`; and the structurally-ambiguous guarded-union
case is a compile-time error, not guard codegen, exactly as step 8 always
scoped it to be. Step 9 (the in-Studio benchmark run) is not done — it
requires Roblox Studio, which this design has never assumed access to (see
testing.md); the benchmark suite itself is written, not executed, so no
performance numbers are claimed anywhere in these docs.

0. This repo's `package.json` (the `@rbxts/surge` manifest itself), the
   `mise`-pinned toolchain (`node`, `rojo`), the `tests/` Rojo place and
   `@rbxts/runit` wiring (empty suites) as its own standalone npm project,
   and the plain-Node golden-Luau check skeleton in `test/` — before any
   `Field` kind exists, so step 1 onward has somewhere to put its tests.
   The transformer repo gets the identical tooling shape independently
   (its own `mise.toml`/ESLint/Prettier/cspell, its own Jest unit-test
   skeleton), so every later step's diff in either repo is checked by that
   repo's own `mise run ci` from the start rather than retrofitted (see
   [coding-standards.md](coding-standards.md) and Static Verification in
   [testing.md](testing.md)). Confirms the build order — the transformer
   repo built and installed into `tests/` before `tests/` compiles,
   `tests/` loading `rbxts-transformer-surge` as a `tsconfig.json` plugin
   by package name — actually works, and confirms `tests/`'s roblox-ts
   install actually resolves `@rbxts/surge` (see the confirmed finding
   under Repository Layout) before any later step depends on it.
   (Signature-based detection itself — Transformer Design §1 in
   [transformer.md](transformer.md) — was already de-risked via the same
   spike, before it was removed, so step 0 doesn't need to redo that
   part.)
1. This package: growable scratch buffer + `alloc()` cursor helper, blob
   side-channel, `Serializer<T>` bundled API.
2. Transformer: primitives + plain objects + optional fields (serialize and
   deserialize), matching the spike's proof but through the real IR
   builder, with signature-based detection and name-sorted field order.
   First round-trip tests and first benchmark rows (the small-flat-struct
   and deeply-nested-object cases) land here.
3. Arrays, tuples, maps, sets, `Record`/index-signature dictionaries
   (variable-length handling, backpatched counts). Adds the
   large-array/`Record` benchmark row.
4. Roblox types (`Vector3`, `CFrame`, `Color3`, sequences), `EnumItem` with
   compile-time index lookup, `blob`/`Instance` passthrough. Adds the
   enum-heavy benchmark row (the concrete O(1)-vs-`indexOf` comparison).
5. Literal types (multi-value and zero-byte single-value) and discriminated
   unions. Adds the union-heavy benchmark row.
6. `Packed<T>`: bit-packing for `boolean`/`optional`/`cframe` inside an
   opted-in subtree. Adds the packed-vs-unpacked benchmark row pair.
7. Recursive type support (named helper functions + cycle detection). Adds
   the large-shape (hundreds of fields) benchmark row and the
   corresponding golden-Luau check that scope-splitting only kicks in
   where actually needed (see Risks in [transformer.md](transformer.md)).
8. Guarded unions: primitive/at-most-one-object-variant case first (no
   guard codegen needed); structurally-ambiguous multi-object-variant case
   as a separate, explicitly scoped follow-up (see Risks in
   [transformer.md](transformer.md)).
9. Full benchmark suite run, inside Roblox Studio via the `tests` place,
   against both baselines (fbs and the hand-written flat serializer — see
   [testing.md](testing.md)), with results recorded by hand into a
   checked-in benchmark log before publishing any headline performance
   numbers.
