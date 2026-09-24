# Errors and guarantees

What each side checks, what it raises, and what it leaves to the game.

```ts
import { createBinarySerializer, createDeserializer } from "@rbxts/surge";

// Bytes this game wrote, such as its own DataStore: no checks needed.
const inventory = createBinarySerializer<Inventory>();

// Bytes a client sent: bounded reads, and a pcall around every call.
const readRequest = createDeserializer<TradeRequest>({ checks: true });

const [ok, request] = pcall(() => readRequest(input, blobs));
```

## Two options

|                | `checks`                                                                                                                | `writeChecks`                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Governs        | `deserialize`                                                                                                           | `serialize`                                                                                              |
| Guards against | bytes that did not come from `serialize`                                                                                | a value that does not fit its `DataType` brands                                                          |
| Rejects        | a read past the end, a count the rest cannot hold, an enum index past its items, a packed rotation code that names none | an exact `Length<T, N>` value that is not `N` long, a count too large for its `u8`, `u16` or `u24` width |
| Taken by       | `createDeserializer`, `createBinarySerializer`                                                                          | `createSerializer`, `createBinarySerializer`                                                             |
| Costs          | a branch per read                                                                                                       | a branch per container                                                                                   |

Both default to `false`, and both must be written as `true` or `false` at the
call site, because they decide what code is generated. Every error either one
raises is a string that begins `@rbxts/surge:`, so a `pcall` can tell it
from an error in the game's own code.

## Reading bytes from a client

Without `checks`, `deserialize` trusts its input. Given bytes no `serialize`
of the same type wrote, it may raise an unrelated Luau error, return a wrong
value, or loop for as long as a count in the input says. Use `checks: true`
wherever the bytes come from outside the game's own code, which a
`RemoteEvent` is, and call it in a `pcall`.

With `checks`, an input that passes deserializes to a value of the declared
type. It does not follow that the value is one the game accepts. A number
can be any number its width holds, a string any string, and a count any count
the input has the bytes for. Validate what the game depends on after the
`pcall` succeeds.

A blob field holds whatever the `blobs` array holds at its position, and
`checks` does not examine it. A client can put any value there, so check a
blob field's type before using it. Reading past the end of `blobs` raises
with or without `checks`, and so does reading a blob field when no `blobs`
array was passed.

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

`writeChecks: true` makes the second and third raise before anything is
written. It does not examine numbers.

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

## One call at a time with blobs

The `blobs` array is built and read through state the package shares between
all serializers. A `serialize` of a type with a blob field must not start
while another such `serialize` is running, and the same holds for
`deserialize`. A serializer only runs code it did not generate through a
value's metamethods, so this matters only when a metamethod serializes.

## Build errors

A type the transformer cannot encode is an `error TS surge:` diagnostic at
the property that holds it, and the call is left untransformed, so the build
fails. The list is in [supported-types.md](supported-types.md). A factory
call that runs untransformed at run time raises an error that says the
transformer is not registered in `tsconfig.json`.

The full contract is [specs/runtime-api.md](specs/runtime-api.md) sections 3
and 4.
