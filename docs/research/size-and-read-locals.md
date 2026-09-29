# Locals for the size and the read state

2026-09-29 · surge `68f9922` and `fd1fa99` · rbxts-transformer-surge `bdabc6c`
and `499d768` · Roblox 0.741.19.7411056

## Abstract

Two changes to the generated code, each measured on its own against two
reference runs of the build before them. The first has a shape's size read
the value through the locals its write binds, where it read each nested
object's path and each string's length a second time: 1.065× on the deeply
nested object's encode, 13.5 ns a call, and no other row outside the band the
two references span. The second has a `deserialize` of a shape with no
recursive type hold its input buffer and read cursor in locals, where they
were upvalues of its closure: 1.00× to 1.37× on decode, most on the two
arrays of unions and on the axis-aligned packed `CFrame`s, and no row slower.
Together they leave surge at 1.02× the hand-written codec's time on encode
and 0.99× on decode over the three rows it covers, where both references
were at 1.03×.

## Background

A shape sized exactly (Transformer 5.20) creates its result at its size and
writes into it. Before this, its size read the value from `value` by the
whole path, and its write read the same values again, through locals of its
own. The deeply nested object's `serialize` began:

```luau
local __surge_scratch = buffer.create(#value.root.inner.inner.leaf.name + #value.root.label + 16)
local __surge_cursor = 0
local obj1 = value.root
local obj2 = obj1.inner
-- ...
local s7 = obj6.name
local len8 = #s7
```

[generated-code-performance.md](../future-work/generated-code-performance.md)
listed binding those locals ahead of the result as not tried. The first
change, A, does that: the size binds each local the write binds outside a
loop or a branch, up to 32 of them, and the write reads them.

```luau
local obj1 = value.root
local obj2 = obj1.inner
local obj3 = obj2.inner
local obj4 = obj3.leaf
local s5 = obj4.name
local len6 = #s5
local s7 = obj1.label
local len8 = #s7
local __surge_scratch = buffer.create(len6 + len8 + 16)
```

Every `deserialize` kept its input buffer and read cursor as upvalues of the
closure it was generated into (Transformer 5.3), so each call stored the input
in an upvalue, each reservation read and wrote the cursor there, and each
`buffer.read*` read the input there. A recursion helper's read function takes
no arguments and reads that state, so a shape with a helper needs it in the
closure. The second change, B, declares both, and the input length under
`readChecks`, as locals of `deserialize` where no helper reads them:

```luau
deserialize = function(input)
    local __surge_input = input
    local __surge_readCursor = 0
```

The read side's state had not been measured before this.

## Method

**Builds.** The reference is surge `4338a95` and rbxts-transformer-surge
`9bce939`. A is surge `68f9922` and rbxts-transformer-surge `bdabc6c`. A and B
together are surge `fd1fa99` and rbxts-transformer-surge `499d768`, the build
that landed. Each build of `tests/` was compiled from scratch, and the
compiled fixture modules were compared file by file. A changed the
`serialize` of eight rows: the deeply nested object, and seven rows whose
`serialize` binds an array, where A moves `local arr = value.<name>` ahead of
the result and the size takes the array's length from that local. Those are
the large array, enum-heavy, the tagged union, the guarded union, the `CFrame`
array and both Blink rows. B changed every `deserialize`: fifteen functions
behind sixteen rows, since the two packed `CFrame` rows share one serializer.
No fbs or serio schema differed between the builds.

**Runs.** Four full invocations of `mise run bench:speed` on 2026-09-29, each
two Studio runs back to back with nine trials per cell per run: the reference
from 17:52 to 18:01, A from 18:01 to 18:10, A and B from 18:10 to 18:19, and
the reference again from 18:19 to 18:27. No other Roblox process ran. The CPU
load read at the start of each was 4%, 2%, 16% and 9%. The third was read
while a script comparing the first two runs' trials ran, before that run's
build step.

**Reading.** As in [exact-sizing-with-loops.md](exact-sizing-with-loops.md):
the recorder's median, spread and noise mark, the change's surge median over
the reference's, and the drift `D` over the row's quiet control cells. The
time a call takes against the reference is `1/change − 1/reference`, negative
where the change saves time. A is read on encode against the second
reference, and against the first. B is read on decode against A's run, whose
encode code it shares, and the build that landed against the second
reference.

**Controls.** The fbs, serio, Blink and baseline columns. For A, the eight
rows whose `serialize` did not change, and surge's decode. For B, surge's
encode, which is the same code in A's run and in B's.

## Results

### The references

The second reference ran at 1.005× the first over the quiet control cells on
encode, quartiles [0.995, 1.017] over 45 cells, and at 1.009× on decode,
quartiles [1.001, 1.015] over 45. surge's own rows, on the same code, moved
between 0.978× and 1.036× adjusted on encode and between 0.986× and 1.023× on
decode. `Blink: Booleans` is left out: its encode ran at 175.6k values a
second in the first reference and 215.8k in the second, the two speeds that
[benchmark-tooling.md](../future-work/benchmark-tooling.md) records, and it
cannot be read in any comparison here.

### A: the size's locals

Encode against the second reference, from
`data/before-size-and-read-locals-second-run.tsv` and
`data/size-and-read-locals-size-only.tsv`, on the rows whose `serialize` A
changed:

| Row             | Reference    | A            | Ratio | `D`       | Adjusted | Per call  | Adjusted, against the first reference |
| --------------- | ------------ | ------------ | ----- | --------- | -------- | --------- | ------------------------------------- |
| nested object   | 4.42M ±3.8%  | 4.70M ±5.9%  | 1.065 | 0.994 (4) | 1.071    | −0.014 µs | 1.049                                 |
| guarded union   | 592.2k ±2.6% | 603.5k ±2.9% | 1.019 | 0.997 (2) | 1.023    | −0.032 µs | 1.025                                 |
| enum-heavy      | 324.7k ±1.9% | 329.0k ±2.1% | 1.013 | 1.005 (2) | 1.008    | −0.040 µs | 1.006                                 |
| `CFrame` array  | 272.5k ±1.9% | 277.1k ±1.4% | 1.017 | 1.011 (4) | 1.006    | −0.061 µs | 1.012                                 |
| tagged union    | 324.0k ±2.8% | 325.5k ±2.0% | 1.005 | 1.010 (3) | 0.995    | −0.014 µs | 1.005                                 |
| large array     | 326.6k ±5.6% | 329.8k ±1.7% | 1.010 | 1.020 (3) | 0.990    | −0.029 µs | 1.016                                 |
| Blink: Entities | 554.6k ±1.4% | 556.1k ±1.2% | 1.003 | 1.018 (3) | 0.985    | −0.005 µs | 1.012                                 |

The eight encode rows A did not change moved between 0.979× and 1.011×
adjusted against the second reference. surge's decode, which A did not change,
moved between 0.990× and 1.013×, but for the unpacked toggles, at 0.924×: that
cell's spread in A's run was 9.9%, and its two Studio runs sat at 2.49M and
2.72M values a second.

### B: the read state in locals

Decode against A's run, from `data/size-and-read-locals-size-only.tsv` and
the build that landed, with the build that landed against the second
reference in the last column:

| Row                                   | A            | A and B      | Ratio | `D`       | Adjusted | Per call  | Landed, adjusted |
| ------------------------------------- | ------------ | ------------ | ----- | --------- | -------- | --------- | ---------------- |
| guarded union                         | 335.8k ±2.5% | 462.3k ±2.5% | 1.377 | 1.010 (2) | 1.363    | −0.815 µs | 1.372            |
| toggles (unpacked)                    | 2.55M ±9.9%  | 2.98M ±2.1%  | 1.169 | 0.999 (3) | 1.170    | −0.057 µs | 1.068            |
| `CFrame` array (packed, axis-aligned) | 243.5k ±1.6% | 279.6k ±3.5% | 1.149 | 0.996 (2) | 1.153    | −0.531 µs | 1.149            |
| tagged union                          | 91.5k ±1.5%  | 98.7k ±2.0%  | 1.079 | 0.989 (3) | 1.091    | −0.797 µs | 1.087            |
| nested object                         | 2.55M ±3.4%  | 2.66M ±2.2%  | 1.042 | 0.981 (4) | 1.062    | −0.016 µs | 1.052            |
| Blink: Booleans                       | 107.2k ±3.1% | 108.6k ±6.1% | 1.013 | 0.970 (3) | 1.044    | −0.119 µs | 1.034            |
| wide struct                           | 693.0k ±0.9% | 708.7k ±3.7% | 1.023 | 0.981 (3) | 1.042    | −0.032 µs | 1.033            |
| enum-heavy                            | 738.8k ±4.7% | 762.3k ±3.6% | 1.032 | 0.995 (2) | 1.037    | −0.042 µs | 1.031            |
| large array                           | 108.4k ±3.1% | 111.6k ±5.6% | 1.029 | 0.994 (3) | 1.036    | −0.263 µs | 1.034            |
| string-heavy                          | 218.1k ±3.2% | 221.2k ±2.4% | 1.014 | 0.986 (3) | 1.028    | −0.063 µs | 1.019            |
| Blink: Entities                       | 63.2k ±2.0%  | 62.4k ±7.7%  | 0.987 | 0.967 (3) | 1.021    | 0.202 µs  | 1.012            |
| toggles (packed)                      | 1.57M ±1.0%  | 1.62M ±2.7%  | 1.030 | 1.009 (2) | 1.020    | −0.019 µs | 1.021            |
| large record                          | 74.6k ±1.0%  | 74.2k ±2.6%  | 0.994 | 0.976 (3) | 1.019    | 0.076 µs  | 1.021            |
| `CFrame` array (packed, arbitrary)    | 119.0k ±2.2% | 119.5k ±1.8% | 1.004 | 0.988 (2) | 1.017    | −0.032 µs | 1.006            |
| small flat struct                     | 5.59M ±2.0%  | 5.53M ±7.1%  | 0.989 | 0.973 (4) | 1.016    | 0.002 µs  | 1.025            |
| `CFrame` array                        | 142.5k ±1.9% | 142.1k ±3.7% | 0.997 | 0.997 (4) | 1.001    | 0.018 µs  | 1.006            |

The unpacked toggles' cell in A's run is the one read above, with a 9.9%
spread; against the second reference the row is 1.068×. On encode, whose code
is the same in both builds, surge's rows moved between 0.981× and 1.017×
adjusted, but for `Blink: Booleans`, which ran at 178.2k values a second in
A's run and 210.2k in B's.

Per element, against the second reference, B saved 8.2 ns on the guarded
union's hundred and 7.5 ns on the tagged union's hundred, and 10.2 ns on the
fifty axis-aligned packed `CFrame`s. On the fifty arbitrary packed `CFrame`s,
which the same `deserialize` reads, it saved nothing measurable.

### Against the hand-written codec

The baseline column's throughput over surge's, as each run's table prints it:

| Run              | Encode: flat, nested, `CFrame` | Decode: flat, nested, `CFrame` | Summary, encode and decode |
| ---------------- | ------------------------------ | ------------------------------ | -------------------------- |
| Reference        | 1.03×, 1.05×, 1.02×            | 1.02×, 1.05×, 1.00×            | 1.03×, 1.03×               |
| A                | 1.02×, 1.00×, 1.02×            | 1.00×, 1.06×, 1.00×            | 1.01×, 1.02×               |
| A and B          | 1.03×, 1.01×, 1.01×            | 0.99×, 0.99×, 1.00×            | 1.02×, 0.99×               |
| Reference, again | 1.01×, 1.07×, 1.02×            | 1.03×, 1.05×, 1.01×            | 1.03×, 1.03×               |

## Discussion

A moved one row out of the band: the deeply nested object, whose size read
two strings through four levels of path and took their lengths, which its
write took again. It saved 13.5 ns a call, and the row's encode is now within
the band of the hand-written codec, which binds the same locals once ahead of
its buffer. On the other seven rows A changed, it saves one property read a
call, the array's, and no row resolves that. No row of the catalog binds more
than eight locals for its size, so the cap of 32 was not reached.

B saved most where a call reads and moves the read cursor inside an element
loop, but not on every such row. Per element, it saved 8.2 ns on the guarded
union and 7.5 ns on the tagged union, whose elements each reserve an index
and, but for the guarded union's booleans, a variant. It saved 10.2 ns on the
axis-aligned packed `CFrame`s, which pass the input and the cursor to
`readPackedCFrame` for each element and add the size it returns to the
cursor. It saved at most 0.6 ns a string on the string-heavy row's hundred,
which reserve their bytes one string at a time, and nothing measurable on the
arbitrary packed `CFrame`s, which the same `deserialize` as the axis-aligned
ones reads. The arbitrary row's value takes about twice as long to read, which
would make the same saving about half the ratio, not nothing. The unpacked
`CFrame` array moves the cursor twice a call, since its fifty elements are
reserved at once (Transformer 5.18), and reads the input three hundred times;
it saved nothing measurable either. Which part of the read state's cost the
unions pay and the strings and the arbitrary `CFrame`s do not was not probed.

The unpacked toggles' decode cell spread 9.8% in the first reference and 9.9%
in A's run. Its gain under B is between 1.07× and 1.17× by which run it is
read against.

What this does not reach:

- No catalog row has a recursive type, so a `deserialize` that keeps the read
  state in its closure, which B leaves as it was, was not run.
- The fixtures run native. What either change is worth interpreted was not
  run.
- Roblox was 0.741.19 here and 0.740.19 in the earlier papers, so a figure
  here is compared only with the other runs of this session.

## Conclusion

Binding the locals a sized write reads ahead of its size saved 13.5 ns a call
on the deeply nested object's encode, 1.065×, and moved no other row out of
the band. Keeping a `deserialize`'s read state in locals made decode up to
1.37× as fast, most on the arrays of unions, and slowed no row. With both,
surge's encode and decode are within the band of the hand-written codec on
the three rows it covers.

## Data

- `data/before-size-and-read-locals.md` and `.tsv`: the first reference, at
  surge `4338a95` and rbxts-transformer-surge `9bce939`.
- `data/before-size-and-read-locals-second-run.md` and `.tsv`: the second
  reference, at the same commits.
- `data/size-and-read-locals-size-only.md` and `.tsv`: A, at surge `68f9922`
  and rbxts-transformer-surge `bdabc6c`.
- The build that landed: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `1008a69`, recorded
  at surge `fd1fa99` and rbxts-transformer-surge `499d768`.
- The figures above were computed from the four `.tsv` files, with the
  recorder's own median, spread and noise rule.
