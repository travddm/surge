# Future work: an extension point in the transformer

Part of the [surge](../architecture.md) design.

## What

A way for a package other than `@rbxts/surge`, such as the `surge-net` of
[networking.md](networking.md) or a later DataStore package, to have the
transformer recognize a factory of its own and emit code only that package
knows about, without a transformer release for each package release. The
package would ship its handler as a plugin, and `rbxts-transformer-surge`
would load it.

The goal behind it is that each package is released and updated on its own.
Whether that goal needs this extension point is decided by one question,
asked at each package's design pass: does the package need the transformer
to recognize its own factory, or does it only need a `Codec<T>` value?

## Why deferred

- **A package that takes codecs as values needs no transformer.** A
  `defineEvent(createCodec<Payload>())`, or a function typed on `Codec<T>`
  (Runtime API 3.1 in [specs/runtime-api.md](../specs/runtime-api.md)), makes
  the package a runtime package alone, with its own release cadence and no
  compile-time work. [networking.md](networking.md) already builds
  `surge-net` on `Codec<T>`, and that is the design to try first. The cost is
  one call at each definition.
- **The part a plugin would reuse is the walk and the emitter, not the
  registration.** The entry point in `src/index.ts` is about 600 lines; the
  walk and `src/emit/` are about 8,400. A plugin that emits code for its
  own factory needs the `Field` tree and the emitter as a library, so the
  plugin API is that surface, not a small hook. Every change to the walk and
  the emitter that [README.md](README.md) orders before the first release
  changes it.
  Freezing it into a public contract now would slow the core work, and each
  change to it would break every plugin.
- **It adds a third axis to a version matrix that has no negotiation.** The
  generated code calls `@rbxts/surge/abi` at whatever version the consumer
  installed, and the runtime package and the transformer work together only
  at the versions they were built against (Runtime API 6 in
  [specs/runtime-api.md](../specs/runtime-api.md),
  [architecture.md](../architecture.md)). A plugin inside a package would
  also have to match the transformer's API version. Independent updates
  would hold only for the parts of a package that never touch the tree.
- **Fingerprints and schema versioning stay in the core transformer.**
  [schema-fingerprint.md](schema-fingerprint.md) hashes the `Field` tree, so
  a DataStore package consumes a core factory's output rather than emitting
  code of its own.

## How, briefly

When a package needs compile-time emission of its own, such as an event's
identifier or a dispatch table:

- **One host transformer, not a second one in the consumer's `tsconfig.json`.**
  TypeScript rebuilds the nodes that enclose a replaced call, and a rebuilt
  node has no source file
  ([flamework-macro-interop.md](flamework-macro-interop.md)), so a second
  transformer would read what the first rebuilt. Each transformer also
  injects an import and moves the file's leading comments onto it, so two
  would contend for the first statement, where Luau reads a `--!` directive
  (Transformer 6.3 in [specs/transformer.md](../specs/transformer.md)).
- **A handler registers its factory names and receives the call, the walk
  and the emitter.** Detection by the nearest `package.json` name, as
  `src/detect.ts` does for `@rbxts/surge`, extends to another package's
  name. The handler returns the replacement expression and the imports it
  needs.
- **Discovery rides the plugin entry.** The entry's other keys reach the
  transformer as its `config` argument ([project-config.md](project-config.md)),
  which rules out a separate config file. Either the consumer lists the
  packages there, or the transformer finds a key in each dependency's
  `package.json`. The first is explicit; the second needs no entry per
  package. Decide with the first package that needs it.
- **The plugin API is versioned, and a mismatch is a diagnostic.** A
  package declares the range of `rbxts-transformer-surge` its handler was
  built against, and the transformer reports a package whose range it does
  not meet, with the file and position of the call, as it reports every
  other diagnostic.
- Transformer 3 gains the handler's detection and precedence, and the
  transformer's suites gain a project with a stand-in package that
  registers a factory.
