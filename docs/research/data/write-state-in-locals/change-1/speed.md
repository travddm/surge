# Scoped speed run

Written by `mise run bench:speed:only`; do not edit by hand.

Scoped to 9 rows by the patterns string, largerecord, set, rest,
sequences, packed, with every column, timing encode, in 2 runs back to
back.

Between the runs, no cell moved by more than 11% and nine in ten by
under 4%.

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

| Fixture                             | surge      | surge (cursor) | fbs        | flamework2 | serio      | blink     | baseline  |
| ----------------------------------- | ---------- | -------------- | ---------- | ---------- | ---------- | --------- | --------- |
| tuples with a rest                  | 574.1k ±2% | 741.6k ±2%     | 136.0k ±3% | 338.4k ±4% | —          | —         | —         |
| large record                        | 132.5k ±4% | 203.1k ±11%†   | 80.8k ±6%  | 98.0k ±4%  | 11.8k ±4%  | 41.4k ±8% | —         |
| set                                 | 797.6k ±3% | 1.07M ±2%      | 262.1k ±1% | 452.6k ±3% | 36.7k ±2%  | —         | —         |
| string-heavy                        | 199.1k ±2% | 487.0k ±6%     | 151.5k ±3% | 163.6k ±2% | 29.9k ±2%  | 63.1k ±8% | —         |
| toggles (unpacked)                  | 4.28M ±4%  | 4.73M ±5%      | 1.46M ±4%  | 3.48M ±3%  | 405.4k ±3% | 1.95M ±5% | —         |
| toggles (packed)                    | 4.52M ±5%  | 4.88M ±2%      | 1.30M ±2%  | —          | 337.6k ±1% | —         | 4.51M ±3% |
| CFrame array (packed, axis-aligned) | 183.5k ±2% | 203.3k ±1%     | 30.9k ±1%  | —          | 5.4k ±2%   | —         | —         |
| CFrame array (packed, arbitrary)    | 133.4k ±5% | 194.6k ±4%     | 29.8k ±4%  | —          | 5.3k ±2%   | —         | —         |
| sequences                           | 49.5k ±5%  | 57.3k ±4%      | 36.0k ±4%  | 684.5k ±5% | 9.3k ±2%   | —         | —         |

## Encode time per value

| Fixture                             | surge   | surge (cursor) | fbs     | flamework2 | serio   | blink   | baseline |
| ----------------------------------- | ------- | -------------- | ------- | ---------- | ------- | ------- | -------- |
| tuples with a rest                  | 1.74 µs | 1.35 µs        | 7.36 µs | 2.95 µs    | —       | —       | —        |
| large record                        | 7.55 µs | 4.92 µs†       | 12.4 µs | 10.2 µs    | 84.7 µs | 24.2 µs | —        |
| set                                 | 1.25 µs | 0.93 µs        | 3.82 µs | 2.21 µs    | 27.3 µs | —       | —        |
| string-heavy                        | 5.02 µs | 2.05 µs        | 6.60 µs | 6.11 µs    | 33.4 µs | 15.8 µs | —        |
| toggles (unpacked)                  | 0.23 µs | 0.21 µs        | 0.69 µs | 0.29 µs    | 2.47 µs | 0.51 µs | —        |
| toggles (packed)                    | 0.22 µs | 0.20 µs        | 0.77 µs | —          | 2.96 µs | —       | 0.22 µs  |
| CFrame array (packed, axis-aligned) | 5.45 µs | 4.92 µs        | 32.3 µs | —          | 185 µs  | —       | —        |
| CFrame array (packed, arbitrary)    | 7.49 µs | 5.14 µs        | 33.6 µs | —          | 188 µs  | —       | —        |
| sequences                           | 20.2 µs | 17.4 µs        | 27.8 µs | 1.46 µs    | 107 µs  | —       | —        |

## Encode against surge

| Fixture                             | surge (cursor) | fbs   | flamework2 | serio | blink | baseline |
| ----------------------------------- | -------------- | ----- | ---------- | ----- | ----- | -------- |
| tuples with a rest                  | 1.29×          | 0.24× | 0.59×      | —     | —     | —        |
| large record                        | 1.53×†         | 0.61× | 0.74×      | 0.09× | 0.31× | —        |
| set                                 | 1.34×          | 0.33× | 0.57×      | 0.05× | —     | —        |
| string-heavy                        | 2.45×          | 0.76× | 0.82×      | 0.15× | 0.32× | —        |
| toggles (unpacked)                  | 1.11×          | 0.34× | 0.81×      | 0.09× | 0.46× | —        |
| toggles (packed)                    | 1.08×          | 0.29× | —          | 0.07× | —     | 1.00×    |
| CFrame array (packed, axis-aligned) | 1.11×          | 0.17× | —          | 0.03× | —     | —        |
| CFrame array (packed, arbitrary)    | 1.46×          | 0.22× | —          | 0.04× | —     | —        |
| sequences                           | 1.16×          | 0.73× | 13.82×     | 0.19× | —     | —        |
