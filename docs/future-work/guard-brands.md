# Future work: a `Guarded<T, K>` brand for a caller's guard

Part of the [surge](../architecture.md) design.

## What

A brand that names a guard at a position in a type, and a factory option that
supplies the guard:

```ts
interface Profile {
	name: DataType.Guarded<string, "username">;
}

const codec = createCodec<Profile>({
	readChecks: true,
	guards: { username: (name) => utf8.len(name)[0] !== false },
});
```

A guard is `(value: T) => boolean`. With `readChecks`, `deserialize` raises
the usual `@rbxts/surge:` string, naming the key, for a value the guard
rejects, once the value at that position is read. With `writeChecks`,
`serialize` raises the same for a value it is given, before it returns any
bytes. Without the flag of its side, a guard does not run. No byte changes:
a guarded value is written as its unbranded type is.

## Why

- surge's checks guarantee the declared type and nothing of the value: with
  `readChecks` a string can be any string and a number any number its width
  holds ([errors-and-guarantees.md](../errors-and-guarantees.md)). A rule on
  the value, such as a string being valid UTF-8 before it reaches a
  `DataStore` or a text API, is the game's to apply after the `pcall`. A
  guard on the whole decoded value, such as a `t.interface`, applies it in
  one walk, and is what Flamework's networking does today, so the brand saves
  no pass.
- What it adds is placement: the rule sits next to the type it governs, so a
  nested position, a string inside an array inside a union, is reached
  without a second description of the shape, and a hostile payload is
  refused before the rest of it is decoded.
- Zap and Blink have built-in constraints and no caller's guard. Flamework
  2's serializer has built-in width checks, configured for the project, and
  no caller's guard either; its networking runs a generated `t` guard over
  each decoded argument list ahead of all middleware, and its components let
  a config override one attribute's guard by name
  (`attributes: { speed: t.numberPositive }`). The brand follows the last
  shape: a guard named at a position, supplied where the serializer is made.

## Why deferred

- No consumer needs it. The top-level case is a guard after `deserialize`,
  or middleware in `surge-net` ([networking.md](networking.md)).
- It changes no byte, and every call that compiles today still compiles. It
  lands with the other API changes before the first release
  ([README.md](README.md)).
- It is the first brand that only checks: `Range` also chooses a width where
  it names none. The rule it adds to the brand rules in
  [coding-standards.md](../coding-standards.md), and the option it adds to
  `CodecOptions`, are a design pass of their own.

## How, briefly

- `DataType.Guarded<T, K extends string> = T & { readonly _surge_guarded?: [T, K] }`
  in `surge/src/data-type.ts`, by the brand rules. `K` is a string literal,
  since it is a name, and rule 2 of the brand rules gains that case.
- `guards` is an object literal at the call site, as `readChecks` and
  `writeChecks` are literals (Runtime API 3.8 in
  [specs/runtime-api.md](../specs/runtime-api.md)): the transformer reads its
  keys, and a key the walk of `T` does not meet, or a `Guarded` key the
  literal lacks, is a diagnostic. Its values are any expressions, and each is
  read into a local of the generated module once, where the factory runs.
- A guard's type is `(value: T) => boolean`, so a `t.check<T>` from
  `@rbxts/t` is assignable to it and surge imports nothing (Package
  boundaries in [coding-standards.md](../coding-standards.md)).
- The read side calls the guard after the value at the position is built,
  under the same emission as the other `readChecks` checks, so a cursor
  codec's `deserialize` needs nothing of its own. The write side calls it
  once, since `serialize` reads a value twice
  ([errors-and-guarantees.md](../errors-and-guarantees.md)). Where is open:
  the size runs before the result is created, but only a shape sized exactly
  has one (Transformer 5.20 in [specs/transformer.md](../specs/transformer.md)),
  a cursor codec's `serialize` and a shape on the scratch buffer write in one
  pass, and a size reads nothing of a fixed-size value.
- A built-in check, such as a `Utf8` brand for `utf8.len(value) ~= false`, is
  a guard the caller does not write. It earns a brand of its own only where
  the inlined check beats a call, or the rule is common enough; the general
  brand comes first.
- Speed: a guard is a call per guarded value, under a flag that is off on a
  hot path. The speed tier measures it only if a row needs one.
