# Future work: read-side evaluation order for helper calls and blobs

Part of the [surge](../architecture.md) design. **This is a correctness bug
in shipped behavior:** `deserialize` reads some fields in a different order
than `serialize` wrote them.

## What

`readObjectInline` (`emit.ts`) pushes each field's read _statements_ into
the enclosing block in field order, but returns each field's read
_expression_ to be evaluated later, inside the object literal. That is
sound only while every expression that advances a cursor is preceded by
the statement that reserved its bytes. Two field kinds return a bare,
side-effecting expression with no statement:

- an `object` with a `helperName` or a `recursiveRef`, whose read is the
  expression `surge_X_read()`;
- a `blob`, whose read is the expression `nextBlob()`.

Confirmed by printing the emitter's output:

- `interface Wrap { inner: Tree; zebra: number }` with
  `interface Tree { kids: Wrap[] }`. Write order is `inner` then `zebra`
  (name-sorted). The read emits `readAlloc(8)` for `zebra` first, then
  evaluates `surge_Tree_1_read()` inside the literal, so `zebra` reads the
  first 8 bytes of `inner`'s data and the helper reads from the wrong
  offset.
- `interface T { a: unknown; b?: { x: unknown } }`. Write pushes `a` then
  `b.x`. The read consumes `b.x` inside the `if (present)` statement and
  only then `a` in the return literal: the two blobs are swapped.

Any shape that mixes a required recursive field (or a blob) with a sibling
whose read needs statements (numbers, strings, optionals, arrays, unions)
is affected. The existing `TreeNode` fixture escapes it only because its
recursive field is reached through an array, whose read is statement
based.

## Why deferred

The fix is a small, contained change to `readField`, but it touches the
core read path and deserves a golden test that pins statement order, so it
is recorded here rather than patched during the review.

## How, briefly

- In `readField`, bind every side-effecting expression to a `const` in
  statement order (`recursiveRef`, `object` with helper, `blob`), and
  return the identifier. Binding only these kinds keeps the local count
  low (see the local-register ceiling in
  [generated-code-performance.md](generated-code-performance.md)).
- Alternative: bind every field in `readObjectInline` to a local before
  building the literal. Simpler, but costs one local per field.
- Tests: round-trip fixtures for both shapes above; a golden check in
  `test/golden.test.mjs` that, for a recursive fixture, the helper call
  appears before the next `readAlloc` in the compiled Luau.
