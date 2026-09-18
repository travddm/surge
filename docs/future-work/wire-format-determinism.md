# Future work: deterministic encoding for literal unions, guarded unions, and packed padding

Part of the [surge](../architecture.md) design. **The first two items are
correctness bugs in shipped behavior:** the same type can encode
differently in two builds.

## What

Transformer Design §3 in [transformer.md](../transformer.md) states that
field order is "a pure function of the property names in the type,
independent of file, compiler version, or iteration state", fixing fbs's
documented instability. That holds for object properties and tagged-union
variants (both sorted). It does not hold for:

- **`literal` value order.** `walkUnion` takes values in `type.types`
  order, which is the checker's type-id order: the order in which the
  literal types were first created while checking the whole program.
  Confirmed by walking `type Dir = "north" | "south" | "east"` after a full
  semantic check: alone it yields `["north", "south", "east"]`; with an
  unrelated earlier file declaring `const s: "south"` and `const e: "east"`
  it yields `["south", "east", "north"]`. Numeric literals flip the same
  way (`3 | 1 | 2` became `[2, 3, 1]`). The index byte for `"north"` is
  therefore `0` in one build and `2` in another that differs only in an
  unrelated file. Client and server compiled as separate `rbxtsc`
  programs, or a build after adding a file, can disagree on the wire
  format. This is the fbs bug §3 claims to have fixed.
- **`guardedUnion` variant order**, for the same reason. Confirmed:
  `1 | 2 | string` walks as `[str, 1, 2]` alone and `[str, 2, 1]` when an
  earlier file mentions the literal `2`.
- **Discriminant key choice.** `findDiscriminant` returns the first
  qualifying property in the declaration order of variant 0. When two keys
  qualify (`{ kind: "a"; sub: "x" } | { kind: "b"; sub: "y" }`), the choice,
  and hence the variant sort, depends on declaration order. Deterministic
  per declaration, but not per equivalent type.
- **Packed padding bits** (from code reading, not executed). `alloc()`
  never zeroes the reused scratch region and `packBit` writes one bit at a
  time, so the unused bits of a packed byte keep whatever an earlier
  `serialize` call left there. Equal values can produce unequal bytes, and
  those bits leak fragments of a previous payload. The design only
  disclaims byte-equality for `dict` fields.

## Why deferred

Each fix is a sort or a zero-fill, but changing any of them changes the
wire format for existing shapes, so they should land together with a note
in [schema-versioning.md](schema-versioning.md) and tests that pin the
result.

## How, briefly

- Sort `literal` values canonically before assigning indices (by
  `typeof`, then value; `undefined` last), and sort `guardedUnion`
  variants by kind then value. Both already happen for enum members.
- Choose the discriminant from name-sorted candidates.
- Zero the packed bytes, or better, compute the whole byte from all bits
  and issue one `buffer.writeu8` (also faster than one `packBit` call per
  bit).
- Tests: a two-program walk in `test/walk.test.ts` asserting identical
  `Field`s; a byte-equality assertion for a packed fixture in
  `coverage.spec.ts` after serializing a different, larger value first.
