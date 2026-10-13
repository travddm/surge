# Scoped speed run

Written by `mise run bench:speed:only`; do not edit by hand.

Scoped to 9 rows by the patterns string, largerecord, set, rest,
sequences, packed, with every column, timing encode, in 2 runs back to
back.

Between the runs, no cell moved by more than 7% and nine in ten by under
3%.

The run:

- Date: 2026-10-13
- Roblox: 0.742.0.7421053
- Machine: 12th Gen Intel(R) Core(TM) i9-12900KF, 16 threads, win32 10.0.26200
- Runs: 2, back to back
- Commit: 88fe442
- roblox-ts: 3.0.0
- @rbxts/flamework-binary-serializer: 0.7.0
- @rbxts/serio: 1.2.7
- @flamework-experimental/core: 2.0.0-alpha.8
- Blink: 0.18.8

## Encode throughput

| Fixture                             | surge      | surge (cursor) | fbs          | flamework2 | serio      | blink     | baseline  |
| ----------------------------------- | ---------- | -------------- | ------------ | ---------- | ---------- | --------- | --------- |
| tuples with a rest                  | 580.7k ±5% | 741.6k ±2%     | 133.2k ±3%   | 325.7k ±7% | —          | —         | —         |
| large record                        | 136.0k ±2% | 213.4k ±4%     | 81.9k ±6%    | 100.1k ±6% | 11.6k ±3%  | 42.3k ±4% | —         |
| set                                 | 793.4k ±2% | 1.06M ±3%      | 263.4k ±1.0% | 448.0k ±2% | 36.8k ±1%  | —         | —         |
| string-heavy                        | 201.5k ±5% | 489.5k ±3%     | 152.7k ±2%   | 164.5k ±5% | 30.1k ±3%  | 63.3k ±5% | —         |
| toggles (unpacked)                  | 4.34M ±3%  | 4.78M ±5%      | 1.49M ±2%    | 3.56M ±4%  | 410.6k ±2% | 1.96M ±5% | —         |
| toggles (packed)                    | 4.57M ±5%  | 4.93M ±4%      | 1.32M ±2%    | —          | 339.6k ±2% | —         | 4.51M ±3% |
| CFrame array (packed, axis-aligned) | 180.7k ±3% | 200.2k ±2%     | 30.9k ±4%    | —          | 5.4k ±2%   | —         | —         |
| CFrame array (packed, arbitrary)    | 136.0k ±2% | 202.3k ±5%     | 29.2k ±6%    | —          | 5.4k ±2%   | —         | —         |
| sequences                           | 49.9k ±2%  | 57.1k ±4%      | 35.3k ±4%    | 704.7k ±3% | 9.4k ±3%   | —         | —         |

## Encode time per value

| Fixture                             | surge   | surge (cursor) | fbs     | flamework2 | serio   | blink   | baseline |
| ----------------------------------- | ------- | -------------- | ------- | ---------- | ------- | ------- | -------- |
| tuples with a rest                  | 1.72 µs | 1.35 µs        | 7.51 µs | 3.07 µs    | —       | —       | —        |
| large record                        | 7.35 µs | 4.69 µs        | 12.2 µs | 9.99 µs    | 86.1 µs | 23.6 µs | —        |
| set                                 | 1.26 µs | 0.94 µs        | 3.80 µs | 2.23 µs    | 27.2 µs | —       | —        |
| string-heavy                        | 4.96 µs | 2.04 µs        | 6.55 µs | 6.08 µs    | 33.3 µs | 15.8 µs | —        |
| toggles (unpacked)                  | 0.23 µs | 0.21 µs        | 0.67 µs | 0.28 µs    | 2.44 µs | 0.51 µs | —        |
| toggles (packed)                    | 0.22 µs | 0.20 µs        | 0.76 µs | —          | 2.94 µs | —       | 0.22 µs  |
| CFrame array (packed, axis-aligned) | 5.54 µs | 5.00 µs        | 32.3 µs | —          | 186 µs  | —       | —        |
| CFrame array (packed, arbitrary)    | 7.35 µs | 4.94 µs        | 34.2 µs | —          | 187 µs  | —       | —        |
| sequences                           | 20.0 µs | 17.5 µs        | 28.3 µs | 1.42 µs    | 107 µs  | —       | —        |

## Encode against surge

| Fixture                             | surge (cursor) | fbs   | flamework2 | serio | blink | baseline |
| ----------------------------------- | -------------- | ----- | ---------- | ----- | ----- | -------- |
| tuples with a rest                  | 1.28×          | 0.23× | 0.56×      | —     | —     | —        |
| large record                        | 1.57×          | 0.60× | 0.74×      | 0.09× | 0.31× | —        |
| set                                 | 1.34×          | 0.33× | 0.56×      | 0.05× | —     | —        |
| string-heavy                        | 2.43×          | 0.76× | 0.82×      | 0.15× | 0.31× | —        |
| toggles (unpacked)                  | 1.10×          | 0.34× | 0.82×      | 0.09× | 0.45× | —        |
| toggles (packed)                    | 1.08×          | 0.29× | —          | 0.07× | —     | 0.99×    |
| CFrame array (packed, axis-aligned) | 1.11×          | 0.17× | —          | 0.03× | —     | —        |
| CFrame array (packed, arbitrary)    | 1.49×          | 0.21× | —          | 0.04× | —     | —        |
| sequences                           | 1.14×          | 0.71× | 14.12×     | 0.19× | —     | —        |
