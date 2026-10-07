# An array of strings and a dict, sized by a loop again

2026-10-07 · surge `a4b36f8` · rbxts-transformer-surge `171f4f6` · Roblox
0.741.19.7411056

## Abstract

A loop that sizes an array of strings or a dict ahead of its result measured
slower than the scratch buffer in September
([exact-sizing-with-loops.md](exact-sizing-with-loops.md)), before later
changes to the size and the write. The same loop over an array of objects that
hold a string has since measured faster
([object-array-loop-sizing.md](object-array-loop-sizing.md)). This measures
the loop over strings and over a dict again. On the string-heavy row, encode
is 0.966× as measured and 0.950× adjusted, slower in both runs; on the large
record, it is 0.997× and 0.984×, with the runs overlapping. Neither is kept:
an array of strings and a dict keep the scratch buffer.

## Background

The probe restores the two loops that September's first stage added and its
second removed, on the current size code. The string-heavy row's
`serialize` then starts with:

```luau
local s1 = value.author
local len2 = #s1
local arr3 = value.lines
local s6 = value.title
local len7 = #s6
local size5 = len2 + len7 + 12
for _, item4 in arr3 do
	size5 += #item4 + 4
end
```

and the large record's with:

```luau
local size3 = 4
for k1 in value.entries do
	size3 += #k1 + 5
end
```

and neither checks a capacity or copies its result. Among the fixture
modules, only those two rows' surge modules changed. Their `deserialize` is
the same code, but for the numbers in its locals' names. An array of buffers
and an array of arrays were left on the scratch buffer, since no catalog row
has either.

## Method

**Builds.** The reference is surge `a4b36f8` and rbxts-transformer-surge
`8727491`. The change is surge `a4b36f8` and rbxts-transformer-surge
`171f4f6`. Each run's compiled modules of the two rows were kept: the
reference's call `grow`, and the change's do not.

**Runs.** Each is one full invocation of `mise run bench:speed`: two Studio
runs back to back, nine trials per cell per run. The reference ran from 11:46
to 11:56 UTC, and the change from 11:56 to 12:06 UTC. At each start no Roblox
process was running, and the CPU load, averaged over fifteen one-second
samples of `Get-Counter`, was 8% and 9%.

**Reading.** Fixed before the runs. Each row decides its own kind, on encode:
the string-heavy row the array of strings, the large record the dict. A kind
keeps the loop only if its row is faster with both runs of the change above
both runs of the reference and the cell is not noisy. Otherwise the kind
keeps the scratch buffer.

**Controls.** The fbs, serio, Blink and baseline columns, and the sixteen
rows whose code did not change.

## Results

Encode:

| Row          | Reference    | Change       | Ratio | `D`       | Adjusted | µs a call | Runs, reference | Runs, change   |
| ------------ | ------------ | ------------ | ----- | --------- | -------- | --------- | --------------- | -------------- |
| string-heavy | 316.1k ±1.3% | 305.3k ±2.6% | 0.966 | 1.016 (3) | 0.950    | +0.112    | 316.2k, 314.9k  | 306.8k, 300.6k |
| large record | 160.3k ±1.1% | 159.8k ±1.8% | 0.997 | 1.014 (3) | 0.984    | +0.016    | 160.8k, 160.0k  | 161.2k, 158.7k |

The other encode rows moved between 0.989× and 1.022× adjusted, but for
`Blink: Booleans`, which is marked noisy in the reference. The quiet control
cells moved 1.005× on encode, quartiles [1.000, 1.015] over 53. On decode,
whose code did not change, the string-heavy row moved 0.999× adjusted and the
large record 1.004×, and the quiet control cells 1.003×, quartiles
[0.999, 1.009] over 55.

## Discussion

The array of strings is slower again, about 1.1 ns a string on the row's
hundred, where September measured about 2.8 ns. Both runs of the change are
below both runs of the reference. The dict's runs overlap: one run of the
change is above both runs of the reference and one is below them, so it reads
as neither faster nor slower, where September measured it 0.959×.

What separates the arrays the loop pays on from the ones it does not is still
not probed. A string makes one reservation in the write. A union's element
makes one or two, a leaderboard entry two, and a dict's entry two. The loop
pays on the unions and the leaderboard and does not pay on the dict, so the
number of reservations an element makes does not account for it.

## Conclusion

An array of strings is still slower sized by a loop, 0.966× as measured, and
a dict is no faster, so both keep the scratch buffer, as they did before this
probe. The probe is reverted in rbxts-transformer-surge `50ee379`.

## Data

- The reference:
  [data/before-string-and-dict-loops-again.md](data/before-string-and-dict-loops-again.md)
  and
  [data/before-string-and-dict-loops-again.tsv](data/before-string-and-dict-loops-again.tsv),
  recorded at surge `a4b36f8` and rbxts-transformer-surge `8727491`.
- The change:
  [data/string-and-dict-loops-again.md](data/string-and-dict-loops-again.md)
  and
  [data/string-and-dict-loops-again.tsv](data/string-and-dict-loops-again.tsv),
  recorded at surge `a4b36f8` and rbxts-transformer-surge `171f4f6`.
- The figures above were computed from the two `.tsv` files, with the
  recorder's own median, spread and noise rule.
