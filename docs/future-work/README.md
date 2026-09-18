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

## Order

| Step | Document                                                       | Why here                                                                                                                                         |
| ---- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | [walk-type-identity.md](walk-type-identity.md)                 | Silent wrong bytes for any generic instantiation. Also the identity model the next two steps build on.                                           |
| 2    | [recursive-union-types.md](recursive-union-types.md)           | Compiler crash on recursive unions; needs step 1's type-identity tracking and generalizes helpers for step 3.                                    |
| 3    | [read-order-side-effects.md](read-order-side-effects.md)       | Silent cursor and blob desync; small change to `readField`, best done once helpers are settled.                                                  |
| 4    | [wire-format-determinism.md](wire-format-determinism.md)       | Encoding depends on unrelated files. Changes the wire format, so it should land before anyone pins bytes in tests or ships.                      |
| 5    | [enum-encoding.md](enum-encoding.md)                           | `Enum.KeyCode` overflow (wire-format change, same release as step 4) and the O(1) table the design already promises.                             |
| 6    | [blob-classification.md](blob-classification.md)               | `Instance` passthrough does not work as documented; needs an identity-based notion of Roblox classes and datatypes.                              |
| 7    | [walker-emitter-robustness.md](walker-emitter-robustness.md)   | Defines the diagnostic model once and applies it to the remaining crash and invalid-output cases.                                                |
| 8    | [type-coverage-parity.md](type-coverage-parity.md)             | With the walk correct and the diagnostic model in place, close the type-coverage gaps against fbs, serio, Blink, and Zap.                        |
| 9    | [round-trip-test-coverage.md](round-trip-test-coverage.md)     | Full round-trip and byte-pinning suites over the now-complete type surface; the fuzz loops testing.md promises.                                  |
| 10   | [benchmark-tooling.md](benchmark-tooling.md)                   | The size and speed comparison harness against the four libraries. Needs the wire format frozen (steps 4 and 5) so numbers stay comparable.       |
| 11   | [generated-code-performance.md](generated-code-performance.md) | Every item is measurement-driven, so it follows the harness. The local-register ceiling is the exception and can be fixed any time after step 3. |
| 12   | [deserialize-hardening.md](deserialize-hardening.md)           | Opt-in checks; needed before the networking layer, not before.                                                                                   |
| 13   | [documentation-gaps.md](documentation-gaps.md)                 | User documentation written against fixed behavior; each stale statement is corrected as its fix lands, and the usage guide comes last.           |
| 14   | [ci-and-release.md](ci-and-release.md)                         | Cross-repository CI and the version backstop, with the first tagged release.                                                                     |

Steps 1 to 5 are correctness fixes and should ship together as the first
release, since steps 4 and 5 change the wire format and nothing should pin
bytes before them. The Lune size tier of step 10 needs no Roblox process
and can be built alongside steps 4 and 5 as the byte-regression check for
them; only the speed tier waits for the harness proper.

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
