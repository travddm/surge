# Future work: enums and opaque values as union members

Part of the [surge](../architecture.md) design. Found while the walker and
emitter robustness fixes landed (`rbxts-transformer-surge` `4067844`). Each
item was confirmed by executing the walker on the quoted type, and the
build errors by compiling a probe file with `rbxtsc`, unless marked
otherwise.

## What

- **A union of items from two enums is merged into one enum.**
  `walkUnionBody` sends a union to `walkEnum` when every constituent has
  the `Name`/`Value`/`EnumType` properties. `walkEnum` collects every
  member name into one list and takes `enumName` from the first
  constituent only. `Enum.SortOrder | Enum.HumanoidRigType` walks as one
  `enum` with `enumName: "SortOrder"` and the five members of both enums
  (`Custom`, `LayoutOrder`, `Name`, `R15`, `R6`), with no diagnostic. Two
  outcomes:
    - **Build error in code the user cannot see.** The emitter declares
      `[Enum.SortOrder.Custom, ..., Enum.SortOrder.R15, Enum.SortOrder.R6]`,
      and `rbxtsc` reports
      `TS2339: Property 'R15' does not exist on type 'typeof SortOrder'` at
      a line and column of the transformed source, not of the user's file.
    - **Wrong value with no error**, when both enums have a member of the
      same name. `Enum.AutomaticSize.None | Enum.ActuatorType.None` walks
      as `{ enumName: "AutomaticSize", members: ["None", "None"] }`. Every
      generated reference (`Enum.AutomaticSize.None`) exists, so the build
      passes. The write-side index map is keyed by `value.Name`, so both
      values write the same index, and `Enum.ActuatorType.None` reads back
      as `Enum.AutomaticSize.None`. (The walk was executed; the read result
      is from code reading of `ensureEnumTable`.)
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
- **A user type that looks like an enum item is classified as one.**
  `isEnumItemLike` is structural.
  `interface Item { Name: "Sword"; Value: number; EnumType: string }` walks
  as `{ kind: "enum", enumName: "Enum", members: ["Sword"] }`, and the
  emitter refers to `Enum.Enum.Sword`. This is the same class of bug that
  [blob-classification.md](blob-classification.md) fixed for
  `ROBLOX_SCALAR_KINDS` by checking the declaration's package.
- **One rejected constituent reports two diagnostics.**
  `EnumItem | string` reports the bare-`EnumItem` diagnostic, then the
  constituent's `blob` fallback triggers the "opaque variant" diagnostic
  for the same union. The second message is noise.

## Why deferred

None of these was in walker-emitter-robustness.md's list, so they were
recorded, not fixed, when that work landed. The first item is the only
known case where a valid type produces a wrong value; its diagnostic form
is small and should land first. Full support for the first three items
changes the `guardedUnion` variant order, which is part of the wire
format. `bytes.spec.ts` pins no union with an enum or opaque member, so
these stages move no pinned buffer; pin the new shapes when they land.

## How, briefly

- **Identify the enum by symbol, not by shape or name.** In `walkEnum`,
  read each constituent's enum from `constituent.symbol.parent`, require
  `isFromTypesPackage` on it (closes the lookalike item), and compare
  parents by identity.
- **Stage 1, diagnostic only.** When the constituents of one `walkEnum`
  call have more than one parent, report a diagnostic naming both enums.
  About ten lines, plus one `walk.test.ts` case for two whole enums and one
  for the same-member-name case.
- **Stage 2, group enum items before classifying.** In `walkUnionBody`,
  partition the non-`undefined` constituents into enum items, grouped by
  parent, and the rest. Walk each group with `walkEnum` to get one `enum`
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
