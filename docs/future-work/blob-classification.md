# Future work: an empty object type as zero bytes

Part of the [surge](../architecture.md) design.

## What

An empty object type, such as `{}` or `interface Empty {}`, walks to `blob`
(the last row of Transformer 4.1 in
[specs/transformer.md](../specs/transformer.md)), so its value goes through
the blob channel. It could encode as a zero-byte object instead.

## Why deferred

`@rbxts/compiler-types` declares `type defined = {}`, so a structural check
cannot tell an empty object type from `defined`, which admits any value
other than `nil`. A zero-byte encoding of `defined` would read a field that
holds a primitive, such as `5` or `"str"`, back as `{}`, and discard the value
without an error.

## How, briefly

- Decide how the walk tells the two apart before adding the zero-byte
  encoding: for example, a declaration-origin check on the alias symbol
  (`aliasSymbol.name === "defined"`, declared in `@rbxts/compiler-types`), as
  `detect.ts` already checks declarations in `@rbxts/types`, or `defined` left
  as a documented exception.
- Update Transformer 4.1 and [supported-types.md](../supported-types.md),
  which list `{}` as a blob, in the same change.
