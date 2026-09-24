# Future work: index and implementation order

Part of the [surge](../architecture.md) design. One document per unit of
work. The order below is the recommended implementation order; each step
names the documents it delivers and why it comes where it does. The last
section lists the documents that can be deferred indefinitely.

This directory holds open work only. What the September 2026 review found,
and what has landed since, is in
[research/september-2026-review.md](../research/september-2026-review.md);
[contributing-docs.md](../contributing-docs.md) states the rule.

## Order

| Step | Document                                                                                                                                                                                                                                                          | Why here                                                                                                                                                                                                                                                                                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | [generated-code-performance.md](generated-code-performance.md): the per-call gap first, with the two tables each `serialize()` returns as the next measurement; then fewer reservations and exact sizing, each measured on its own; then the rest of the document | The per-call gap is the largest open item, and its next measurement is named. Its result may change what `serialize()` returns, or which helpers the generated code calls, and both are free to change before the first release. Step 2 waits on it.                                                    |
| 2    | [benchmark-tooling.md](benchmark-tooling.md): the hand-written baseline widened to the tagged union and the packed toggles, and the generated Luau's size measured                                                                                                | Waits on step 1: its own document says a wider baseline measures nothing new until the per-call gap is understood. The size measurement gives exact sizing and the other code changes of step 1 their cost in code as well as in time.                                                                  |
| 3    | [enum-and-opaque-union-members.md](enum-and-opaque-union-members.md): `Enum.X \| string`, a union of items from two enums, and `Instance \| string`                                                                                                               | Type coverage. Independent of the order above, so it may run alongside steps 1 and 2. It supports shapes that are diagnostics today and moves no pinned byte.                                                                                                                                           |
| 4    | [native-code-limits.md](native-code-limits.md): where a large serializer, or a large module of them, runs interpreted                                                                                                                                             | Research. Independent of the order above, and it needs Studio. It measures the emitted code, so it reads best after step 1 has changed that code.                                                                                                                                                       |
| 5    | [blob-channel-state.md](blob-channel-state.md), [enum-encoding.md](enum-encoding.md) and [blob-classification.md](blob-classification.md)                                                                                                                         | Each changes the helper ABI or what a type that works today writes. That is free before the first release and a breaking change after it, so all three come before step 6. They are independent of steps 1 to 4 and of each other. `blob-classification.md` starts with the design decision it records. |
| 6    | [ci-and-release.md](ci-and-release.md): version backstop, documentation site, and first tagged release                                                                                                                                                            | The backstop lands with the release it protects, and the documentation site with the release it publishes, after every step above that can change the consumer API, the helper ABI or the bytes. The other CI items do not wait; see below.                                                             |

## No step of its own

These are small, have no dependency on the order above, and can land at any
time:

- The CI items in [ci-and-release.md](ci-and-release.md): the transformer
  workflow running the integration suite, the pinned sibling ref, `npm ci`,
  and the Windows job. The transformer's CI cannot see a broken
  serializer today.
- [transformer-unit-test-coverage.md](transformer-unit-test-coverage.md): a
  test of the package-name cache in `detect.ts`, which needs `fs` mocking.

## Deferred indefinitely

These need a concrete driver before they are worth designing, and nothing
above depends on them:

- [networking.md](networking.md): the `surge-net` transport layer.
  Serializer-layer work is complete without it.
- [caller-buffers.md](caller-buffers.md): writing into and reading from a
  caller's buffer at an offset. `surge-net`'s per-frame batching is its
  driver. Its blob handling builds on
  [blob-channel-state.md](blob-channel-state.md), and its constant size on
  the first item under fewer reservations in
  [generated-code-performance.md](generated-code-performance.md).
- [schema-versioning.md](schema-versioning.md): schema evolution. Only
  needed once a deployment runs two builds against one shape.
- [schema-fingerprint.md](schema-fingerprint.md): a compile-time fingerprint
  of a type's encoding, optional and off by default, so a game can detect
  bytes that a build with a different type wrote. It waits for a consumer,
  such as a game that persists surge bytes across releases.
- What is left of [benchmark-tooling.md](benchmark-tooling.md) after step 2:
  a third tier, for wire cost, and a Zap-shaped timing. Each needs a driver.
- [headless-ci.md](headless-ci.md): automated benchmark runs in CI. The
  harness in [benchmark-tooling.md](benchmark-tooling.md) is run by hand;
  gating on its numbers is a separate decision.
- [agent-conventions.md](agent-conventions.md): a hook that blocks an agent's
  edits to generated files, and task skills. Each waits for a reason.
