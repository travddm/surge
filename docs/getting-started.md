# Getting started

Install the two packages, register the transformer, and declare a serializer.

## Install

Add both packages to the roblox-ts project's `package.json`, pinned to the
same tag or commit:

```json
{
	"dependencies": {
		"@rbxts/surge": "github:travddm/surge#<ref>"
	},
	"devDependencies": {
		"rbxts-transformer-surge": "github:travddm/rbxts-transformer-surge#<ref>"
	}
}
```

`@rbxts/surge` is the runtime package the generated code calls.
`rbxts-transformer-surge` runs only at compile time, so it is a
devDependency. Update the two `<ref>`s
together: the generated code calls the runtime package with no version
check, and nothing detects a mismatch
([specs/runtime-api.md](specs/runtime-api.md) 6.1 and 6.2).

Neither package is on the npm registry. `npm install` clones each repository
and builds it with its `prepare` script, so the install needs network access
to fetch roblox-ts and the `@rbxts` packages each one builds against.

## Register the transformer

In `tsconfig.json`:

```json
{
	"compilerOptions": {
		"plugins": [{ "transform": "rbxts-transformer-surge" }]
	}
}
```

If the project uses Flamework, list surge's entry before
`rbxts-transformer-flamework`, as surge's own test project does.

## Declare a serializer

Put serializers in a module of their own:

```ts
// src/shared/serializers.ts
//!native
//!optimize 2
import { DataType, createBinarySerializer } from "@rbxts/surge";

export interface PlayerState {
	name: string;
	health: DataType.u8;
	position: Vector3;
	inventory: DataType.Length<string[], DataType.u8>;
	team?: "red" | "blue";
}

export const playerState = createBinarySerializer<PlayerState>();
```

Use it anywhere else:

```ts
import { PlayerState, playerState } from "shared/serializers";

function send(remote: RemoteEvent, state: PlayerState) {
	remote.FireAllClients(playerState.serialize(state));
}

function receive(input: buffer): PlayerState {
	return playerState.deserialize(input);
}
```

At compile time the transformer replaces `createBinarySerializer<PlayerState>()`
with code written for `PlayerState` alone. There is no schema at run time.

- `serialize` returns the bytes as a `buffer`. A type that can hold a value
  the bytes cannot carry, such as an `Instance`, returns a table instead:
  `buffer` holds the bytes, and `blobs` those values in the order they were
  met. Send both, and pass both to `deserialize`. `PlayerState` holds none, so
  `serialize` returns its buffer alone.
- `DataType.u8` and `DataType.Length` choose how many bytes a value takes.
  Without them a `number` takes 8 bytes and a container's count takes 4. See
  [data-types.md](data-types.md).
- The `//!native` and `//!optimize 2` lines are the module shape
  [performance.md](performance.md) recommends.

A type the transformer cannot encode fails the build with an error at the
property that holds it, such as `error TS surge: "symbol" can't be
structurally encoded`. [supported-types.md](supported-types.md) lists what is
encoded, what goes into `blobs`, and what is rejected.

## Three factories

| Factory                     | Returns                      | Options                 |
| --------------------------- | ---------------------------- | ----------------------- |
| `createBinarySerializer<T>` | `{ serialize, deserialize }` | `checks`, `writeChecks` |
| `createSerializer<T>`       | the `serialize` function     | `writeChecks`           |
| `createDeserializer<T>`     | the `deserialize` function   | `checks`                |

Each call site generates its own code. Options are written as literals at the
call site, such as `createDeserializer<PlayerState>({ checks: true })`, and
default to `false`.

## Input from a client

A client can send any bytes. Read them with `checks: true`, and call the
result in a `pcall`:

```ts
const readFromClient = createDeserializer<PlayerState>({ checks: true });

remote.OnServerEvent.Connect((player, input) => {
	if (!typeIs(input, "buffer")) return;
	const [ok, state] = pcall(() => readFromClient(input));
	if (!ok) return;
	// `state` is a PlayerState. Whether its values are acceptable is the game's
	// to decide.
});
```

[errors-and-guarantees.md](errors-and-guarantees.md) says what `checks` and
`writeChecks` reject, and what neither one does.
