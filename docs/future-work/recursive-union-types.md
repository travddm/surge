# Future work: recursion through union and alias types

Part of the [surge](../architecture.md) design. **This is a correctness bug
in shipped behavior:** a recursive discriminated union crashes the whole
`rbxtsc` build instead of compiling to a helper.

## What

Transformer Design §6 in [transformer.md](../transformer.md) promises that
a type reappearing on its own walk path compiles to a named helper. That
detection exists only in `tryWalkObject` (`walk.ts`), keyed by the object
type's symbol. A union type has no such symbol, and `buildTaggedUnion`
walks each variant's properties directly without marking anything in
progress, so recursion that re-enters through the union never terminates.

Confirmed by executing the compiled walker (`Maximum call stack size
exceeded` in every case):

- `type Expr = { kind: "num"; v: number } | { kind: "add"; l: Expr; r: Expr }`
- The same with named variants:
  `interface Add { kind: "add"; l: Expr; r: Expr }` and
  `type Expr = Num | Add`.
- `type Node = Leaf | Branch` where `interface Branch { kids: Node[] }`.

Confirmed working (recursion re-enters through a named interface):
`interface TreeMap { children: Map<string, TreeMap> }`, and
`interface Cell { next?: { kind: "some"; cell: Cell } | { kind: "none" } }`.

AST-like and JSON-like shapes are exactly the recursive unions users write,
so this blocks a common shape entirely, and the failure is an uncaught
stack overflow from inside the compiler rather than a diagnostic.

## Why deferred

The walker needs a second recursion guard (on the union or alias type) and
the emitter needs helpers for a `Field` kind other than `object`
(`ensureHelper` in `emit.ts` throws unless the helper's field is an
`object`). Both are small, but they change the helper contract and need
tests, so they belong in their own change.

## How, briefly

- Track in-progress types by `ts.Type` identity (see
  [walk-type-identity.md](walk-type-identity.md)) for every kind the walk
  can re-enter through: union types and alias instantiations, not only
  object types.
- Let `helperFields` hold any `Field` and let `ensureHelper` emit a
  helper around `writeField`/`readField` generally. The `recursiveRef`
  call sites are already kind-agnostic.
- Until then, at minimum detect the re-entry and report a diagnostic
  naming the type, so the build fails with a message instead of a stack
  overflow.
- Tests: the three failing fixtures above in `test/walk.test.ts`, and an
  expression-tree round-trip fixture in `coverage.spec.ts`.
