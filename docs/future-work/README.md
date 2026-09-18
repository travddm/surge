# Future work: index and implementation order

Part of the [surge](../architecture.md) design. One document per unit of
work. The order below is the recommended implementation order; each step
names the documents it delivers and why it comes where it does. The last
section lists the documents that can be deferred indefinitely.

The fixture harness in [transformer-unit-test-coverage.md](transformer-unit-test-coverage.md)
(a stub `@rbxts/surge` and dev-installed `@rbxts/types` in the
transformer's tests, plus printed-emitter snapshots) has landed, so every
fix below can land with a regression test; that document now tracks only
the remaining walker cases and diagnostic-message assertions, added
alongside the fixes below rather than as their own step.

The five correctness fixes that used to be steps 1 to 5 here (type-identity
keying for the walker's caches, recursion through unions, read-side
statement order, literal/guardedUnion/discriminant determinism plus packed
padding, and enum index width with an O(1) lookup table) have all landed,
with regression tests in the transformer repo's `test/walk.test.ts`/
`test/emit.test.ts`/`test/transform.test.ts` and round-trip fixtures in
`coverage.spec.ts`. See Transformer Design in [transformer.md](../transformer.md)
for the current, corrected behavior. One narrow, non-correctness item from
the enum-encoding review is still open: see
[enum-encoding.md](enum-encoding.md).

## Order

| Step | Document                                                       | Why here                                                                                                                               |
| ---- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | [blob-classification.md](blob-classification.md)               | `Instance` passthrough does not work as documented; needs an identity-based notion of Roblox classes and datatypes.                    |
| 2    | [walker-emitter-robustness.md](walker-emitter-robustness.md)   | Defines the diagnostic model once and applies it to the remaining crash and invalid-output cases.                                      |
| 3    | [type-coverage-parity.md](type-coverage-parity.md)             | With the walk correct and the diagnostic model in place, close the type-coverage gaps against fbs, serio, Blink, and Zap.              |
| 4    | [round-trip-test-coverage.md](round-trip-test-coverage.md)     | Full round-trip and byte-pinning suites over the now-complete type surface; the fuzz loops testing.md promises.                        |
| 5    | [benchmark-tooling.md](benchmark-tooling.md)                   | The size and speed comparison harness against the four libraries. The wire format is now frozen, so numbers stay comparable.           |
| 6    | [generated-code-performance.md](generated-code-performance.md) | Every item is measurement-driven, so it follows the harness. The local-register ceiling is the exception and can be fixed any time.    |
| 7    | [deserialize-hardening.md](deserialize-hardening.md)           | Opt-in checks; needed before the networking layer, not before.                                                                         |
| 8    | [documentation-gaps.md](documentation-gaps.md)                 | User documentation written against fixed behavior; each stale statement is corrected as its fix lands, and the usage guide comes last. |
| 9    | [ci-and-release.md](ci-and-release.md)                         | Cross-repository CI and the version backstop, with the first tagged release.                                                           |

The Lune size tier of step 5 needs no Roblox process and can be built now
that the wire format is frozen; only the speed tier waits for the harness
proper.

## Deferred indefinitely

These need a concrete driver before they are worth designing, and nothing
above depends on them:

- [networking.md](networking.md): the `surge-net` transport layer.
  Serializer-layer work is complete without it.
- [schema-versioning.md](schema-versioning.md): schema evolution. Only
  needed once a deployment runs two builds against one shape.
- [headless-ci.md](headless-ci.md): automated benchmark runs in CI. The
  harness in [benchmark-tooling.md](benchmark-tooling.md) is run by hand;
  gating on its numbers is a separate decision.
