# Errors and guarantees

What each side checks, what it raises, and what it leaves to the game.

```ts
import { createCodec, createDeserializer } from "@rbxts/surge";

// Bytes this game wrote, such as its own DataStore: no checks needed.
const inventory = createCodec<Inventory>();

// What a client sent, read on the server: checked, and in a pcall.
const readRequest = createDeserializer<TradeRequest>({ readChecks: true });

const [ok, request] = pcall(() => readRequest(input));
```

## Two options

|                | `readChecks`                                                                                                                                                           | `writeChecks`                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Governs        | `deserialize`                                                                                                                                                          | `serialize`                                                                                                                                                |
| Guards against | input a client crafted, read on the server                                                                                                                             | a value of the game's own that does not fit its `DataType` brands                                                                                          |
| Rejects        | an input that is not what `serialize` returns, a read past the end, a count the rest cannot hold, an enum index past its items, a packed rotation code that names none | an exact `Length<T, N>` value that is not `N` long, a count too large for its `u8`, `u16` or `u24` width, a number its `Range<T, Min, Max>` does not admit |
| Taken by       | `createDeserializer`, `createCodec`                                                                                                                                    | `createSerializer`, `createCodec`                                                                                                                          |
| Costs          | a branch per read and a shape check per call, measured in [benchmarks/speed.md](benchmarks/speed.md)                                                                   | a branch per narrowed or exact `Length` and per `Range` number; nothing for a type with neither                                                            |

Both default to `false`, and both must be written as `true` or `false` at the
call site, because they decide what code is generated. Every error either one
raises is a string that begins `@rbxts/surge:`, so a `pcall` can tell it
from an error in the game's own code.

## Reading what a client sent

A client controls what it sends: an exploiter can fire a remote with any
arguments. On the server, read what a client sent with `readChecks: true`,
and call it in a `pcall`. `deserialize` then also takes `unknown`, so what
the remote delivered can be passed to it as it is, and an input that is not
what `serialize` returns for the type raises before anything is read.

Without `readChecks`, `deserialize` trusts its input. Given bytes no
`serialize` of the same type wrote, it may raise an unrelated Luau error,
return a value its type does not allow, such as `undefined` for an enum item,
or loop and allocate for as long as a count in the input says. A `pcall`
turns the first into a rejection, and does not see the other two.

The game's own bytes do not need `readChecks`: what the server sends a
client, and what the game saved to its own `DataStore`. Nor does packet loss:
Roblox drops a lost `UnreliableRemoteEvent` event rather than delivering part
of it. And `readChecks` does not catch bytes written for a different type,
such as a save from before the type changed
([What the bytes do not carry](#what-the-bytes-do-not-carry)).

With `readChecks`, an input that passes deserializes to a value of the declared
type. It does not follow that the value is one the game accepts. A number
can be any number its width holds, even outside its `Range`, a string any
string, and a count any count the input has the bytes for. Validate what the
game depends on after the `pcall` succeeds.

A blob field holds whatever the `blobs` array holds at its position, and
`readChecks` does not examine it. A client can put any value there, so check a
blob field's type before using it. Reading past the end of `blobs` raises
with or without `readChecks`, and so does reading a blob field from an input
with no `blobs` array.

After a call that raised, the serializer is ready for the next call: nothing
it keeps between calls is left half-read.

## Writing values

Without `writeChecks`, `serialize` writes what it is given and examines
nothing:

- a number outside its width wraps, and a fraction in an integer width is
  truncated ([data-types.md](data-types.md));
- a count too large for a narrowed `Length` width wraps;
- an exact `Length<T, N>` value of another length is truncated, padded, or
  raises, depending on its element type.

`writeChecks: true` makes the second and third raise before they are written.
It examines a number only when its type is a `Range<T, Min, Max>`, and then
raises for a value outside the range, a NaN, and a fraction where the range
holds whole numbers. To have `serialize` check a number, give it a `Range`.

`writeChecks` guards the game's own values, not what crosses the network. A
type with no narrowed or exact `Length` and no `Range` gets no check from it,
so turning it on costs such a type nothing.

## What the bytes do not carry

- **No type or version.** The bytes do not say which type wrote them. Reading
  them with a different type, or with a build whose type has changed, reads
  wrong values rather than failing. Keep the two sides on the same type and
  the same surge version.
- **Enum indexes depend on `@rbxts/types`.** An enum item is written as its
  index among the items its type admits, so a `@rbxts/types` update that adds
  an item can shift the indexes of the items after it.
- **No stable order for a dictionary.** A `Map`, `Set` or `Record` is written
  in Luau's iteration order, so two equal values can produce different bytes.
  Both read back as equal values. Compare decoded values, not bytes.
- **Arrays without holes.** An array is written as Luau's length of it, which
  Luau does not define for an array with `nil` holes. Use a `Map` keyed by
  index for a sparse list.

## One call at a time

A serializer keeps its buffer and cursors between calls. A `serialize` must
not start while the same serializer's `serialize` is running, whatever its
type: the second call resets the cursor the first one uses, and the first then
returns wrong bytes without an error. The same holds for `deserialize`.

The `blobs` array is built and read through state the package shares between
all serializers. A `serialize` of a type with a blob field must therefore not
start while any other such `serialize` is running, and the same holds for
`deserialize`.

Two different serializers may otherwise overlap: one may run inside a call of
the other, and each returns what it returns when it runs alone.

A serializer runs code it did not generate only through the metamethods of a
table it is given, so both rules matter only for a value with a metatable:
when one of its metamethods serializes, or when the iterator its `__iter`
metamethod returns yields and another thread serializes before it resumes.

## Build errors

A type the transformer cannot encode is an `error TS surge:` diagnostic at
the property that holds it, and the call is left untransformed, so the build
fails. The list is in [supported-types.md](supported-types.md). A factory
call that runs untransformed at run time raises an error that says the
transformer is not registered in `tsconfig.json`.

The full contract is [specs/runtime-api.md](specs/runtime-api.md) sections 3
and 4, and 5.5 to 5.8 for calls that overlap.
