# Future work: a Squash column in the benchmark

Part of the [surge](../architecture.md) design.

## What

Squash (`Data-Oriented-House/Squash`) as a column of the size, code-size and
speed tiers ([specs/benchmark-harness.md](../specs/benchmark-harness.md)),
next to fbs, serio, Blink, Zap and Flamework 2.

## Why

It is the most widely used standalone Luau serializer found in a survey of
2026-10-09, and it expresses most of the catalog: records, arrays, maps,
tuples, optionals, literals, `EnumItem`, integers of each width, quantized
ranges, a `CFrame` whose position width the caller sets, and 32
Roblox datatypes. Its schema is built at run time from combinators written
by hand, the family fbs and serio already stand for, so what it adds is a
library that consumers weigh against surge, not a new design.

## Why deferred

The column is a new comparison, not part of the generated-code work it was
found during, and its version has to be chosen first (below).

## How, briefly

- **Which Squash.** The current release is 5.0.0, on Wally and GitHub
  (2026-01-04). The only npm package, `@rbxts/squash` 3.0.0-ts.0
  (2025-06-22), is built from a separate repository,
  `HylianBasement/rbxts-squash`, and describes Squash 3: 4.0.0
  renamed the number constructors (`uint(1)` became `u8()`) and changed how
  integers are encoded. The column either pins the npm package and measures
  Squash 3, or takes 5.0.0 from Wally and declares its types in this
  repository. The survey in
  [research/type-coverage-across-libraries.md](../research/type-coverage-across-libraries.md)
  turned Sera down partly for being a raw Luau dependency, which the second
  route also is.
- **What it cannot express.** It has no tagged union (its `table` dispatches
  on `typeof`) and no `Instance`, so the tagged union and the instance
  references rows have no cell, and the guarded union row depends on how its
  untagged union is counted.
- **Each cell round-trips** as Benchmark harness 6.6 requires, so a cell the
  size table records as exact must be exact in Roblox too.
- **The result** is a Squash column in `docs/benchmarks/size.md`,
  `code-size.md` and `speed.md`, its version pinned in the benchmark's header,
  and a research paper that reports its bytes, bytecode and speed against
  surge, as [research/flamework2-column.md](../research/flamework2-column.md)
  does for Flamework 2.
- Squash is a runtime library with no transformer, so unlike Flamework 2
  (Benchmark harness 4.10–4.12) it needs no project of its own: its
  definitions can live in `tests/src/bench/codecs/` beside fbs's and
  serio's.
- The same survey found two other candidates, not needed beside Squash:
  `@data-vegle/serial` (2.0.0, npm only, no public source), whose optional
  transformer emits straight-line code from TypeScript types, as surge
  does; and Lync (`Axp3cter/Lync`), a networking library with its own
  serializer and first-party typings.
- The survey's row for Sera says it has no npm listing; `@rbxts/sera` 1.0.0
  has existed since 2026-08-01. The survey is published, so a fix is a
  dated correction.
