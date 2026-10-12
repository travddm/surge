# Future work: the write state in locals, and joined reservations

Part of the [surge](../architecture.md) design. Two changes to the generated
`serialize`, each measured on its own, as the papers listed in
[generated-code-performance.md](generated-code-performance.md) were.

## What

**The scratch path's write state in locals.** A `serialize` that is not sized
exactly (Transformer 5.20 in [specs/transformer.md](../specs/transformer.md))
keeps its scratch buffer, capacity and write cursor in the closure it is
generated into (5.3). Each reservation therefore loads and stores the cursor
as an upvalue, and loads the capacity it compares against. In the
string-heavy row's `serialize` at `7532ee9`, compiled as `mise run bench:code`
compiles it, 72 of the 183 words of bytecode load or store an upvalue.

The change:

- the cursor becomes a local of `serialize`;
- the buffer and the capacity are copied into locals on entry;
- both are stored back to the closure, so the next call starts from a grown
  buffer.

The rows it touches are string-heavy, the large record, and both packed
`CFrame` rows, which share one module.

**A string's reservation joined with the fixed-size bytes beside it.** A
`str` reserves its count and bytes at once (5.19), and a run of fixed-size
properties at once (5.5). A string next to a run is two reservations, each
with its own capacity check on the scratch path. The change joins them into
one reservation. The same applies to the read side: the run after a string is
read at offsets from the string's end. The rows it touches:

- the large record: each entry's key, then its `u8`;
- the tagged union: the `chat` variant's index and `id`, then its text;
- the leaderboard: each entry's name, then its `u32` and `f64`.

## Why

- Holding the read state in locals instead of upvalues gained 1.00× to 1.37×
  on decode ([size-and-read-locals.md](../research/size-and-read-locals.md)).
  The write side has not been measured.
  [exact-sizing-with-loops.md](../research/exact-sizing-with-loops.md) names
  the upvalues as a difference, not probed, between the rows its size loop
  gained on and the rows it lost on.
- After the `CFrame` array, fbs comes closest to surge's encode on
  string-heavy and on the large record, at 0.74× and 0.63×
  ([benchmarks/speed.md](../benchmarks/speed.md) at `7532ee9`). Both use the
  scratch path.
- Both changes remove instructions, so the code gets smaller as well.

## Why deferred

Both were found while reviewing the results of the `smaller-generated-code`
branch. They were put after the catalog gained its rows and its scoped runs
(Benchmark harness 3.1 and 9 in
[specs/benchmark-harness.md](../specs/benchmark-harness.md)), so that their
measurements are scoped runs over the larger catalog.

## Constraints

- **Recursion helpers.** A recursive type's helpers read the closure's buffer
  and capacity (5.2, 5.3), and a recursive call can grow the buffer while its
  caller holds the old one in a local. A `serialize` that reaches a recursion
  helper, such as the tree row's, keeps the closure state.
- **The local budget.** The three locals count toward `LOCALS_BUDGET`, as
  `writeIntoCursor` counts a cursor codec's.
- **The long forms.** A string's count of 254 or more is written by
  `growLongString`, a call that returns the buffer, capacity and cursor. A
  joined reservation covers only the inline short form. The run beside the
  string is then either written in both branches, which costs code size, or
  reserved again after the long form.
- **Loop bodies.** Every join in the catalog is inside a loop's body. Inside
  loop bodies, the cursor fold measured slower on two cells, for a reason not
  found ([cursor-known-values.md](../research/cursor-known-values.md)).
- **Where the state is stored back.** A store before the return is skipped
  when `serialize` raises after a grow. The closure then keeps its smaller
  buffer, which the next call grows again. A store at each grow avoids that,
  at the cost of code at every grow site.
- Each change gets a keep rule written before its runs, and its own paper.

## Result

Each change is kept only if its measurement passes its keep rule.

- **The write state:** Transformer 5.3 states it, with golden checks in
  `test/golden.test.mjs`.
- **The joined reservations:** 5.5 and 5.19 state them, with golden checks.

## Notes

- A cursor codec's `write` already holds the same three in locals where no
  recursion helper reads them, and stores them back at the end. See
  `beginCursorWriteStatements`, `endCursorWriteStatements` and
  `writeIntoCursor` in `rbxts-transformer-surge/src/emit/context.ts`. The
  closure's declarations are `writeStateDecls`.
- The golden checks and the emitter read the state as `__surge_scratch`,
  `__surge_capacity` and `__surge_cursor`. Keeping those names for the
  locals, and renaming the closure's, leaves most anchors as they are. A
  TypeScript `let` cannot read an outer variable of its own name in its
  initializer, so the two need different names.
- A sequence is not sized (5.20), so the sequences row also uses the scratch
  path.
