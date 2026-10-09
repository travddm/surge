# Flamework 2 as a benchmark column

2026-10-09 · surge `0201459` · `@flamework-experimental/core` and
`@flamework-experimental/transformer` 2.0.0-alpha.8, documentation read at
`Velover/ExperimentalFlameworkV2` `6f201a7` · Lune 0.10.5

## Abstract

This asks whether the experimental Flamework 2's `Flamework.createSerializer`
can be a column of the benchmark, and what it writes. It cannot build in
`tests/` beside Flamework 1, so a project of its own builds it. It expresses
18 of the catalog's 21 rows, every one but the three packed rows, and each
round-trips exactly under Lune. Its bytes are smaller than surge's wherever a
count or a length appears, and larger on enums, `CFrame`s and blobs. Its
modules are larger than surge's on 16 of the 18 rows.

## Background

The benchmark's other columns are runtime interpreters reached through a
Flamework 1 macro (fbs and serio) and compilers of an IDL (Blink and Zap).
None generates code from a TypeScript type at build time, as surge does.
Flamework 2, published under `@flamework-experimental` as an alpha, does:
`Flamework.createSerializer<T>()` returns a `serialize` and a `deserialize`
that its transformer generates for `T`, the code that also packs its
networking payloads. A library earns a column by being one a consumer would
weigh against surge, and by expressing enough of the catalog for its cells to
mean something
([type-coverage-across-libraries.md](type-coverage-across-libraries.md)).

## Method

**Beside Flamework 1.** The two packages were installed in `tests/` at
2.0.0-alpha.8, and one row's serializer was compiled. Three failures stopped
it:

- With Flamework 1's transformer ahead of Flamework 2's in `plugins`, Flamework
  1 took `Flamework.createSerializer` for one of its own macros and failed on
  it: `Unexpected intrinsic ID 'serializer'`.
- Both transformers write `flamework.build` in the project root. Flamework 2's
  replaced Flamework 1's, with its own version and none of the identifiers
  runit's test classes are registered under.
- Both write `include/flamework/`. Flamework 2 left a file there, and Flamework
  1, which removes the directory when it writes nothing to it, failed on it
  (`ENOTEMPTY`).

Flamework 2's configuration has no option that moves either file.

**A project of its own.** `tests/flamework2/` pins both packages at
2.0.0-alpha.8, roblox-ts 3.0.0, and `@rbxts/types` 1.0.952, the version
`tests/` builds against. It holds one module per row, which declares the
row's surge shape with `Serialization` widths and makes one
`createSerializer` call. Benchmark harness 4.10 to 4.12 in
[../specs/benchmark-harness.md](../specs/benchmark-harness.md) state how its
output reaches the place. Each compiled module had exactly one import, of
`@flamework-experimental/core`, and called nothing of it but
`createSerializer`.

**Tiers.** `mise run bench:size` and `mise run bench:code` ran under Lune
0.10.5. The control is the other six columns: no cell of theirs changed in
either table when the column was added.

## Results

Every Flamework 2 cell round-tripped exactly. The packed toggles and the two
packed `CFrame` rows have no cell, because Flamework 2 has no `Packed<T>`.

Bytes, from `docs/benchmarks/size.md`. A varint is one byte below 128 and two
below 16384, where surge writes a u32:

| Row                  | surge        | Flamework 2  | What differs                                                    |
| -------------------- | ------------ | ------------ | --------------------------------------------------------------- |
| small flat struct    | 17           | 17           | nothing                                                         |
| deeply nested object | 24           | 18           | a varint for each string's length                               |
| wide struct          | 200          | 200          | nothing                                                         |
| large array          | 2004         | 2002         | a varint for the count                                          |
| nested arrays        | 446          | 383          | a varint for each array's count                                 |
| tuples               | 504          | 501          | a varint for the count                                          |
| large record         | 2096         | 1494         | a varint for the count and for each key's length                |
| string-heavy         | 2390         | 2081         | a varint for the count and for each string's length             |
| leaderboard          | 1218         | 1065         | a varint for the count and for each name's length               |
| enum-heavy           | 106          | 205          | a u16 of each item's `Value`, where surge writes a u8 index     |
| tagged union         | 1274         | 1205         | a varint for the count and for each chat text's length          |
| guarded union        | 849          | 777          | a varint for the count and for each string's length             |
| tree                 | 510          | 255          | a varint for each node's count of children                      |
| instance references  | 104 +50 side | 301 +50 side | a u32 index into the blob list for each `Instance`              |
| toggles (unpacked)   | 26           | 23           | a varint for the label's length                                 |
| CFrame array         | 1204         | 2401         | twelve f32 components for each `CFrame`, where surge writes six |
| Blink: Booleans      | 1004         | 1002         | a varint for the count                                          |
| Blink: Entities      | 604          | 601          | a varint for the count                                          |

Where a row has a count, a length, an enum, a `CFrame` or a blob, the table
names only what changes its bytes most; every count and length in it is a
varint.

Bytecode, from `docs/benchmarks/code-size.md`: Flamework 2's module is larger
than surge's on every row but the wide struct (0.88×) and enum-heavy (0.89×),
from 1.20× on the small flat struct to 2.86× on the large array. Each module
that needs them declares its own varint helpers and enum lookup tables.

## Discussion

- This measures bytes and code, not speed. The speed tier needs a Studio run
  of its own, and its result belongs in a later revision.
- Flamework 2 is an alpha. A later version may change its format or the code
  it generates, which its own documentation says. Each cell holds for
  2.0.0-alpha.8 alone.
- The comparison is not like for like on the read side. On every call,
  Flamework 2's `deserialize` checks each count against the bytes left, raises
  on a union tag it does not know, and raises unless it read the whole
  buffer, where surge's examines its input only under `readChecks`. The size
  tier does not see that.
- The documentation was read from the repository at `6f201a7`, not from the
  package. Where the two might differ, the tables rest on what the package
  generated, which `tests/src/bench/codecs/` holds.
- The modules run with the stand-in of Benchmark harness 4.11 in place of the
  package's `createSerializer`. It runs once, when a module loads, and returns
  what the package's returns when given no options.

## Conclusion

Flamework 2's serializer can be a column of every catalog row but the packed
ones, from a project of its own. Its varint counts and lengths make it smaller
than surge wherever one appears, by half on the tree, and its enum, `CFrame`
and blob encodings make it larger on those three rows. Its generated modules
are larger than surge's on all but two rows.

## Data

- `docs/benchmarks/size.md` and `docs/benchmarks/code-size.md` at the commit
  that adds this paper.
- The generated modules, `tests/src/bench/codecs/*/flamework2*.luau`, and the
  sources they were built from, `tests/flamework2/src/`.
