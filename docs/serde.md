# @rbxts/surge: design

Part of the [surge](architecture.md) design. This is the `@rbxts/surge`
package (this repository's own root — see Repository layout in
architecture.md): the roblox-ts-compiled runtime that
`rbxts-transformer-surge`'s generated code calls into. It has no
code-generation logic of its own — see [transformer.md](transformer.md)
for that.

## What this package ships

- `grow` and `finishWrite`, the two cold ends of the buffer strategy (see
  Transformer Design §4 in [transformer.md](transformer.md)). The scratch
  buffer, its capacity and both cursors belong to each generated serializer,
  not to this package, and reserving bytes is inline in the generated code;
  what is left here is doubling the buffer, which happens once per doubling,
  and copying the used region out, which happens once per `serialize()`.
- The blob/passthrough side-channel array (see Type Coverage → Blob /
  passthrough channel in [transformer.md](transformer.md) for the
  encounter-order indexing rule the transformer's generated code must
  follow when pushing to it — this package owns the array itself, not
  that rule).
- Any small helpers the generated code calls into, including the bit-pack
  writer/reader used only inside `Packed<T>` subtrees (see Type Coverage →
  `Packed<T>` in [transformer.md](transformer.md)).
- `createSerializer`/`createDeserializer`/`createBinarySerializer`,
  declared here as ambient generics the transformer recognizes and
  replaces; they have no real runtime body, same as fbs's
  `@metadata macro` functions today.

For drop-in ergonomic parity, this package exposes the same bundled entry
point fbs does:

```ts
interface Serializer<T> {
	serialize: (value: T) => { buffer: buffer; blobs: defined[] };
	deserialize: (input: buffer, inputBlobs?: defined[]) => T;
}
declare function createBinarySerializer<T>(): Serializer<T>;
```

matching fbs's exact `Serializer<T>` shape and blob-array calling
convention, so existing call sites migrate with an import-path change
(plus the one-time `tsconfig.json` `plugins` entry noted in
[architecture.md](architecture.md), which fbs's users don't need to add).
`createSerializer<T>()`/`createDeserializer<T>()` remain available
individually for callers (e.g. a networking library) that want just one
direction.

## What `deserialize` does with bad input

By default it does not examine the bytes it is given, and promises nothing
about what happens when they are wrong. A `buffer` that no
`serialize` of the same shape produced may raise a Luau `buffer` error,
return a wrong value, or run a loop for as long as a count in the payload
says. Bytes from this game's own `DataStore` are bytes it wrote; bytes from
a remote event are not.

`checks` is how a call site asks it to examine them. It is written as a
literal, because it decides what the transformer emits:

```ts
const fromClient = createBinarySerializer<Move>({ checks: true });
```

With it, every read is bounded against the input's length, and every count
read back is bounded against what the bytes left could hold -- or, for an
element that reads no bytes at all, against a fixed cap. A payload that
fails a bound raises a string beginning `@rbxts/surge:`, so a caller
`pcall`s at the boundary and tells a rejection from a bug in its own code:

```ts
const [ok, result] = pcall(() => fromClient.deserialize(bytes, blobs));
```

Reading past the end of the `inputBlobs` array raises the same way with or
without `checks`, since that read is a call into this package either way.

What `checks` does not do is look at values. A payload whose lengths are
consistent and whose contents are nonsense deserializes into nonsense of
the right shape, and a number that arrives outside the range a caller
expects is the caller's to reject.

Read state -- the input buffer, the read cursor, the blob index -- is reset
at the start of every `deserialize`, so a call that raised leaves nothing
behind for the next one. That is what makes a `pcall` at the boundary
enough on its own.

## Package name and distribution

Not published to the npm registry — neither this package nor
`rbxts-transformer-surge` needs registry publish access at all. Both carry
`"private": true` as a safeguard against an accidental publish.

**The distribution mechanism below was changed once already, after the
first version turned out not to work.** That first version kept both
packages in one monorepo and had consumers install a subdirectory of it
with npm's `github:owner/repo#ref::path:subdir` syntax. That syntax
_parses_ — `npm-package-arg` reads `::path:` into a `gitSubdir` field —
but nothing downstream ever _reads_ that field: grepping the entire
dependency tree of the npm actually used to build this project (checked
against two different bundled `pacote` versions) turns up zero consumers
of `gitSubdir` outside the parser, and a real
`npm install "git+file://<repo>#<ref>::path:sub"` against a throwaway
two-directory test repo confirmed it: npm installs the _entire_ repository
under the _root_ `package.json`'s name, with the requested subdirectory
just nested one level inside — not usable as a dependency. This is why
`@rbxts/surge` and `rbxts-transformer-surge` are two separate repositories
(see Repository layout in [architecture.md](architecture.md)) rather than
one monorepo: a repo's root and an installable package's root have to be
the same directory for a plain `github:owner/repo#ref` install (no `path:`
qualifier at all) to work, and a monorepo can't give both packages that at
once.

A consumer installs each package directly from its own repository:

```json
"@rbxts/surge": "github:travddm/surge#<ref>",
"rbxts-transformer-surge": "github:travddm/rbxts-transformer-surge#<ref>"
```

`<ref>` is a branch, tag, or commit SHA — pin to a tag or commit for
anything beyond local experimentation, the same as any other git
dependency. Pin both `<ref>`s to the _same_ release, and update them
together: `rbxts-transformer-surge` emits calls straight into this
package's runtime helpers with no version-negotiation of any kind, and
nothing checks — at compile time or at runtime — that a consumer's two
`<ref>`s actually match. A monorepo would have enforced this automatically
(one `package-lock.json`, one version of each); across two repos it's a
release-process discipline the two repos' maintainer has to keep by hand
(e.g. tagging both at once) — there's no tooling backstop yet.

Both repos are gitignored on `out/`/`lib/` (the compiled output) and ship
a `"files"` entry (`["out"]` / `["lib"]`) plus a `"prepare"` script that
rebuilds it, so a git-dependency install still ends up with real compiled
output despite it never being committed — npm's documented behavior for
git dependencies is to clone, run `npm install` (pulling in
devDependencies, including `roblox-ts`/`typescript`/`@rbxts/compiler-types`
for this package), run `prepare`, and only then pack `"files"` into what
actually gets installed. The real, concrete cost of this versus committing
built output to the repo: every consumer's `npm install` clones the whole
repo, installs a full devDependency set, and runs a roblox-ts compile (or
a plain `tsc` compile, for the transformer) before it can use the package
at all — slower than an npm-registry install, and dependent on the
consumer's own machine being able to run that build (which, for this
package, means an internet-connected `roblox-ts`/`@rbxts/*` install
succeeding). Verified end-to-end, not just argued: a local
`git init && git add -A && git commit` inside each restructured repo
followed by `npm install "git+file://<path>#<branch>"` from a scratch
consumer produced a working `out/init.luau`/`lib/index.js` under
`node_modules/@rbxts/surge` / `node_modules/rbxts-transformer-surge`
respectively — the same repro that caught the `::path:` syntax not
working, now confirming the replacement does.
