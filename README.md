# @rbxts/surge

[![CI](https://github.com/travddm/surge/actions/workflows/ci.yml/badge.svg)](https://github.com/travddm/surge/actions/workflows/ci.yml)

Binary serializers for roblox-ts, generated from a TypeScript type at compile
time. surge is a drop-in alternative to
[flamework-binary-serializer](https://github.com/Fireboltofdeath/flamework-binary-serializer):
the same `createBinarySerializer<T>()` call, with code written for `T` in place
of a schema interpreted at run time.

```ts
import { DataType, createBinarySerializer } from "@rbxts/surge";

interface PlayerState {
	name: string;
	health: DataType.u8;
	position: Vector3;
}

export const playerState = createBinarySerializer<PlayerState>();

export function roundTrip(state: PlayerState): PlayerState {
	const { buffer, blobs } = playerState.serialize(state);
	return playerState.deserialize(buffer, blobs);
}
```

surge is two packages: this runtime package, and
[`rbxts-transformer-surge`](https://github.com/travddm/rbxts-transformer-surge),
the transformer that generates the code. Install both, pinned to the same
release, and register the transformer in `tsconfig.json`:
[docs/getting-started.md](docs/getting-started.md).

## Documentation

- [Getting started](docs/getting-started.md): install, register the
  transformer, and write a first serializer.
- [Supported types](docs/supported-types.md): what each type is written as,
  what is passed through, and what is rejected.
- [Data types](docs/data-types.md): the `DataType` brands that choose widths,
  counts and packing.
- [Errors and guarantees](docs/errors-and-guarantees.md): `checks`,
  `writeChecks`, and what the bytes do not carry.
- [Performance](docs/performance.md): the file directives, and what to
  expect.
- [Specifications](docs/specs/README.md): the runtime API, the wire format,
  and the transformer, statement by statement.

## Contributing

Start with [AGENTS.md](AGENTS.md), which indexes every document and states
the rules, then [docs/contributing.md](docs/contributing.md) for setup. Both
repositories must be checked out side by side.
