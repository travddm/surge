# Architecture

How surge's two repositories fit together, and the decisions that shape them.
The documents are indexed in [AGENTS.md](../AGENTS.md).

## Goal

A drop-in alternative to
[flamework-binary-serializer](https://github.com/Fireboltofdeath/flamework-binary-serializer)
(fbs): a `createBinarySerializer<T>()` derived from a TypeScript type alone,
that generates specialized code for each shape at compile time, as
[Zap](https://github.com/red-blox/zap) does from its own schema, instead of
interpreting a schema at run time. It covers fbs's type surface and adds
types fbs cannot express, such as `Record<K, V>` and index-signature
dictionaries. Why generating code is the faster design is in
[research/compile-time-specialization.md](research/compile-time-specialization.md).

## Two packages, two repositories

- **`@rbxts/surge`** (this repository) is the runtime package the generated
  code calls: the scratch-buffer helpers, the packed `CFrame` codec, the blob
  channel, and the `DataType` brands. roblox-ts compiles it to Luau.
  [specs/runtime-api.md](specs/runtime-api.md) specifies it.
- **`rbxts-transformer-surge`**
  ([its repository](https://github.com/travddm/rbxts-transformer-surge)) is
  the TypeScript transformer that replaces each factory call with generated
  code. It is plain Node, runs only at compile time, and has no run-time code.
  [specs/transformer.md](specs/transformer.md) specifies it.

They are separate packages because they are consumed differently: a
transformer is a Node module the compiler loads, and a runtime package ships
Luau into the game. Flamework splits the same way.

They are separate repositories because npm cannot install a package from a
subdirectory of a git repository. The `github:owner/repo#ref::path:subdir`
form parses, but the installer ignores the subdirectory and installs the
whole repository under the root `package.json`'s name. Each package is
therefore the root of its own repository, installed with a `github:`
dependency ([getting-started.md](getting-started.md)).

The cost is the version coupling a single repository would have given for
free. The generated code calls the runtime package's helpers with no version
negotiation, so the two work together only at the versions they were built
against, and nothing checks that a consumer's two refs match
([specs/runtime-api.md](specs/runtime-api.md) section 6). Consumers pin both
to the same tag; [future-work/ci-and-release.md](future-work/ci-and-release.md)
holds the backstop.

## Repository layout

```text
surge/                  @rbxts/surge
├── src/                the runtime package, compiled by roblox-ts to out/
├── test/               golden checks on the compiled Luau (plain Node)
├── tests/              a standalone npm project: the round-trip suite and
│   ├── src/tests/      the benchmark harness, built through the real
│   ├── src/bench/      transformer and this package
│   └── scripts/        the Lune shim and runners, and the Studio runner
├── docs/               all documentation for both repositories
├── AGENTS.md           the entry point for contributors
└── mise.toml, eslint.config.ts, .prettierrc, cspell.json, .markdownlint.json,
    .github/workflows/, .vscode/, .githooks/, surge.code-workspace

rbxts-transformer-surge/
├── src/                detection, the walk, the Field IR, and the emitter
├── test/               Jest suites, with a stand-in for @rbxts/surge's declarations
├── AGENTS.md
└── the same tooling files, for a plain Node package
```

## How the two are built together

`tests/` depends on both packages, on this one through `file:..` and on the
transformer through `file:../../rbxts-transformer-surge`, so the repositories
are checked out side by side. `tests/.npmrc` sets `install-links=true`, so
each is packed and built by its own `prepare` script exactly as a consumer's
install builds it, rather than linked
([specs/test-harness.md](specs/test-harness.md) section 6).

`tests/` is its own npm project, not a workspace member, because roblox-ts
resolves `@rbxts/*` packages only from a `node_modules/@rbxts` directory
beside the project's own `tsconfig.json`, and rejects a `typeRoots` anywhere
else.

Neither repository commits compiled output. Each builds it in `prepare`, so a
`github:` install clones the repository, installs its devDependencies, and
compiles before the package can be used.

## Against fbs as a drop-in

fbs needs no `tsconfig.json` entry of its own, because it runs inside
Flamework's transformer, which a Flamework project already registers. surge
needs a second `plugins` entry. Moving from fbs is an import path change plus
that one `tsconfig.json` edit.

## Non-goals

Zap's other speed contributors belong to a networking layer, not a
serializer: batching events per frame, reliable and unreliable channels, and
the fire and listen API. surge produces a serializer and deserializer pair,
which can sit under a networking layer, including Flamework's, without
replacing it. A networking layer of surge's own is deferred to
[future-work/networking.md](future-work/networking.md).
