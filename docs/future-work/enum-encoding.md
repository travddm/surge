# Future work: single enum-item-literal constant folding

Part of the [surge](../architecture.md) design.

## What

The index-overflow fix, the bare-`EnumItem` diagnostic, the O(1) lookup
table, and the `@rbxts/types` version-coupling note have all landed (see
Transformer Design's Type Coverage table and
[schema-versioning.md](schema-versioning.md) in [transformer.md](../transformer.md),
and the dedicated cases in the transformer repo's `test/walk.test.ts`/
`test/emit.test.ts`). No live `Enum.KeyCode` round trip in `coverage.spec.ts`
itself: this suite's headless Lune harness doesn't implement every real
`KeyCode` member (confirmed missing at least `ButtonBack`), and the O(1)
table eagerly constructs entries for all 283 members at module load, so
simply loading such a module under Lune throws. The width/table-lookup fix
is pinned instead by `emit.test.ts` and by `golden.test.mjs` against this
suite's own real compiled `coverage.spec.luau` (which does exercise a
smaller, fully-Lune-supported enum, `Enum.HumanoidRigType`, through the
same codegen path).

One item from the original review remains open: a single enum item used as
a type (`Enum.HumanoidRigType.R15` as a type, not a value) still classifies
as `enum` with a one-member list and costs one byte, where a
`literalConst` costs zero — the same optimization `literal` already gets
for a single literal value. Minor; not a correctness issue.

## Why deferred

`literalConst.value` is typed `string | number | boolean` (`field.ts`), so
representing a specific `EnumItem` there means widening that type (or
adding a new `Field` kind) and touching every place that already
pattern-matches on it: `literalValueExpr` (`emit/context.ts`),
`fieldToTypeNode` (`emit/types.ts`), and `guardFor` (`emit/write.ts`), plus
whatever `walk.ts` call site would produce it. That IR
change is larger than the one-byte saving justifies on its own; worth
doing together with a broader `literalConst` cleanup if one comes up,
not as a standalone change.

## How, briefly

- Either widen `literalConst`'s `value` to admit an `{ enumName, member }`
  shape, or add a dedicated `Field` kind for a single enum item constant.
- Update `literalValueExpr`, `fieldToTypeNode`, and `guardFor`
  (and any other exhaustive switch over `Field["kind"]`/`literalConst.value`)
  to handle it.
- Classify a single-item enum union (`walkEnum` called with one
  constituent) into the new representation instead of `enum`.
- Test: a round trip and a golden check that the field costs zero bytes.
