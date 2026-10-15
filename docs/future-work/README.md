# Future work: index and implementation order

Part of the [surge](../architecture.md) design. One document per unit of
work. The order below is the recommended implementation order, and ends with
the first release. Each step names the document it delivers and why it comes
where it does. The sections after it list work with no step of its own and
the documents that can be deferred indefinitely.

This directory holds open work only. What the September 2026 review found,
and what has landed since, is in
[research/september-2026-review.md](../research/september-2026-review.md);
[contributing-docs.md](../contributing-docs.md) states the rule.

## Order

Steps 2 to 11 change what the first release freezes: the consumer API, the
bytes, or both. They land one at a time, since they touch the same files and
the same specifications.

| Step | Document                                                                                                                                                                                                | Why here                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | [one-package-tags.md](one-package-tags.md): pre-release tags on `master`, dev tags on request, and `master` and its pre-release tags protected                                                          | Until it lands, no project can install either package from a commit here, since npm cannot install a package from a subdirectory. It comes before the API changes, so that each can be tried in another project through a pre-release tag before the first release freezes it, and it protects `master` with the tags each push to it makes. The first release uses its tag script.                                  |
| 2    | [literal-parameters.md](literal-parameters.md): string literals for a brand's widths and forms                                                                                                          | Steps 3, 4, 5, 7 and 8 spell their parameters by its rule, so it comes first among the API changes. No byte changes.                                                                                                                                                                                                                                                                                                 |
| 3    | [exact-length-brand.md](exact-length-brand.md): an `Exact<T, N>` brand for the exact form of `Length`                                                                                                   | After step 2, which gives `Length` its string widths. No byte changes.                                                                                                                                                                                                                                                                                                                                               |
| 4    | [range-parameter-order.md](range-parameter-order.md): `Range<Min, Max, W = "auto">`                                                                                                                     | After step 2, whose rule its width follows. It is independent of step 3. No byte changes.                                                                                                                                                                                                                                                                                                                            |
| 5    | [vector-brands.md](vector-brands.md): `Vector2D` and `Vector3D`, with no `"f64"` component                                                                                                              | After step 2, whose rule its widths follow. It declares the `ComponentWidth` alias step 8 reuses. No byte changes.                                                                                                                                                                                                                                                                                                   |
| 6    | [cursor-codec-vocabulary.md](cursor-codec-vocabulary.md): `serialize` and `deserialize` on a `CursorCodec<T>`                                                                                           | It is independent of every other step, and a rename lands before the first release or not at all. It comes with the other changes to names. No byte changes.                                                                                                                                                                                                                                                         |
| 7    | [guard-brands.md](guard-brands.md): a `Guarded<T, K>` brand that names a caller's guard at a position, run under `readChecks` and `writeChecks`                                                         | After step 2, whose rule its `K` follows. It adds a brand, a `CodecOptions` key and a brand rule, and every call that compiles today still compiles, so it comes last among the API changes that move no byte.                                                                                                                                                                                                       |
| 8    | [transform-rotation.md](transform-rotation.md): a `CFrame`'s rotation form as `Transform`'s last argument, exact by default                                                                             | After step 2, whose rule its parameters follow, and step 5, whose alias it reuses. It starts with a check in Studio that its new default round-trips exactly. It changes the bytes of every `CFrame` outside `Packed<T>`, and of a packed one whose rotation is not axis-aligned, so it records the size table again.                                                                                                |
| 9    | [automatic-packing.md](automatic-packing.md): an object's bits packed without `Packed<T>`                                                                                                               | It changes the bytes of every object outside `Packed<T>` with a `boolean`, an optional or a two-variant tagged union property. It starts with two emission changes, measured with scoped speed runs, then changes the default and records the size table again. It is independent of step 8, since it leaves the packed `CFrame` as it is.                                                                           |
| 10   | [schema-fingerprint.md](schema-fingerprint.md): a compile-time fingerprint of a type's encoding, optional and off by default, so a game can detect bytes that a build with a different type wrote       | After steps 8 and 9, which change the `Field` tree it hashes, and before the release, so that a game that persists surge bytes can store a fingerprint from its first save. It is off by default, so a call site that does not ask for it writes the same bytes.                                                                                                                                                     |
| 11   | [schema-versioning.md](schema-versioning.md): reading bytes that a build with a different type wrote                                                                                                    | After step 10, which detects such bytes, and whose fingerprint a version tag could carry. Before the release: if its design pass picks a tag that every value carries, adding the tag after the release would change the bytes of every shape a game has saved.                                                                                                                                                      |
| 12   | [generated-code-performance.md](generated-code-performance.md): what is left of the generated code's speed                                                                                              | After steps 8 to 11, which change the generated code, and before the release, which records the speed tier on its code. It takes the items that have a row to be measured on: a cursor codec's write sized once, a tuple's rest, a sequence sized from its keypoints, and the `CFrame` array's decode in step 8's default. No item changes a byte, so what the release does not take stays open for a later release. |
| 13   | [documentation-site.md](documentation-site.md): one site for users and contributors, with the benchmarks and an API reference                                                                           | The first release waits for it, and the release run deploys it.                                                                                                                                                                                                                                                                                                                                                      |
| 14   | [benchmark-tooling.md](benchmark-tooling.md): a stable fbs and serio column, and a readable `Blink: Booleans` encode cell                                                                               | The site publishes the benchmark tables as a comparison with other libraries, so before the first release each column's code must stay the same from build to build, and each cell must be readable.                                                                                                                                                                                                                 |
| 15   | [ci-and-release.md](ci-and-release.md): the release pipeline, the version backstop and the first release, with the cache test in [transformer-unit-test-coverage.md](transformer-unit-test-coverage.md) | Only a release exercises the pipeline, so it comes with the first release, and so does protecting the `release` branch. The backstop lands with the release it protects, and it changes the function whose cache that test covers. The release records all three benchmark tiers again on its own code.                                                                                                              |

## No step of its own

These are small, have no dependency on the order above, and can land at any
time:

- In [benchmark-tooling.md](benchmark-tooling.md): Zap's output, which
  changes order from one run to the next.
- [enum-name-keys.md](enum-name-keys.md): an option for an enum's write
  keyed by the item's `Name`, for generated code run outside Roblox, where
  the default write keyed by the item finds no index.
- [squash-column.md](squash-column.md): Squash, the most used standalone
  Luau serializer, as a column of the benchmark, once its version is chosen.
- [flamework-macro-interop.md](flamework-macro-interop.md): a factory call
  inside the arguments of a Flamework macro that takes caller metadata, such
  as runit's `Assert.equal`, makes Flamework's transformer fail.

## Deferred indefinitely

These need a concrete driver before they are worth designing, and nothing
above depends on them:

- [networking.md](networking.md): the `surge-net` transport layer.
  Serializer-layer work is complete without it.
- [transformer-extension-point.md](transformer-extension-point.md): a plugin
  a package ships so the transformer recognizes a factory of that package's
  own. A package that takes codecs as values needs none, which is the design
  `surge-net` tries first.
- In [benchmark-tooling.md](benchmark-tooling.md): a third tier, for wire
  cost, a Zap-shaped timing, and a `surge (writeChecks)` column. Each
  needs a driver.
- [headless-ci.md](headless-ci.md): automated benchmark runs in CI. The
  harness in [benchmark-tooling.md](benchmark-tooling.md) is run by hand;
  gating on its numbers is a separate decision.
- [agent-conventions.md](agent-conventions.md): a hook that blocks an agent's
  edits to generated files, and task skills. Each waits for a reason.
- [raw-reads.md](raw-reads.md): an option to serialize a value without running
  its metamethods. Plain tables and class instances read the same either way,
  and a proxy would read wrong.
- [project-config.md](project-config.md): a project default for the checks,
  carried on the `tsconfig.json` plugin entry. Nothing needs it yet, and a
  setting that changes a byte is ruled out: a type alone sets its encoding.
