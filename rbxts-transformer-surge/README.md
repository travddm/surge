# rbxts-transformer-surge

[![CI](https://github.com/travddm/surge/actions/workflows/ci.yml/badge.svg)](https://github.com/travddm/surge/actions/workflows/ci.yml)

The TypeScript transformer for [`@rbxts/surge`](https://github.com/travddm/surge).
It finds each `createCodec<T>()`, `createSerializer<T>()` and
`createDeserializer<T>()` call and replaces it with serialize and deserialize
code generated for `T` at compile time. It has no run-time code of its own;
the code it generates calls `@rbxts/surge`.

Register it in a roblox-ts project's `tsconfig.json`:

```json
{
	"compilerOptions": {
		"plugins": [{ "transform": "rbxts-transformer-surge" }]
	}
}
```

Install it beside `@rbxts/surge`, at the same version;
[getting-started.md](https://github.com/travddm/surge/blob/master/docs/getting-started.md)
has the steps.

## Documentation

The documentation for both packages is in the
[surge repository](https://github.com/travddm/surge). What this transformer
guarantees is
[docs/specs/transformer.md](https://github.com/travddm/surge/blob/master/docs/specs/transformer.md),
and the bytes its code writes are
[docs/specs/wire-format.md](https://github.com/travddm/surge/blob/master/docs/specs/wire-format.md).

## Contributing

This package is the `rbxts-transformer-surge/` directory of the
[surge repository](https://github.com/travddm/surge). Start with its
[AGENTS.md](https://github.com/travddm/surge/blob/master/rbxts-transformer-surge/AGENTS.md),
then, in this directory:

```sh
mise run ci   # lint, format, spell, compile, and the Jest suites
```

VS Code users can run the `transformer: ci` task instead. What the generated
code does when it runs is tested by surge's round-trip suite, which compiles
through this transformer; `mise run ci` at the repository root runs both.
