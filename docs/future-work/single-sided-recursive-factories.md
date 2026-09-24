# Future work: recursive types under a single-sided factory

Part of the [surge](../architecture.md) design.

## What

`createSerializer<T>()` and `createDeserializer<T>()` fail to build when `T`
is recursive. The generated TypeScript does not type-check, so `rbxtsc` stops
on an error inside code the user cannot open, with no surge diagnostic. On
`interface Node { v: number; next?: Node }`, `createSerializer` reports 6 type
errors (`Cannot find name '__surge_readCursor'`) and `createDeserializer`
reports 20 (`Cannot find name '__surge_cursor'`). `createBinarySerializer`
on the same type builds. This is Transformer 5.13 in
[specs/transformer.md](../specs/transformer.md).

## Why deferred

It was found by the review of the specifications, after the code it affects
had landed, and fixing it is a transformer change with its own tests. Nothing
in the benchmark catalog or the round-trip suite uses a single-sided factory
on a recursive type, which is why no test caught it.

## How, briefly

- The cause: `ensureHelper` in the transformer's `src/emit/index.ts` always
  emits both `<name>_write` and `<name>_read`, and `buildReplacement` in
  `src/index.ts` declares only the state of the side the factory returns
  (`writeStateDecls` or `readStateDecls`). The other side's helper then
  names state that does not exist.
- Two fixes. Emit only the helpers of the side the factory returns, which
  keeps the output minimal and needs `ensureHelper` to know the side. Or
  declare both sides' state whenever a helper exists, which is simpler and
  leaves dead code in the output. The first also fixes Transformer 6.4, where
  a `createDeserializer` call site imports `finishWrite` and `grow`.
- Pin it in the `transform generated code` block of `test/transform.test.ts`,
  with the `typeErrorsOfGeneratedCode` check that block already uses: each of
  the three factories on a recursive object and on a recursive union, with
  zero type errors. Then remove 5.13 from the
  specification.
