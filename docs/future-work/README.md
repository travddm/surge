# Future work: index and implementation order

Part of the [surge](../architecture.md) design. One document per unit of
work. The order below is the recommended implementation order; each step
names the documents it delivers and why it comes where it does. The sections
after it list work with no step of its own, the first work to revisit after
the first release, and the documents that can be deferred indefinitely.

This directory holds open work only. What the September 2026 review found,
and what has landed since, is in
[research/september-2026-review.md](../research/september-2026-review.md);
[contributing-docs.md](../contributing-docs.md) states the rule.

## Order

| Step | Document                                                                                                                                                                                                    | Why here                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | [write-state-and-joined-reservations.md](write-state-and-joined-reservations.md): a scratch-path `serialize`'s write state in locals, and a string's reservation joined with the fixed-size bytes beside it | The next generated-code speed work. The catalog has the rows and the scoped runs it is measured with.                                                                                                                                                                                                                                                                                                                                                                             |
| 2    | [one-package-tags.md](one-package-tags.md): pre-release tags on `master`, and dev tags on request                                                                                                           | It finishes the move into one repository: until it lands, no project can install either package from a commit here. Each tag is a commit whose root is one package's directory, made after the checks pass.                                                                                                                                                                                                                                                                       |
| 3    | [documentation-site.md](documentation-site.md): one site for users and contributors, with the benchmarks and an API reference                                                                               | The first release waits for it, and it waits for the move, which sets where `docs/` lives and which workflow deploys it.                                                                                                                                                                                                                                                                                                                                                          |
| 4    | [benchmark-tooling.md](benchmark-tooling.md): a stable fbs and serio column, and a readable `Blink: Booleans` encode cell                                                                                   | The site publishes the benchmark tables as a comparison with other libraries, so before the first release each column's code must stay the same from build to build, and each cell must be readable.                                                                                                                                                                                                                                                                              |
| 5    | [ci-and-release.md](ci-and-release.md): the release pipeline, the version backstop and the first release, with the cache test in [transformer-unit-test-coverage.md](transformer-unit-test-coverage.md)     | Only a release exercises the pipeline, and protecting `master` changes how every change lands, so both come with the first release. The backstop lands with the release it protects, and it changes the function whose cache that test covers. The release records all three benchmark tiers again on its own code. The cursor codec, the last addition to the consumer API that the plan held, has landed (Runtime API 3.15 in [specs/runtime-api.md](../specs/runtime-api.md)). |

## No step of its own

These are small, have no dependency on the order above, and can land at any
time:

- The stand-in for surge's declarations in
  [transformer-unit-test-coverage.md](transformer-unit-test-coverage.md):
  the transformer's suites could read surge's own declarations.
- [shared-configs.md](shared-configs.md): the root and each package keep
  their own copies of the Prettier, markdownlint and cspell configs.
- In [benchmark-tooling.md](benchmark-tooling.md): Zap's output, which
  changes order from one run to the next, and two stale statements about the
  benchmark files.
- [enum-name-keys.md](enum-name-keys.md): an option for an enum's write
  keyed by the item's `Name`, for generated code run outside Roblox, where
  the default write keyed by the item finds no index.
- [squash-column.md](squash-column.md): Squash, the most used standalone
  Luau serializer, as a column of the benchmark, once its version is chosen.
- [flamework-macro-interop.md](flamework-macro-interop.md): a factory call
  inside the arguments of a Flamework macro that takes caller metadata, such
  as runit's `Assert.equal`, makes Flamework's transformer fail.

## After the first release

- [schema-fingerprint.md](schema-fingerprint.md): a compile-time fingerprint
  of a type's encoding, optional and off by default, so a game can detect
  bytes that a build with a different type wrote. It is the first work to
  revisit after the first release, which makes possible the consumer it
  waits for: a game that persists surge bytes across releases. Because it is
  off by default, adding it after the release changes no game's bytes.

## Deferred indefinitely

These need a concrete driver before they are worth designing, and nothing
above depends on them:

- [generated-code-performance.md](generated-code-performance.md): what is
  left of the generated code's speed. Every catalog row with a hand-written
  codec is within the band of it but the `CFrame` array's decode, where the
  hand-written codec holds the rotation in three numbers and surge in a
  `Vector3`. What else is left is smaller than the speed tier reads, or has
  had a row to be measured on only since the catalog gained the tuples with a
  rest and the sequences. Step 1 takes the write state and the joined
  reservations out of it.
- [networking.md](networking.md): the `surge-net` transport layer.
  Serializer-layer work is complete without it.
- [schema-versioning.md](schema-versioning.md): schema evolution. Only
  needed once a deployment runs two builds against one shape.
- In [benchmark-tooling.md](benchmark-tooling.md): a third tier, for wire
  cost, a Zap-shaped timing, and a row that gives `writeChecks` code. Each
  needs a driver.
- [headless-ci.md](headless-ci.md): automated benchmark runs in CI. The
  harness in [benchmark-tooling.md](benchmark-tooling.md) is run by hand;
  gating on its numbers is a separate decision.
- [agent-conventions.md](agent-conventions.md): a hook that blocks an agent's
  edits to generated files, and task skills. Each waits for a reason.
- [raw-reads.md](raw-reads.md): an option to serialize a value without running
  its metamethods. Plain tables and class instances read the same either way,
  and a proxy would read wrong.
