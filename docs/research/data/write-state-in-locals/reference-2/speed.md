# Scoped speed run

Written by `mise run bench:speed:only`; do not edit by hand.

Scoped to 9 rows by the patterns string, largerecord, set, rest,
sequences, packed, with every column, timing encode, in 2 runs back to
back.

Between the runs, no cell moved by more than 4% and nine in ten by under
3%.

The run:

- Date: 2026-10-13
- Roblox: 0.742.0.7421053
- Machine: 12th Gen Intel(R) Core(TM) i9-12900KF, 16 threads, win32 10.0.26200
- Runs: 2, back to back
- Commit: 5745202
- roblox-ts: 3.0.0
- @rbxts/flamework-binary-serializer: 0.7.0
- @rbxts/serio: 1.2.7
- @flamework-experimental/core: 2.0.0-alpha.8
- Blink: 0.18.8

## Encode throughput

| Fixture                             | surge      | surge (cursor) | fbs        | flamework2 | serio       | blink     | baseline  |
| ----------------------------------- | ---------- | -------------- | ---------- | ---------- | ----------- | --------- | --------- |
| tuples with a rest                  | 355.1k ±2% | 752.1k ±2%     | 132.9k ±3% | 338.2k ±2% | —           | —         | —         |
| large record                        | 126.6k ±2% | 211.2k ±4%     | 82.7k ±2%  | 98.4k ±3%  | 11.7k ±4%   | 43.1k ±5% | —         |
| set                                 | 517.5k ±2% | 1.05M ±3%      | 262.3k ±1% | 457.9k ±2% | 37.0k ±0.9% | —         | —         |
| string-heavy                        | 197.0k ±4% | 500.8k ±2%     | 152.6k ±3% | 165.4k ±5% | 30.1k ±2%   | 64.1k ±5% | —         |
| toggles (unpacked)                  | 4.40M ±4%  | 4.82M ±4%      | 1.49M ±3%  | 3.57M ±4%  | 398.8k ±3%  | 1.98M ±4% | —         |
| toggles (packed)                    | 4.62M ±3%  | 4.99M ±3%      | 1.32M ±2%  | —          | 337.7k ±2%  | —         | 4.57M ±3% |
| CFrame array (packed, axis-aligned) | 178.1k ±4% | 202.9k ±4%     | 31.0k ±1%  | —          | 5.4k ±1%    | —         | —         |
| CFrame array (packed, arbitrary)    | 133.8k ±4% | 201.3k ±5%     | 29.9k ±2%  | —          | 5.4k ±3%    | —         | —         |
| sequences                           | 46.8k ±4%  | 58.7k ±5%      | 36.2k ±6%  | 706.1k ±4% | 9.3k ±2%    | —         | —         |

## Encode time per value

| Fixture                             | surge   | surge (cursor) | fbs     | flamework2 | serio   | blink   | baseline |
| ----------------------------------- | ------- | -------------- | ------- | ---------- | ------- | ------- | -------- |
| tuples with a rest                  | 2.82 µs | 1.33 µs        | 7.52 µs | 2.96 µs    | —       | —       | —        |
| large record                        | 7.90 µs | 4.74 µs        | 12.1 µs | 10.2 µs    | 85.1 µs | 23.2 µs | —        |
| set                                 | 1.93 µs | 0.96 µs        | 3.81 µs | 2.18 µs    | 27.0 µs | —       | —        |
| string-heavy                        | 5.08 µs | 2.00 µs        | 6.55 µs | 6.05 µs    | 33.2 µs | 15.6 µs | —        |
| toggles (unpacked)                  | 0.23 µs | 0.21 µs        | 0.67 µs | 0.28 µs    | 2.51 µs | 0.50 µs | —        |
| toggles (packed)                    | 0.22 µs | 0.20 µs        | 0.76 µs | —          | 2.96 µs | —       | 0.22 µs  |
| CFrame array (packed, axis-aligned) | 5.61 µs | 4.93 µs        | 32.3 µs | —          | 184 µs  | —       | —        |
| CFrame array (packed, arbitrary)    | 7.48 µs | 4.97 µs        | 33.4 µs | —          | 187 µs  | —       | —        |
| sequences                           | 21.4 µs | 17.0 µs        | 27.6 µs | 1.42 µs    | 107 µs  | —       | —        |

## Encode against surge

| Fixture                             | surge (cursor) | fbs   | flamework2 | serio | blink | baseline |
| ----------------------------------- | -------------- | ----- | ---------- | ----- | ----- | -------- |
| tuples with a rest                  | 2.12×          | 0.37× | 0.95×      | —     | —     | —        |
| large record                        | 1.67×          | 0.65× | 0.78×      | 0.09× | 0.34× | —        |
| set                                 | 2.02×          | 0.51× | 0.88×      | 0.07× | —     | —        |
| string-heavy                        | 2.54×          | 0.77× | 0.84×      | 0.15× | 0.33× | —        |
| toggles (unpacked)                  | 1.09×          | 0.34× | 0.81×      | 0.09× | 0.45× | —        |
| toggles (packed)                    | 1.08×          | 0.29× | —          | 0.07× | —     | 0.99×    |
| CFrame array (packed, axis-aligned) | 1.14×          | 0.17× | —          | 0.03× | —     | —        |
| CFrame array (packed, arbitrary)    | 1.50×          | 0.22× | —          | 0.04× | —     | —        |
| sequences                           | 1.25×          | 0.77× | 15.09×     | 0.20× | —     | —        |
