# Future work: a fingerprint of a type's encoding

Part of the [surge](../architecture.md) design.

## What

The bytes identify neither the type nor the version that wrote them (Wire
format 3.3 in [specs/wire-format.md](../specs/wire-format.md)), so reading
them with a changed type reads wrong values instead of failing
([errors-and-guarantees.md](../errors-and-guarantees.md)). Bytes that outlive
their build reach this without a mistake: a `DataStore` value that one
release writes and the next release reads, or a message between servers that
run different releases during an update. A change the author did not make
reaches it too: an `@rbxts/types` update that adds an enum item can shift the
indexes after it ([schema-versioning.md](schema-versioning.md)).

The work is a value that the transformer computes from a type at compile
time, and that changes whenever the bytes the type writes would change. A game
compares it before reading bytes that another build may have written. It
detects a mismatch. Reading the old bytes anyway is
[schema-versioning.md](schema-versioning.md).

It must be optional and off by default. A call site that does not ask for it
emits nothing for it, writes the same bytes, and costs nothing at run time.
Asking for it must take one change at the call site.

## Why deferred

It needs a consumer. Nothing persists surge bytes across releases yet,
because neither package has a release
([ci-and-release.md](ci-and-release.md)), and no game has asked to detect a
changed type. The consumer also decides between the two ways to enable it
below. The design is small and depends on nothing else in this directory.

## How, briefly

- **Enable it in one of two ways.** Either meets the requirement above:
    - A factory of its own, such as `createFingerprint<T>()`, which the
      transformer replaces with a string literal. The game stores the value
      with its bytes, or exchanges it when a connection opens, and compares it
      itself. A call site that never calls the factory is unchanged.
    - An option on the existing factories, such as `fingerprint: true`, written
      as a literal like `checks` (Runtime API 3.8 in
      [specs/runtime-api.md](../specs/runtime-api.md)). `serialize` writes the
      fingerprint ahead of the value, and `deserialize` raises a string
      beginning `@rbxts/surge:` when it differs. The game compares nothing
      itself, and each value costs the fingerprint's bytes where the option is
      on.

    The factory leaves `Serializer<T>` as fbs defines it, and suits a caller
    that stores one fingerprint for many values. The option suits a caller that
    wants every read checked. Either updates Transformer 3 and Runtime API 3;
    the option also updates Wire format 3.3 for the call sites that set it.

- **Hash the `Field` tree**, not the TypeScript type. The tree is what the
  emitter writes from, so two types that walk to the same tree write the same
  bytes, and its order is already deterministic (Wire format 10.1). Include
  every property that changes a byte: each kind, width, count width or exact
  count, component width, the `packed` and `quantized` flags, literal values
  in canonical order, enum names and member lists, property names and whether
  each key is numeric, union variants in order, and the tag key.
- **Leave out what does not change a byte.** `helperName` is a generated
  identifier, so hash a `recursiveRef` as a reference to the position of its
  first occurrence in the walk. A `dict`'s `source` changes the TypeScript
  type that `deserialize` returns, not the bytes. Decide whether a `Map` that
  becomes a `Record` changes the fingerprint.
- **Mix in a wire format revision**: a number bumped by every change that
  moves a byte of any encoding. Without it, a transformer release that changes
  how a kind is written leaves every tree, and so every fingerprint,
  unchanged. [AGENTS.md](../../AGENTS.md) already requires such a change to
  update `bytes.spec.ts` and the size table in the same commit. The revision
  bump belongs to the same rule.
- **Compute it in Node at compile time** with `node:crypto`, truncated to 64
  bits and written as hex. It guards against an accidental mismatch, not
  against an adversary.
- **It is conservative.** An enum item added last shifts no index but still
  changes the fingerprint. Renaming a property changes it even where the
  field order, and so every byte, stays the same.
- A version tag byte, the first direction in
  [schema-versioning.md](schema-versioning.md), could carry the fingerprint.
