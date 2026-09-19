# Future work: enums and opaque values as union members

Part of the [surge](../architecture.md) design. Found while the walker and
emitter robustness fixes landed (`rbxts-transformer-surge` `4067844`). Each
item was confirmed by executing the walker on the quoted type, and the
build errors by compiling a probe file with `rbxtsc`, unless marked
otherwise.

## What

- **A union of items from two enums is rejected.** It used to be merged
  into one `enum` under the first enum's name, which was a build error in
  generated code (`Enum.SortOrder | Enum.HumanoidRigType`) or, when both
  enums had a member of the same name
  (`Enum.AutomaticSize.None | Enum.ActuatorType.None`), a wrong value with
  no error. Stage 1 below has landed: `walkEnum` compares the declaring
  enum of each item by symbol identity and reports a diagnostic that names
  both enums. Support for the shape is stage 3.
- **A whole enum next to another type is rejected.**
  `Enum.SortOrder | string` reaches `classifyUnion` as the constituents
  `Custom`, `LayoutOrder`, `Name`, and `string`, because TypeScript
  flattens the enum's own union. Each item walks as its own one-member
  `enum` variant, so the duplicate-runtime-type rule reports
  `two or more variants that are all "EnumItem" at runtime`. A single item
  (`Enum.SortOrder.Name | string`) and an optional enum
  (`Enum.SortOrder | undefined`) both work. This is a diagnostic, not a
  wrong encoding: before the robustness fixes it crashed the emitter.
- **An opaque value next to another type is rejected.** `Instance | string`
  and `Vector3int16 | string` report the "opaque variant" diagnostic, and
  the user must type the whole field as `unknown`, which also moves the
  `string` to the blob channel. `unknown | string` is not affected:
  TypeScript reduces it to `unknown`. The rejection was the option
  walker-emitter-robustness.md named; the alternative below keeps the
  other variants in the buffer.
- **One rejected constituent reports two diagnostics.**
  `EnumItem | string` reports the bare-`EnumItem` diagnostic, then the
  constituent's `blob` fallback triggers the "opaque variant" diagnostic
  for the same union. The second message is noise.

## Why deferred

None of these was in walker-emitter-robustness.md's list, so they were
recorded, not fixed, when that work landed. The one case where a valid
type produced a wrong value is now a diagnostic (stage 1), and a user type
with the `Name`/`Value`/`EnumType` properties no longer walks as an enum:
`isEnumItemLike` requires a declaration in `@rbxts/types`. No remaining
item is a wrong encoding. Full support for the first three items
changes the `guardedUnion` variant order, which is part of the wire
format. `bytes.spec.ts` pins no union with an enum or opaque member, so
these stages move no pinned buffer; pin the new shapes when they land.

## How, briefly

- **Stage 1 has landed.** `enumOf` in `walk.ts` reads an item's enum from
  `item.symbol.parent`; the later stages group by it.
- **Stage 2, group enum items before classifying.** In `walkUnionBody`,
  partition the non-`undefined` constituents into enum items, grouped by
  `enumOf`, and the rest. Walk each group with `walkEnum` to get one `enum`
  variant per enum, then pass those variants and the remaining constituents
  to `classifyUnion`. `Enum.SortOrder | string` then has one `enum` variant
  and one `str` variant, which the existing `typeIs(value, "EnumItem")`
  guard already decides; no emitter change is needed for that case.
- **Stage 3, more than one enum in a union.** Give `RUNTIME_TYPE_TAGS` a
  per-enum tag (`EnumItem:SortOrder`) so two enums are not duplicates, and
  make `guardFor` emit
  `typeIs(value, "EnumItem") && value.EnumType === Enum.SortOrder` when the
  union has more than one `enum` variant. Confirmed: that expression
  passes the type checker against `@rbxts/types`, and under Lune 0.10.5
  `Enum.SortOrder.Name.EnumType == Enum.SortOrder` is `true` and the
  comparison with another enum is `false`. Not confirmed: the roblox-ts
  lowering of the generated expression. `classifyUnion` sorts variants by
  kind only, so two `enum` variants need a second sort key (`enumName`);
  without it the variant index depends on the checker's type-id order.
- **Opaque variant as the fallthrough.** `writeGuardedUnion` never guards
  the last variant, and every other variant has a positive check, so one
  `blob` variant is sound if it is always last. Sort `blob` after every
  other kind in `classifyUnion`, merge every opaque constituent into that
  one variant (they all write and read through `pushBlob`/`nextBlob`), and
  drop the "opaque variant" rejection. `Instance | string` then costs one
  index byte, with the string in the buffer and the `Instance` in the blob
  channel. Round-trip fixtures: `Vector3int16 | string`, and
  `Instance | string` with a Lune data-model `Part` (as `roblox.spec.ts`
  builds one).
- **Cascading diagnostic.** In `classifyUnion`, record
  `this.diagnostics.length` before walking the constituents and return
  `{ kind: "blob" }` without further checks when it grew.
- Update the `guardedUnion` row of Type Coverage and Transformer Design §8
  in [transformer.md](../transformer.md) with each stage that lands.
