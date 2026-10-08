# Architecture

How surge's two packages fit together in one repository, and the decisions
that shape them. The documents are indexed in [AGENTS.md](../AGENTS.md).

## Goal

A `createCodec<T>()` derived from a TypeScript type alone, that
generates specialized code for each shape at compile time, as
[Zap](https://github.com/red-blox/zap) does from its own schema, instead of
interpreting a schema at run time as
[flamework-binary-serializer](https://github.com/Fireboltofdeath/flamework-binary-serializer)
(fbs) does. It covers fbs's type surface and adds types fbs cannot express,
such as `Record<K, V>` and index-signature dictionaries. Its API is shaped by
what the generated code returns, not by fbs's: `serialize` returns a bare
buffer for a type with nothing to pass beside the bytes
([specs/runtime-api.md](specs/runtime-api.md) 3.6). Why generating code is
the faster design is in
[research/compile-time-specialization.md](research/compile-time-specialization.md).

## Two packages, one repository

- **`@rbxts/surge`** (`surge/`) is the runtime package the generated code
  calls: the scratch-buffer helpers, the packed `CFrame` codec, and the
  `DataType` brands. roblox-ts compiles it to Luau.
  [specs/runtime-api.md](specs/runtime-api.md) specifies it.
- **`rbxts-transformer-surge`** (`rbxts-transformer-surge/`) is the
  TypeScript transformer that replaces each factory call with generated code.
  It is plain Node, runs only at compile time, and has no run-time code.
  [specs/transformer.md](specs/transformer.md) specifies it.

They are separate packages because they are consumed differently: a
transformer is a Node module the compiler loads, and a runtime package ships
Luau into the game. Flamework splits the same way.

They share one repository so that every commit holds a pair that works
together. The generated code calls the runtime package's helpers with no
version negotiation, so the two work together only at the versions they were
built against ([specs/runtime-api.md](specs/runtime-api.md) section 6). CI
checks both packages at each commit, and a change that spans both is one
commit. A consumer installs both at the same version;
[future-work/ci-and-release.md](future-work/ci-and-release.md) holds the
backstop that would check it.

npm cannot install a package from a subdirectory of a git repository: the
`github:owner/repo#ref::path:subdir` form parses, but the installer ignores
the subdirectory and installs the repository root. Neither package is
released yet. A release publishes each package to the npm registry from its
own directory, and a one-package tag, on a commit whose root is one package's
directory, lets another project install a build from git
([future-work/one-package-tags.md](future-work/one-package-tags.md) and
[future-work/ci-and-release.md](future-work/ci-and-release.md)).

## Repository layout

```text
surge/                        the repository
├── surge/                    @rbxts/surge
│   ├── src/                  the runtime package, compiled by roblox-ts to out/
│   ├── test/                 golden checks on the compiled Luau (plain Node)
│   └── tests/                a standalone npm project: the round-trip suite and
│       ├── src/tests/        the benchmark harness, built through the real
│       ├── src/bench/        transformer and this package
│       └── scripts/          the Lune shim and runners, and the Studio runner
├── rbxts-transformer-surge/  the transformer
│   ├── src/                  detection, the walk, the Field IR, and the emitter
│   └── test/                 Jest suites, with a stand-in for @rbxts/surge's declarations
├── docs/                     all documentation for both packages
├── AGENTS.md                 the entry point for contributors
└── mise.toml, package.json, cspell.json, .prettierrc, .markdownlint.json,
    .github/workflows/, .vscode/, .githooks/, surge.code-workspace
```

Each package's directory also holds its own tooling: `package.json` and its
lock file, `mise.toml`, `eslint.config.ts`, `.prettierrc`, `cspell.json`,
`.markdownlint.json` and `.vscode/`. The root's npm project checks only
`docs/` and the root files; it is not an npm workspace.

## How the two are built together

`surge/tests/` depends on both packages, on surge through `file:..` and on
the transformer through `file:../../rbxts-transformer-surge`.
`tests/.npmrc` sets `install-links=true`, so each is packed and built by its
own `prepare` script exactly as a consumer's install builds it, rather than
linked ([specs/test-harness.md](specs/test-harness.md) section 6).

`tests/` is its own npm project, and the repository uses no npm workspaces,
because roblox-ts resolves `@rbxts/*` packages only from a
`node_modules/@rbxts` directory beside the project's own `tsconfig.json`, and
rejects a `typeRoots` anywhere else.

Neither package commits compiled output. Each builds it in `prepare`, which
runs when the package is packed: for a publish, and for a git install, which
clones the repository, installs the package's devDependencies, and compiles
before the package can be used.

## Non-goals

Zap's other speed contributors belong to a networking layer, not a
serializer: batching events per frame, reliable and unreliable channels, and
the fire and listen API. surge produces a serializer and deserializer pair,
which can sit under a networking layer, including Flamework's, without
replacing it. A networking layer of surge's own is deferred to
[future-work/networking.md](future-work/networking.md).
