# A recursion helper's write cursor

2026-10-07 · surge `ee30e4a` · rbxts-transformer-surge `062199a` · Roblox
0.741.19.7411056

## Abstract

No catalog row had a recursive type, so what a recursion helper's state in
the closure costs was not measured. A tree row of 85 nodes, with a
hand-written codec beside it, measures it. surge's decode is within the band
of the hand-written codec, which passes its offset as an argument, so the read
state in the closure costs nothing this row resolves. Its encode was 1.09×
behind, and this change passes a recursion helper's write function the write
cursor and has it return it, where it read and wrote the closure's. Encode is
1.088× as measured, 0.191 µs less a call, and now level with the hand-written
codec. The change is kept. A first hand-written codec, which counted the
nodes in one walk and wrote them in a second, was 1.34× slower than surge's
single walk into its scratch buffer.

## Background

The tree row (Benchmark harness 3.1 in
[specs/benchmark-harness.md](../specs/benchmark-harness.md)) is a type that
refers to itself, 85 nodes of a `u16` id, four children each to a depth of
three: 510 bytes, a `u32` child count and the id for each node. Only surge and
the hand-written codec have a cell on it. Flamework, which generates fbs's and
serio's schemas, overflows its stack on the self-reference, Blink's compiler
rejects it, and Zap compiles it as an opaque value passed beside the bytes.

surge writes and reads a recursive type through a helper function for each
side, declared in the serializer's closure (Transformer 5.2 in
[specs/transformer.md](../specs/transformer.md)). A recursive type is not
sized ahead of its write, so the write keeps the scratch buffer: a capacity
check at each reservation and `finishWrite`'s copy at the end. Before this
change, both helpers read and wrote the closure's cursors, where every other
`deserialize`, and every sized `serialize`, holds its cursor in a local
([size-and-read-locals.md](size-and-read-locals.md)).

With this change (Transformer 5.3), the write helper is:

```luau
local function surge_TreeNode_12_write(value, __surge_cursor)
	local arr1 = value.children
	local pos2 = __surge_cursor
	__surge_cursor = pos2 + 4
	if __surge_cursor > __surge_capacity then
		__surge_scratch = __surge_grow(__surge_scratch, pos2, __surge_cursor)
		__surge_capacity = buffer.len(__surge_scratch)
	end
	buffer.writeu32(__surge_scratch, pos2, #arr1)
	for _, item3 in arr1 do
		__surge_cursor = surge_TreeNode_12_write(item3, __surge_cursor)
	end
	local pos4 = __surge_cursor
	__surge_cursor = pos4 + 2
	if __surge_cursor > __surge_capacity then
		__surge_scratch = __surge_grow(__surge_scratch, pos4, __surge_cursor)
		__surge_capacity = buffer.len(__surge_scratch)
	end
	buffer.writeu16(__surge_scratch, pos4, value.id)
	return __surge_cursor
end
```

The scratch buffer and its capacity stay in the closure, since `grow`
replaces the buffer. The read helper did not change. Among the fixture
modules, only the tree's surge module changed, and
[benchmarks/code-size.md](../benchmarks/code-size.md) took it from 1,727 to
1,721 bytes of bytecode.

## Method

**Three invocations.** Each is one full `mise run bench:speed`: two Studio
runs back to back, nine trials per cell per run. At each start no Roblox
process was running, and the CPU load, averaged over fifteen one-second
samples of `Get-Counter`, was at most 7%.

1. 12:23 to 12:33 UTC, surge `74137fb` and rbxts-transformer-surge `50ee379`:
   the row with its first hand-written codec, which counts the nodes in one
   walk, creates its buffer at their size, and writes them in a second walk.
2. 12:38 to 12:48 UTC, surge `b48a30b` and rbxts-transformer-surge `50ee379`:
   the hand-written codec rewritten to write in one walk into a buffer kept
   between calls, passing its offset as an argument and returning it, and
   copying the result out at its length. Its reader already passed its offset
   that way. This is the reference.
3. 12:54 to 13:04 UTC, surge `ee30e4a` and rbxts-transformer-surge `062199a`:
   the change. surge `ee30e4a` builds the same code as `b48a30b`.

**Reading.** Fixed before the third invocation: the change stays only if the
tree's encode is faster, with both runs of the change above both runs of the
reference, and the cell is not marked noisy. Against the hand-written codec,
a ratio within the two runs' agreement on the rows it covers is read as
within the band, as in
[hand-written-union-and-packed-bits.md](hand-written-union-and-packed-bits.md).

**Controls.** The baseline column, and the eighteen rows whose code did not
change.

## Results

Against the hand-written codec, with each one's runs:

| Invocation    | Half   | surge                   | Hand-written             | Hand-written ahead by run |
| ------------- | ------ | ----------------------- | ------------------------ | ------------------------- |
| 1, two walks  | encode | 423.6k (419.8k, 427.9k) | 317.2k (317.1k, 317.3k)  | 0.755×, 0.742×            |
| 1, two walks  | decode | 99.6k (99.0k, 100.0k)   | 102.3k (102.3k, 102.3k)  | 1.033×, 1.023×            |
| 2, one walk   | encode | 422.7k (414.6k, 431.1k) | 460.9k (462.6k, 459.7k)  | 1.116×, 1.066×            |
| 2, one walk   | decode | 99.6k (99.1k, 100.1k)   | 101.6k (101.4k, 101.7k)  | 1.024×, 1.016×            |
| 3, the change | encode | 459.9k (472.9k, 444.0k) | 423.5k (449.1k, 397.6k)† | 0.950×, 0.895×            |

The change against the reference, invocation 3 against 2:

| Half   | Reference    | Change       | Ratio | `D`       | Adjusted | µs a call | Runs, reference | Runs, change   |
| ------ | ------------ | ------------ | ----- | --------- | -------- | --------- | --------------- | -------------- |
| encode | 422.7k ±3.9% | 459.9k ±6.3% | 1.088 | —         | —        | −0.191    | 414.6k, 431.1k  | 472.9k, 444.0k |
| decode | 99.6k ±1.6%  | 98.8k ±1.8%  | 0.992 | 1.006 (1) | 0.986    | +0.082    | 99.1k, 100.1k   | 99.4k, 98.7k   |

The encode has no `D`: the row's one control cell, the hand-written codec's,
is marked noisy in the change's invocation. Its second run ran at 383k to
404k a second in all nine trials, against 443k to 456k in its first, and in
the same run surge's encode of the string-heavy row, the wide struct and the
tagged union ran low as well. The tree's surge cell fell less in that run,
from 472.9k to 444.0k, and stayed above both runs of the reference. The quiet
control cells of the catalog moved 0.993× on encode, quartiles
[0.983, 1.005] over 53, and 0.998× on decode, quartiles [0.993, 1.006] over 56.

## Discussion

The decode is within the band of the hand-written codec in both invocations
that measured it, 1.02× to 1.03×, though surge's read helper takes no
arguments and moves the closure's read cursor, and the hand-written reader
passes its offset in and out. On this row the read state in the closure
costs nothing that two runs resolve, so it was left as it is.

The encode gap was the write cursor. Moving it into the helper's parameter
saved about 2.2 ns a node, and surge's two runs of the change straddle the
reference's two runs of the hand-written codec, 462.6k and 459.7k, so the
row's encode is level with it.

The first hand-written codec is the one a person writes to create the buffer
once at its size. It was 1.34× slower than surge's scratch buffer in the same
invocation, and the same codec written in one walk ran 1.45× as fast as it in
the next invocation. Counting a recursive
type's nodes ahead of its write costs a second walk of the tree, more than
the capacity checks and the copy it removes. A recursive type is therefore
not a candidate for exact sizing by a walk ahead of the write.

## Conclusion

Passing a recursion helper's write function the write cursor is worth 1.088×
on the tree's encode, and brings it level with a hand-written codec. Its
decode was already within the band, with the read state in the closure.
Sizing a recursive type by a walk ahead of its write would not pay on this
row.

## Data

- Invocation 1: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `d30e335`.
- Invocation 2, the reference: the same files as committed at surge
  `ee30e4a`.
- Invocation 3, the change: the same files as committed at surge `d677c0d`.
- The figures above were computed from the `.tsv` files, with the recorder's
  own median, spread and noise rule.
