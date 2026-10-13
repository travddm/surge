# Future work: pack an object's bits without `Packed<T>`

Part of the [surge](../architecture.md) design.

## What

Every object packs the bits that `Packed<T>` packs today, whether or not it
is in a packed subtree: a `bool` property, an `optional` property's presence,
and the tag of a two-variant `taggedUnion` property are each a bit of the
object's packed region (Wire format 8.1 to 8.5 in
[specs/wire-format.md](../specs/wire-format.md)). The rule of 8.1 stays: only
a direct property of an object. A `bool`, an `optional` or a tag anywhere
else, such as an array's element, keeps its byte.

`Packed<T>` keeps the two encodings that are not always smaller than the form
they replace: the packed `cframe` of 8.6 and the `bitSet` of 8.8. A shape
inside `Packed<T>` writes the same bytes as before. A shape outside it
changes wherever an object has one of the three kinds of property above.

## Why

- No shape grows. A region of n bits is ⌈n/8⌉ bytes, and the same values
  take n bytes unpacked.
- On the one shape measured, the packed form decodes at or above the
  unpacked shape's rate since the region is read in place
  ([research/packed-bits-read-in-place.md](../research/packed-bits-read-in-place.md)),
  and encodes within the noise
  ([research/packed-against-unpacked.md](../research/packed-against-unpacked.md)).
- Today the saving goes only to an author who knows to write `Packed<T>`. Zap
  packs a struct's booleans and optional presence by default, and keeps a
  byte for each element of an array of booleans
  ([research/type-coverage-across-libraries.md](../research/type-coverage-across-libraries.md)):
  the line 8.1 draws.

Not in this change:

- The packed `cframe`. An arbitrary rotation is a byte larger and slower to
  encode packed
  ([research/packed-against-unpacked.md](../research/packed-against-unpacked.md)),
  and only the author knows whether a shape's rotations are axis-aligned.
- The `bitSet`. With at most 8 values it is never larger than the `dict` it
  replaces, and above that its size against the `dict` depends on what the
  set holds. Its speed is not measured. Applied to every `Set` of literal
  values, it would make `Length` on such a set the diagnostic `walkLength`
  reports inside `Packed<T>`, for a shape that compiles today.

## Why deferred

- Two emission paths are slower for an object with a packed region than for
  the same object without one. Packing every object moves shapes that take
  the fast paths today onto the slow ones, so those paths change first.
- It changes the bytes of most shapes. The first release freezes them for a
  game that persists surge bytes
  ([schema-fingerprint.md](schema-fingerprint.md)), so it lands before that
  release or waits for [schema-versioning.md](schema-versioning.md).

## How, briefly

- First, in `rbxts-transformer-surge/src/emit/`, so that a region costs a
  shape none of its fast paths. Each is worth having for a `Packed<T>` shape
  on its own, and is measured with scoped speed runs
  ([testing.md](../testing.md#benchmarks)) before the default changes:
    - `measureObject` in `size.ts` returns `undefined` for an object whose
      region holds a tag bit, so the `serialize` loses the exact size of
      Transformer 5.20 and grows its buffer
      ([specs/transformer.md](../specs/transformer.md)). It sizes the variant
      the tag selects, as an unpacked `taggedUnion`'s size does.
    - `fixedBytes` in `layout.ts` returns `undefined` for an object with a
      packed region, so the object leaves the shared reservation of
      Transformer 5.5. A region of `bool` bits alone is a fixed size, which
      `constantSize` in `size.ts` already counts, so such an object can join
      the run.
- Then the bits. `packedBits` and `isAllPackedBits` in `emit/layout.ts` take
  every direct `bool`, `optional` and two-variant `taggedUnion` property, and
  the `packed` flag leaves those three kinds in `field.ts`. The walk's
  `packed` parameter remains for `cframe` and `bitSet`.
- Every other read of that flag takes the bit from `packedBits` instead: the
  write of a property in `emit/write.ts`, and `minBytes` in `emit/layout.ts`,
  which must not count a byte that a bit replaces. `minBytes` leaves the
  region out today, so with a region in every object, `readChecks` bounds
  each object with a `bool` lower than it can until the region is counted.
- Wire format 4.3, 5.5, 8.1 to 8.5 and 9.3 state the region for every
  object, and Transformer 4.1's `Packed<T>` row, 5.5, 5.20, 5.24 and 5.25
  follow. [data-types.md](../data-types.md)'s Packing section keeps only the `cframe`
  and the `bitSet`, [supported-types.md](../supported-types.md)'s `boolean`
  and optional rows drop "inside `Packed<T>`", and `Packed`'s JSDoc in
  `surge/src/data-type.ts` and its fixture copy follow.
- `bytes.spec.ts` pins the region outside `Packed<T>`, `mise run bench:size`
  re-records the size table, and `mise run bench:code` the code-size table. In the catalog, surge's
  `toggles (unpacked)` row writes the packed bytes; the row stays for fbs and
  serio, and its description changes.
- Open: a two-value `literal`, such as `"left" | "right"`, could be one bit
  of the region as a two-variant tag is. A `literal` or `enum` of more values
  would take a field of several bits, which is a wire-format rule of its own.
