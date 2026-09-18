# @rbxts/surge

A drop-in-ergonomic alternative to
[flamework-binary-serializer](https://github.com/Fireboltofdeath/flamework-binary-serializer),
generating specialized serialize/deserialize code per shape at TypeScript
compile time instead of interpreting a schema at runtime.

This repository is the runtime package (`@rbxts/surge`) plus the
`tests/` round-trip/benchmark suite. The transformer that does the actual
code generation lives in its own sibling repository,
[`rbxts-transformer-surge`](https://github.com/travddm/rbxts-transformer-surge)
— see Repository layout in [docs/architecture.md](docs/architecture.md)
for why they're split. `tests/` depends on it as a local `file:`
dependency during development, so `mise run ci` here requires that repo
checked out at `../rbxts-transformer-surge` (a sibling of this
directory) — swap `tests/package.json`'s `file:../../rbxts-transformer-surge`
for a `github:travddm/rbxts-transformer-surge#<ref>` dependency instead if
you don't have (or don't want) that sibling checkout.

See [docs/architecture.md](docs/architecture.md) for the full design, or
[docs/coding-standards.md](docs/coding-standards.md) and
[docs/testing.md](docs/testing.md) for how this repository is built and
verified.
