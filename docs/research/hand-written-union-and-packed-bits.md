# A tagged union and packed bits against hand-written Luau

2026-09-29 · surge `fef70d8` · rbxts-transformer-surge `499d768` · Roblox
0.741.19.7411056

## Abstract

The hand-written baseline covered three rows, and on all three surge's
generated code was within the speed tier's band of it. This adds two rows
whose generated code is not a straight run of writes, the tagged union and
the packed toggles, each with a hand-written codec that writes surge's bytes,
and reads one run of the full catalog. On the tagged union, the hand-written
codec encodes 1.17× as fast as surge, 4.4 ns an event, and decodes at 0.98×.
On the packed toggles, it decodes 1.93× as fast, 299 ns a call or 24.9 ns for
each of the twelve bits surge reads through the package's `unpackBit`, and
encodes at 1.04×.

## Background

[generated-code-performance.md](../future-work/generated-code-performance.md)
recorded the per-call gap to hand-written Luau as closed on the flat struct,
the nested object and the `CFrame` array
([size-and-read-locals.md](size-and-read-locals.md)), and
[benchmark-tooling.md](../future-work/benchmark-tooling.md) chose the next two
rows for the baseline. The tagged union branches on its tag and writes or
builds each variant. The packed toggles' read calls the package's `unpackBit`
once for each bit of its packed region, while the write builds each byte of
the region inline (Runtime API 5.3):

```luau
a = __surge_unpackBit(__surge_input, pos9, 0),
b = __surge_unpackBit(__surge_input, pos9, 1),
```

[packed-against-unpacked.md](packed-against-unpacked.md) estimated about
23 ns for each such call from the packed row's decode against the unpacked
row's, and could not isolate the calls, since no build read the bits inline.

## Method

**The codecs.** Both are in `tests/src/bench/baseline/codecs.luau`. The
tagged union's write sizes its buffer in a first pass over the events, then
writes each event with one test of its tag and its fields at constant offsets
from one position, which moves once per event. Its read tests the variant
byte once per event and builds the event with one table constructor. The
packed toggles' write builds each byte of bits inline, as surge's does. Its
read reads each of the two bytes of bits once and tests each bit with
`bit32.btest`. Each codec writes surge's bytes: the size table shows 1274
bytes for the tagged union and 16 for the packed toggles in both columns, and
a comparison of the two payloads on all five baseline rows, made for this
paper and not kept, found them equal byte for byte.

**Run.** One full invocation of `mise run bench:speed` on 2026-09-29, from
18:51 to 19:00, at surge `fef70d8` and rbxts-transformer-surge `499d768`: two
Studio runs back to back, nine trials per cell per run. The CPU load at its
start was 3%, and no Roblox process was running.

**Reading.** The baseline's median over surge's, pooled over both Studio runs
as the table prints it and for each run from the trials, and the time surge
takes a call beyond the baseline, `1/surge − 1/baseline`. The two columns run
in the same Studio process, so a drift between processes moves both, and the
two runs' agreement is the band a ratio is read against.

**Controls.** The three rows the baseline already covered, where the two
columns were within the band.

## Results

From `docs/benchmarks/speed.md` and `docs/benchmarks/speed-trials.tsv`:

| Row                    | surge      | Baseline   | Ratio | Run 1 | Run 2 | Per call |
| ---------------------- | ---------- | ---------- | ----- | ----- | ----- | -------- |
| tagged union, encode   | 320.8k ±4% | 374.2k ±3% | 1.17× | 1.166 | 1.167 | 0.445 µs |
| tagged union, decode   | 99.0k ±5%  | 97.4k ±4%  | 0.98× | 0.977 | 1.014 | —        |
| packed toggles, encode | 4.66M ±1%  | 4.84M ±2%  | 1.04× | 1.049 | 1.026 | 8.0 ns   |
| packed toggles, decode | 1.62M ±3%  | 3.14M ±6%  | 1.93× | 1.890 | 1.945 | 299 ns   |

On the control rows, the ratio was 1.04× and 0.99× on the flat struct's
encode and decode, 1.00× and 1.00× on the nested object's, and 1.01× and
1.00× on the `CFrame` array's, and no control cell's two runs differed by more
than 0.023. The baseline's summary over its five rows is 1.05× on encode and
1.14× on decode.

## Discussion

The two reads of the packed toggles differ most in the bits: surge
calls `unpackBit`, a function of another module, twelve times, and each call
reads its byte again with `buffer.readbits`, where the hand-written read
reads each byte once and tests its bits in place. The gap is 24.9 ns a bit
and agrees with the estimate of
[packed-against-unpacked.md](packed-against-unpacked.md). The encodes, which
both build each byte of bits inline, are 1.04× apart, 8 ns a call, the flat
struct's ratio in this run.

The tagged union's encode gap is 4.4 ns an event over its hundred. surge's
write tests the tag to choose an index, `if item5.kind == "chat" then 0
elseif …`, and then tests the index to choose the variant's writes, where the
hand-written write tests the tag once. surge's write also moves its cursor
once for each reservation, up to three for an event (the index, the fixed
fields and a string's count and bytes), where the hand-written write moves
one position once for each event. Which of the two accounts for the gap was
not probed. The decode, which in both codecs branches once on the variant
byte, is at parity.

What this does not reach:

- It is one invocation. Its two Studio runs agree on both gaps within 0.06×,
  but a gap measured in a second invocation was not taken.
- The guarded union, and the other rows the baseline does not cover, are not
  measured against hand-written Luau.
- The fixtures and the baseline run native. What either gap is interpreted
  was not run.

## Conclusion

Against hand-written Luau that writes the same bytes, surge's generated code
is 1.93× as slow on the packed toggles' decode, about 25 ns for each bit it
reads through `unpackBit`, and 1.17× as slow on the tagged union's encode,
4.4 ns an event. The other half of each row is within the band, as are all
three rows the baseline covered before.

## Data

- `docs/benchmarks/speed.md` and `docs/benchmarks/speed-trials.tsv` as
  committed at surge `1ab4ac6`, recorded at surge `fef70d8` and
  rbxts-transformer-surge `499d768`.
- The per-run ratios above were computed from that `.tsv`, with the
  recorder's own median.
