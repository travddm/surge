# Future work: single enum-item-literal constant folding

Part of the [surge](../architecture.md) design.

## What

A single enum item used as a type, such as `Enum.HumanoidRigType.R15` in a
type position, walks to an `enum` with a one-member list (Transformer 4.1 in
[specs/transformer.md](../specs/transformer.md)) and costs a one-byte index
(Wire format 4.12 in [specs/wire-format.md](../specs/wire-format.md)). A
`literalConst` would cost zero bytes, which is what a single literal value
already gets. Minor; not a correctness issue.

## Why deferred

`literalConst.value` is typed `string | number | boolean | undefined`
(`field.ts`), so representing a specific `EnumItem` there means widening that
type, or adding a new `Field` kind, and touching every place that already
pattern-matches on it: `literalValueExpr` (`emit/context.ts`),
`fieldToTypeNode` (`emit/types.ts`), and `guardFor` (`emit/write.ts`), plus
whatever `walk.ts` call site would produce it. That IR change is larger than
the one-byte saving justifies on its own. It is worth doing together with a
broader `literalConst` cleanup, not as a standalone change.

## How, briefly

- Either widen `literalConst`'s `value` to admit an `{ enumName, member }`
  shape, or add a dedicated `Field` kind for a single enum item constant.
- Update `literalValueExpr`, `fieldToTypeNode`, and `guardFor`, and any other
  exhaustive switch over `Field["kind"]` or `literalConst.value`, to handle
  it. `compareLiteral` in `walk.ts` orders two `literalConst` variants of a
  `guardedUnion` by `typeof`, then by value (Wire format 5.7), so an enum item
  constant needs a place in that order too.
- Classify a single-item enum union (`walkEnum` called with one constituent)
  into the new representation instead of `enum`.
- Test: a round trip and a golden check that the field costs zero bytes.
