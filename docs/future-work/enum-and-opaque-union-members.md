# Future work: enums and opaque values as union members

Part of the [surge](../architecture.md) design.

## What

Three union shapes are diagnostics (Transformer 4.4 and 7.2 in
[specs/transformer.md](../specs/transformer.md)) that the write side could
support:

- **A whole enum next to another type.** `Enum.SortOrder | string` reaches
  `classifyUnion` as the constituents `Custom`, `LayoutOrder`, `Name`, and
  `string`, because TypeScript flattens the enum's own union. Each item walks
  as its own one-member `enum` variant, so the duplicate-runtime-type rule
  reports `two or more variants that are all "EnumItem" at runtime`. A single
  item (`Enum.SortOrder.Name | string`) and an optional enum
  (`Enum.SortOrder | undefined`) both work.
- **Items from two enums.** A union such as
  `Enum.SortOrder | Enum.HumanoidRigType`, or
  `Enum.AutomaticSize.None | Enum.ActuatorType.None`, reports a diagnostic
  that names both enums. Support is stage 2 below.
- **An opaque value next to another type.** `Instance | string` and
  `Vector2int16 | string` report the "opaque variant" diagnostic, and the
  user must type the whole field as `unknown`, which also moves the `string`
  to the blob channel. `unknown | string` is not affected: TypeScript reduces
  it to `unknown`.

## Why deferred

Each shape is a diagnostic, not a wrong encoding, so the work is support
rather than a fix. Support for the first three shapes changes the
`guardedUnion` variant order, which is part of the wire format (Wire format
5.7 in [specs/wire-format.md](../specs/wire-format.md)). `bytes.spec.ts` pins
no union with an enum or opaque member, so these stages move no pinned
buffer; pin the new shapes when they land.

## How, briefly

`enumOf` in `walk.ts` reads an item's enum from `item.symbol.parent`. The two
enum stages group constituents by it.

- **Stage 1, group enum items before classifying.** In `walkUnionBody`,
  partition the non-`undefined` constituents into enum items, grouped by
  `enumOf`, and the rest. Walk each group with `walkEnum` to get one `enum`
  variant per enum, then pass those variants and the remaining constituents
  to `classifyUnion`. `Enum.SortOrder | string` then has one `enum` variant
  and one `str` variant, which the existing `typeIs(value, "EnumItem")` guard
  already decides; no emitter change is needed for that case.
- **Stage 2, more than one enum in a union.** Give `RUNTIME_TYPE_TAGS` a
  per-enum tag (`EnumItem:SortOrder`) so two enums are not duplicates, and
  make `guardFor` emit
  `typeIs(value, "EnumItem") && value.EnumType === Enum.SortOrder` when the
  union has more than one `enum` variant. That expression passes the type
  checker against `@rbxts/types`, and under Lune 0.10.5
  `Enum.SortOrder.Name.EnumType == Enum.SortOrder` is `true` and the
  comparison with another enum is `false`. The roblox-ts lowering of the
  generated expression is unverified. `classifyUnion` sorts variants by kind,
  and within one kind sorts only `literalConst` and `datatype` variants, so
  two `enum` variants need a second sort key (`enumName`); without it the
  variant index depends on the checker's type-id order.
- **Opaque variant as the fallthrough.** `writeGuardedUnion` never guards the
  last variant, and every other variant has a positive check, so one `blob`
  variant is sound if it is always last. Sort `blob` after every other kind
  in `classifyUnion`, merge every opaque constituent into that one variant
  (they all write and read through `pushBlob`/`nextBlob`), and drop the
  "opaque variant" rejection. `Instance | string` then costs one index byte,
  with the string in the buffer and the `Instance` in the blob channel.
  Round-trip fixtures: `Vector2int16 | string`, and `Instance | string` with
  a Lune data-model `Part` (as `roblox.spec.ts` builds one).
- Update Transformer 4.4 and 7.2, and Wire format 5.7, with each stage that
  lands.
