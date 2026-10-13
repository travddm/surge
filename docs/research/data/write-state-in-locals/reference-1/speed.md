# Scoped speed run

Written by `mise run bench:speed:only`; do not edit by hand.

Scoped to 9 rows by the patterns string, largerecord, set, rest,
sequences, packed, with every column, timing encode, in 2 runs back to
back.

Between the runs, no cell moved by more than 18% and nine in ten by
under 4%.

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

| Fixture                             | surge       | surge (cursor) | fbs        | flamework2 | serio       | blink     | baseline  |
| ----------------------------------- | ----------- | -------------- | ---------- | ---------- | ----------- | --------- | --------- |
| tuples with a rest                  | 356.3k ±2%  | 747.8k ±3%     | 135.8k ±2% | 341.6k ±2% | —           | —         | —         |
| large record                        | 124.1k ±3%  | 212.7k ±3%     | 82.2k ±3%  | 97.5k ±6%  | 11.8k ±0.9% | 42.8k ±4% | —         |
| set                                 | 514.1k ±2%  | 1.01M ±4%      | 262.9k ±2% | 454.7k ±2% | 36.7k ±0.8% | —         | —         |
| string-heavy                        | 195.9k ±4%  | 485.3k ±2%     | 154.0k ±4% | 163.9k ±3% | 30.3k ±3%   | 64.3k ±6% | —         |
| toggles (unpacked)                  | 3.97M ±18%† | 4.81M ±4%      | 1.48M ±4%  | 3.43M ±5%  | 405.0k ±1%  | 1.99M ±4% | —         |
| toggles (packed)                    | 4.48M ±4%   | 4.97M ±3%      | 1.32M ±2%  | —          | 339.5k ±2%  | —         | 4.50M ±3% |
| CFrame array (packed, axis-aligned) | 178.2k ±3%  | 200.3k ±5%     | 31.3k ±3%  | —          | 5.4k ±1%    | —         | —         |
| CFrame array (packed, arbitrary)    | 131.0k ±2%  | 201.2k ±3%     | 29.0k ±7%  | —          | 5.4k ±2%    | —         | —         |
| sequences                           | 44.6k ±7%   | 55.8k ±4%      | 35.5k ±4%  | 695.3k ±7% | 9.3k ±2%    | —         | —         |

## Encode time per value

| Fixture                             | surge    | surge (cursor) | fbs     | flamework2 | serio   | blink   | baseline |
| ----------------------------------- | -------- | -------------- | ------- | ---------- | ------- | ------- | -------- |
| tuples with a rest                  | 2.81 µs  | 1.34 µs        | 7.37 µs | 2.93 µs    | —       | —       | —        |
| large record                        | 8.06 µs  | 4.70 µs        | 12.2 µs | 10.3 µs    | 84.4 µs | 23.4 µs | —        |
| set                                 | 1.95 µs  | 0.99 µs        | 3.80 µs | 2.20 µs    | 27.2 µs | —       | —        |
| string-heavy                        | 5.11 µs  | 2.06 µs        | 6.49 µs | 6.10 µs    | 33.0 µs | 15.6 µs | —        |
| toggles (unpacked)                  | 0.25 µs† | 0.21 µs        | 0.68 µs | 0.29 µs    | 2.47 µs | 0.50 µs | —        |
| toggles (packed)                    | 0.22 µs  | 0.20 µs        | 0.75 µs | —          | 2.95 µs | —       | 0.22 µs  |
| CFrame array (packed, axis-aligned) | 5.61 µs  | 4.99 µs        | 31.9 µs | —          | 185 µs  | —       | —        |
| CFrame array (packed, arbitrary)    | 7.63 µs  | 4.97 µs        | 34.5 µs | —          | 186 µs  | —       | —        |
| sequences                           | 22.4 µs  | 17.9 µs        | 28.2 µs | 1.44 µs    | 107 µs  | —       | —        |

## Encode against surge

| Fixture                             | surge (cursor) | fbs    | flamework2 | serio  | blink  | baseline |
| ----------------------------------- | -------------- | ------ | ---------- | ------ | ------ | -------- |
| tuples with a rest                  | 2.10×          | 0.38×  | 0.96×      | —      | —      | —        |
| large record                        | 1.71×          | 0.66×  | 0.79×      | 0.10×  | 0.34×  | —        |
| set                                 | 1.97×          | 0.51×  | 0.88×      | 0.07×  | —      | —        |
| string-heavy                        | 2.48×          | 0.79×  | 0.84×      | 0.15×  | 0.33×  | —        |
| toggles (unpacked)                  | 1.21×†         | 0.37×† | 0.86×†     | 0.10×† | 0.50×† | —        |
| toggles (packed)                    | 1.11×          | 0.30×  | —          | 0.08×  | —      | 1.00×    |
| CFrame array (packed, axis-aligned) | 1.12×          | 0.18×  | —          | 0.03×  | —      | —        |
| CFrame array (packed, arbitrary)    | 1.54×          | 0.22×  | —          | 0.04×  | —      | —        |
| sequences                           | 1.25×          | 0.79×  | 15.58×     | 0.21×  | —      | —        |
