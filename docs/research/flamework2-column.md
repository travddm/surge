# Flamework 2 as a benchmark column

2026-10-09 · surge `1b18214` for bytes and bytecode, `f8353c8` for speed ·
`@flamework-experimental/core` and `@flamework-experimental/transformer`
2.0.0-alpha.8, documentation read at `Velover/ExperimentalFlameworkV2`
`6f201a7` · Lune 0.10.5 · Roblox Studio 0.742.0.7421053

## Abstract

This asks whether the experimental Flamework 2's `Flamework.createSerializer`
can be a column of the benchmark, and how it compares with surge. It cannot
build in `tests/` beside Flamework 1, so a project of its own builds it, and
it expresses 18 of the catalog's 21 rows, each of which round-trips exactly.
Its bytes are smaller than surge's wherever a count or a length appears and
larger on enums, `CFrame`s and blobs, and its modules are larger on 16 of the
18 rows. Its encode runs at 0.83× surge's throughput and its decode at 0.94×,
as geometric means over 17 of the 18 rows. It is faster than surge by more
than the noise only on the enum row's encode and both halves of the `CFrame`
row, and slowest against it on the tagged union's encode, at 0.56×.

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

**Bytes and bytecode.** `mise run bench:size` and `mise run bench:code` ran
under Lune 0.10.5. The control is the other six columns: no cell of theirs
changed in either table when the column was added.

**Speed.** `mise run bench:speed` ran once at `f8353c8`, in Roblox Studio
0.742.0.7421053: two runs back to back, nine trials per cell in each, the
row's columns taking turns (Benchmark harness 6). The control is the other
columns' summary figures, which moved by 0.01 at most from the run of
2026-10-08 at the same Roblox version.

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

Throughput against surge's, from `docs/benchmarks/speed.md`: above 1.00× is
faster than surge. Each cell's spread, the middle half of its trials, is in
that file. A cell marked † spread or moved between the runs by more than 10%,
and is left out of the means.

| Row                  | Encode | Decode |
| -------------------- | ------ | ------ |
| small flat struct    | 1.02×  | 0.96×  |
| deeply nested object | 0.63×  | 0.79×  |
| wide struct          | 1.03×  | 1.01×  |
| large array          | 0.83×  | 0.99×  |
| nested arrays        | 0.92×  | 0.90×  |
| tuples               | 0.92×  | 1.00×  |
| large record         | 0.77×  | 0.82×† |
| string-heavy         | 0.75×  | 0.70×  |
| leaderboard          | 0.62×  | 0.82×  |
| enum-heavy           | 1.74×  | 0.66×  |
| tagged union         | 0.56×  | 0.89×  |
| guarded union        | 0.78×  | 0.89×  |
| tree                 | 0.61×  | 0.87×  |
| instance references  | 0.61×  | 1.00×  |
| toggles (unpacked)   | 0.83×  | 1.00×  |
| CFrame array         | 1.13×  | 2.08×  |
| Blink: Booleans      | 0.64×† | 0.98×  |
| Blink: Entities      | 0.90×  | 1.00×  |
| Geometric mean       | 0.83×  | 0.94×  |

## Discussion

- The speed figures are one invocation, on one machine. Between its two runs,
  no cell of any column moved by more than 16%, and nine in ten by under 4%;
  a difference narrower than that is noise.
- Where the two formats differ, a ratio measures the format as well as the
  code. On the enum and `CFrame` rows, Flamework 2 writes other values than
  surge does: a u16 of the `Value` where surge writes an index, and twelve
  components where surge writes six. The speed tier does not separate the
  two.
- Flamework 2 is an alpha. A later version may change its format or the code
  it generates, which its own documentation says. Each cell holds for
  2.0.0-alpha.8 alone.
- The comparison is not like for like on the read side. On every call,
  Flamework 2's `deserialize` checks each count against the bytes left, raises
  on a union tag it does not know, and raises unless it read the whole
  buffer, where surge's examines its input only under `readChecks`. The
  decode figures include those checks, and the size tier does not see them.
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
are larger than surge's on all but two rows. It encodes at 0.83× surge's
throughput and decodes at 0.94×. It is faster than surge by more than the
noise only on the enum and `CFrame` rows, where its format writes other
values than surge's.

## Data

- `docs/benchmarks/size.md` and `docs/benchmarks/code-size.md` at `1b18214`.
- `docs/benchmarks/speed.md` and `docs/benchmarks/speed-trials.tsv` at the
  commit that adds the speed figures here, whose run header names
  `f8353c8`.
- The generated modules, `tests/src/bench/codecs/*/flamework2*.luau`, and the
  sources they were built from, `tests/flamework2/src/`.
