# @rbxts/surge: installation

Part of the [surge](architecture.md) design. How a consumer installs
`@rbxts/surge` and `rbxts-transformer-surge`. What the runtime package
guarantees — its API, what `deserialize` does with input it did not write,
the helpers generated code calls, and the version coupling between the two
packages — is specified in [specs/runtime-api.md](specs/runtime-api.md). This
page is replaced by `getting-started.md` when the user pages are written.

## Package name and distribution

Neither package is published to the npm registry, and both carry
`"private": true` as a safeguard against an accidental publish. A consumer
installs each directly from its own repository:

```json
"@rbxts/surge": "github:travddm/surge#<ref>",
"rbxts-transformer-surge": "github:travddm/rbxts-transformer-surge#<ref>"
```

`<ref>` is a branch, tag, or commit SHA; pin to a tag or a commit for
anything beyond local experimentation, as with any other git dependency. Pin
both `<ref>`s to the same release and update them together: the generated
code calls the runtime package's helpers with no version negotiation, and
nothing checks that the two match (Runtime API 6.1 and 6.2 in
[specs/runtime-api.md](specs/runtime-api.md)). Keeping them matched is a
release discipline until a tooling backstop exists. Why the two are separate
repositories rather than one is in Repository layout in
[architecture.md](architecture.md).

Neither repository commits its compiled output. Each is gitignored on `out/`
or `lib/` and ships a `"files"` entry (`["out"]` / `["lib"]`) with a
`"prepare"` script that builds it, so a git-dependency install still ends up
with compiled output: npm clones the repository, runs `npm install` with its
devDependencies, runs `prepare`, and only then packs `"files"` into what is
installed. The cost against a registry install is that every consumer's
`npm install` clones the whole repository, installs a full devDependency set,
and runs a roblox-ts compile (or a plain `tsc` compile, for the transformer)
before the package can be used, which needs an internet-connected
`roblox-ts` and `@rbxts/*` install to succeed on the consumer's machine. An
install of each repository as a `git+file://` dependency from a scratch
consumer produces a working `out/init.luau` and `lib/index.js`.
