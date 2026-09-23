# Future work: a `Map` or `Set` key the generated code cannot type

Part of the [surge](../architecture.md) design.

## What

`readDict` (the transformer's `emit.ts`) rebuilds a `Map`, `Set`, or
`Record` into a local it declares as `Record<K, V>`, starting from `{}` and
filled by `result[key] = value` in the read loop. That type node is the
problem, not the code it types: the Luau it compiles to is correct for every
key, and only the intermediate TypeScript fails to check.

Two shapes fail, both with no diagnostic. The user sees a type error in
generated code that is not in any file they wrote, at a position they cannot
open, and only because `roblox-ts` type-checks what the transformer emits
before it emits.

- **A key that is not a TypeScript index type.** `Record<K, V>` constrains
  `K` to `string | number | symbol`, so every Roblox datatype key fails:
  `Vector3`, `Vector2`, `Vector3int16`, `CFrame`, `Color3`, `BrickColor`,
  `buffer`, and an `Enum.*` member. Each is a perfectly good Luau table key,
  and `Map<Vector3, number>` is an ordinary thing to write.
- **A key that is a literal union.** `Record<"a" | "b", V>` requires every
  one of its keys, so the `{}` the loop starts from is missing them and the
  declaration fails before a single entry is read. This one is a defect of
  the initializer rather than of the key.

The walker accepts all of these: they are `dict` fields with a `str`, `num`,
`datatype`, `enum`, or `literal` key, and Type Coverage in
[transformer.md](../transformer.md) says a dictionary key may be any of
them. So the coverage table promises a shape the emitter cannot type.

## Why deferred

It is a compile-time failure, loud and immediate, with no wrong bytes and no
silent fallback: a user who writes one of these shapes cannot ship it by
accident. Nothing in the checked-in catalog uses such a key, so no encoding
and no recorded number moves when it is fixed. It was found while writing
the fixtures for the `checks` option, where a `Set<Vector3>` was swapped for
a `Set<string>` to keep that unit to its own subject.

## How, briefly

- The reconstruction needs a type the key does not constrain. Declaring the
  local as `Map<K, V>`/`Set<K>` is not it: the loop writes with bracket
  assignment, which those do not have. The narrow fix is to declare it as
  something unconstrained and cast once at the end, where the read side
  already casts to the real shape -- `readDict` returns that cast today, so
  the change is the declaration and not the loop.
- Whatever the declaration becomes, it has to keep the `source` distinction
  it exists for: a `Record` must still come back as a `Record` and not as a
  non-functional `Map` (see the note above `recordType` in `emit.ts`).
- One case per key kind in `transform.test.ts`'s type-check-the-generated-
  code suite, which is where every earlier instance of this class of bug is
  pinned, plus a round-trip fixture for a datatype key and a literal-union
  key in `collections.spec.ts`.
- Check the same two questions for a `dict` **value**, which
  `fieldToTypeNode` types the same way, and for a `Record` whose key is a
  branded number, which types today but should stay covered.
