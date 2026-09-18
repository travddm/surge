# Future work: key the type walk's caches by type identity, not symbol

Part of the [surge](../architecture.md) design. **This is a correctness bug
in shipped behavior, not a parity gap:** a shape that reaches one generic
declaration through two different instantiations encodes at least one of
them wrongly, with no diagnostic.

## What

`TypeWalker` (`rbxts-transformer-surge/src/walk.ts`) memoizes each resolved
object `Field` in `resolved`, tracks recursion in `inProgress`, and assigns
recursion helper names in `helperNames`, all keyed by `ts.Symbol`. Every
instantiation of one generic declaration shares that declaration's symbol,
so the walker cannot tell `Box<number>` from `Box<string>`.

Confirmed by executing the compiled walker against throwaway `ts.Program`s
(every case below is a real result, not a reading of the code):

- `interface Box<T> { v: T }` with `{ a: Box<number>; b: Box<string> }`:
  `b` comes back as `{ v: num f64 }`. `serialize` calls `buffer.writef64`
  on a string.
- `Readonly<A>` next to `Readonly<B>`, `Partial<A>` next to `Partial<B>`,
  and `type Pair<T> = { first: T; second: T }` used at two element types
  all collide the same way. Mapped-type instantiations share the mapped
  type's `__type` symbol, so this is not limited to user generics.
- `interface Wrapper<T> { inner: T }` with a field of type
  `Wrapper<Wrapper<number>>`: the inner instantiation is found "in
  progress" and becomes a `recursiveRef`. The emitted helper calls itself
  on `value.inner` forever (write: indexes `.inner` on a number and
  errors; read: unbounded recursion).
- The residual gap already noted in [transformer.md](../transformer.md)
  (a self-referential type reused both plain and inside `Packed<T>` gets
  one helper) reproduces: `interface Node { flag: boolean; next?: Node }`
  used as `plain: Node` and `packed: DataType.Packed<Node>` resolves both
  recursion points through the packed helper, so `plain.next` is read
  with the packed bit layout.

None of the existing tests can see this: `test/walk.test.ts` never walks
two instantiations of one generic in the same walk, and
`tests/src/tests/*.spec.ts` has no generic shape.

## Why deferred

Found by the review; the fix changes the walker's identity model (three
maps plus `getHelperFields`, and how helper names are derived), so it
needs its own change with regression tests rather than a patch inside the
review.

## How, briefly

- Key `resolved`, `inProgress`, and `helperNames` by the `ts.Type` object
  (plus `packed`), not by `type.symbol`. The checker interns
  instantiations: `Box<number>` reached from two places is one `ts.Type`,
  and `Box<string>` is a different one. Symbol plus type arguments is not
  enough, because an anonymous alias body (`type Pair<T> = { ... }`) has
  the same `__type` symbol for every instantiation.
- Derive helper names from the symbol name plus the existing counter (the
  type object has no stable name); two instantiations then get two
  helpers, which is what the emitter already supports.
- Include `packed` in the helper key so the plain/packed residual gap
  closes at the same time.
- Regression tests in `test/walk.test.ts`: the four fixtures above,
  asserting the second instantiation's `Field` and that
  `Wrapper<Wrapper<number>>` produces no `recursiveRef`. Add a generic
  round-trip fixture to `tests/src/tests/coverage.spec.ts`.
