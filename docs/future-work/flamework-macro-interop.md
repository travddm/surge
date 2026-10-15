# Future work: a factory call inside a Flamework macro's arguments

Part of the [surge](../architecture.md) design.

## What

A surge factory call written inside the arguments of a Flamework macro that
takes caller metadata makes Flamework's transformer fail at compile time. For
example, runit's `Assert.equal` takes the line, character and text of its
call (`Modding.CallerMany<"line" | "character" | "text">`), so this does not
compile:

```ts
Assert.equal(undefined, difference(value, createCodec<Reading>().deserialize(buffer)));
```

`rbxtsc` stops with `TypeError: Cannot read properties of undefined (reading
'text')` from `rbxts-transformer-flamework`. A factory assigned to a local or
a module constant, the form [getting-started.md](../getting-started.md)
shows, is not affected.

surge's transformer runs before Flamework's, as getting-started.md
recommends. It replaces the factory call with the generated code, and
TypeScript's visitor then rebuilds every node that encloses the call,
including the macro's call. A rebuilt node has no parent, so
`node.getSourceFile()` returns `undefined`. Flamework's `getCallerMetadata`
(`out/transformations/transformUserMacro.js` in
`rbxts-transformer-flamework` 1.3.2) calls `node.getStart()` on the macro's
call, which throws. Its error report then calls `getStart()` on the same
node, which throws again and ends the compile.

The failure does not depend on what replaces the call. It occurs with the
transformer before Transformer 5.1 replaced an empty closure with its
functions (`3f90aff`), and after it (`7532ee9`).

## Why deferred

The fix belongs in Flamework, and reporting it upstream is a separate
decision. The pattern is rare outside tests, and assigning the factory's
result, or the value read through it, to a local first avoids it.

## How, briefly

- The transformers' order is the consumer's, set in their `tsconfig.json`.
  surge runs before Flamework because Flamework rewrites its macros into
  nodes surge never needs to read. Running after Flamework would hand surge
  nodes that Flamework rebuilt.
- surge cannot keep TypeScript from rebuilding the nodes around a node it
  replaces, so the macro's call has no source file whatever surge emits.
- The fix is one of these:
    - **Upstream.** Flamework reads caller metadata from
      `ts.getOriginalNode(node)`, which still has its source file. A test in
      `tests/src/tests/factories.spec.ts` would then call `Assert.equal` with
      a factory call inside its arguments.
    - **Documented.** getting-started.md states the limitation and the
      workaround, next to the order of the transformers.
- `roundTripsThroughFactoriesCalledInPlace` in
  `tests/src/tests/factories.spec.ts` reads its results into locals for this
  reason, and its comment says so.
- Flamework's catch block in `out/transformations/transformNode.js` hides
  the first error: printing `e.stack` there shows the throw in
  `getCallerMetadata`.
