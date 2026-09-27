# Exact sizing with loops

2026-09-27 · surge `a59fabc`, `d60c411` and `0a2fbc8` · rbxts-transformer-surge
`5cd0208`, `01801d5` and `9bce939` · Roblox 0.740.19.7400931

## Abstract

Exact sizing (Transformer 5.20) covered a shape that its value's lengths and
counts could size without a loop. This extended it in two stages, each
measured on its own: a loop over an array whose elements vary in size, or
over a dictionary, ahead of the result; then a union's size, chosen by the
tests its write makes. Against a reference run of the build before them, the
loop made encode slower where the elements are strings, 0.918× on the
string-heavy row, and where they are dictionary entries, 0.959× on the large
record. The union's size, with the same loop over an array of unions, made
the guarded union's encode 1.18× to 1.19× as fast and the tagged union's
1.05× to 1.11×. What landed is the measured boundary: an array of unions is
sized by a loop, and an array of anything else whose size varies, and a
dictionary, keep the scratch buffer.

## Background

Before this, the string-heavy row's `serialize` kept the scratch buffer
because its `lines` are an array of strings: each string's reservation
checked the buffer's capacity, and `finishWrite` copied the result out. The
first stage, S1, sized it by a loop ahead of the result:

```luau
local size2 = #value.author + #value.title + 12
for _, item1 in value.lines do
    size2 += #item1 + 4
end
local __surge_scratch = buffer.create(size2)
```

The loop iterates the array as the write does, with a generic `for`, since a
numeric one measured slower
([per-element-encode.md](per-element-encode.md)). A dictionary got the same
loop over its entries. The second stage, S2, sized a union by the variant its
write picks, with the write's own tests in the write's order:

```luau
for _, item1 in value.events do
    size2 += (if item1.kind == "chat" then #item1.text + 8 elseif item1.kind == "damage" then 6 elseif item1.kind == "despawn" then 4 else 16) + 1
end
```

A union's size needs the loop of S1 when the union is an array's element,
which it is on both catalog rows that hold one.

## Method

**Builds.** The reference is surge `5c83147` and rbxts-transformer-surge
`fcc7a9c`. S1 is surge `a59fabc` and rbxts-transformer-surge `5cd0208`; S1 and
S2 together are surge `d60c411` and rbxts-transformer-surge `01801d5`; the build
that landed is surge `0a2fbc8` and rbxts-transformer-surge `9bce939`. Each
build of `tests/` was compiled from scratch, and the compiled fixture modules
were compared file by file. S1 changed the `serialize` of two rows, the
string-heavy row and the large record, a `Record` of 200 string keys. S2
changed two more, the tagged union and the guarded union, each an array of a
hundred union values. The build that landed compiles the string-heavy and
large-record modules to the reference's bytes and the two union modules to
S2's. No `deserialize` changed.

**Runs.** Five full invocations of `mise run bench:speed` on 2026-09-27, each
two Studio runs back to back with nine trials per cell per run: the reference
from 03:01 to 03:10, S1 from 03:10 to 03:19, S1 and S2 from 03:19 to 03:28,
the reference build again from 03:28 to 03:36, and the build that landed from
03:46 to 03:54. The CPU load before each was 2% to 4%; a browser was open.

**Reading.** As in [exact-sizing.md](exact-sizing.md): the recorder's median,
spread and noise mark, the change's surge median over the reference's, the
drift `D` over the row's quiet control cells, and time saved per call as
`1/reference − 1/change`. S1 is read against the second reference, S2 against
S1, and the build that landed against the second reference.

## Results

### The references

The second reference ran at 1.008× the first on the quiet control cells on
encode, and 1.003× on decode. S1 ran at 0.997× the second reference on
encode, S2 at 1.000× S1, and the build that landed at 1.004× the second
reference, quartiles [0.997, 1.008] over 43 cells.

### S1: a loop over strings and over a dictionary

Encode against the second reference, from
`data/before-exact-sizing-with-loops-second-run.tsv` and
`data/exact-sizing-with-loops-arrays-and-dicts.tsv`:

| Row          | Reference    | S1           | Ratio | `D`       | Adjusted | Per call | Against the first reference |
| ------------ | ------------ | ------------ | ----- | --------- | -------- | -------- | --------------------------- |
| string-heavy | 318.3k ±1.9% | 292.2k ±3.6% | 0.918 | 0.984 (3) | 0.933    | +0.28 µs | 0.934                       |
| large record | 167.7k ±2.0% | 160.7k ±2.0% | 0.959 | 0.992 (3) | 0.967    | +0.26 µs | 0.977                       |

The encode rows S1 did not change moved between 0.988× and 1.004×, but for
two: `Blink: Booleans`, which cannot be read
([per-element-encode.md](per-element-encode.md)), and `Blink: Entities`,
which moved 0.926× in this run and 1.078× back in the next, on the same code.
The string-heavy row's code is the same in S1 and in S1 and S2, and it ran at
292.2k and 295.9k a second in the two.

### S2: a union's size

Encode against S1, from `data/exact-sizing-with-loops-arrays-and-dicts.tsv`
and `data/exact-sizing-with-loops-and-unions.tsv`:

| Row           | S1           | S1 and S2    | Ratio | `D`       | Adjusted | Per call | Against the second reference |
| ------------- | ------------ | ------------ | ----- | --------- | -------- | -------- | ---------------------------- |
| tagged union  | 299.0k ±4.9% | 329.4k ±1.8% | 1.101 | 1.004 (3) | 1.097    | −0.31 µs | 1.106                        |
| guarded union | 486.2k ±2.2% | 576.7k ±2.1% | 1.186 | 0.994 (2) | 1.193    | −0.32 µs | 1.177                        |

The encode rows S2 did not change moved between 0.993× and 1.013×, but for
the two Blink rows.

### The build that landed

Encode against the second reference, from its table:

| Row           | Reference    | Landed       | Ratio | `D`       | Adjusted | Per call |
| ------------- | ------------ | ------------ | ----- | --------- | -------- | -------- |
| guarded union | 490.1k ±1.3% | 584.7k ±1.8% | 1.193 | 1.009 (2) | 1.182    | −0.33 µs |
| tagged union  | 297.7k ±2.2% | 313.8k ±4.9% | 1.054 | 0.986 (3) | 1.068    | −0.17 µs |
| string-heavy  | 318.3k ±1.9% | 317.6k ±1.2% | 0.998 | 1.003 (3) | 0.995    | —        |
| large record  | 167.7k ±2.0% | 165.7k ±2.9% | 0.988 | 1.008 (3) | 0.981    | —        |

The other encode rows moved between 0.984× and 1.018×, but for
`Blink: Booleans`. The tagged union's two Studio runs disagreed: 322.0k and
306.7k a second, where S2's, on the same code, ran at 326.4k and 332.3k, and
the four reference runs at 295.4k to 302.2k. Its gain is between 1.05× and
1.11× by run.

## Discussion

The loop lost where each element is a string, by about 2.8 ns an element on
the string-heavy row's hundred, and where it walks a dictionary, by about
1.3 ns an entry on the large record's two hundred. What it removes, the copy
out of the scratch buffer and a capacity check per reservation, cost less
than the second walk over the value it adds. On arrays of unions, the same
loop with a union's size in it gained 1.7 to 3.3 ns an element.

Why the unions gain and the strings lose was not probed. One difference is in
the code: the scratch buffer's cursor and capacity are upvalues of the
serializer's closure, and a sized `serialize` keeps its cursor in a local, so
a reservation that no longer checks the capacity also no longer reads and
writes upvalues. A union's element makes a reservation for its index and,
for most variants, another for the variant, where a string makes one. A
dictionary's entry also makes two, and lost, so a count of reservations does
not account for it either.

The boundary that landed is the measured one. An array of unions is sized by
a loop; an array of strings, of buffers, of objects that hold one, of arrays,
and a dictionary are not, and keep the scratch buffer as before. Of those, only
the array of strings and the dictionary were measured. The others fall on
the side they were on before this work, not on a side a measurement put them.

What this does not reach:

- An array of objects that hold a string or an array, and an array of arrays,
  were not measured either way.
- A packed `CFrame`'s size is in the header its runtime function chooses,
  which a size would need a new function of the package to compute. It was
  not tried.
- The fixtures run native. What either stage is worth interpreted was not
  run.

## Conclusion

Sizing a shape by a loop ahead of its result pays on an array of unions,
1.18× to 1.19× on the guarded union's encode and 1.05× to 1.11× on the tagged
union's, and costs 4% to 8% on an array of strings and on a dictionary. Only
the array of unions is sized by a loop now.

## Data

- `data/before-exact-sizing-with-loops.md` and `.tsv`: the first reference,
  at surge `5c83147` and rbxts-transformer-surge `fcc7a9c`.
- `data/before-exact-sizing-with-loops-second-run.md` and `.tsv`: the second
  reference, at the same commits.
- `data/exact-sizing-with-loops-arrays-and-dicts.md` and `.tsv`: S1, at surge
  `a59fabc` and rbxts-transformer-surge `5cd0208`.
- `data/exact-sizing-with-loops-and-unions.md` and `.tsv`: S1 and S2, at
  surge `d60c411` and rbxts-transformer-surge `01801d5`.
- The build that landed: `docs/benchmarks/speed.md` and
  `docs/benchmarks/speed-trials.tsv` as committed at surge `7a4ec91`, recorded
  at surge `0a2fbc8` and rbxts-transformer-surge `9bce939`.
- The figures above were computed from the five `.tsv` files, with the
  recorder's own median, spread and noise rule.
