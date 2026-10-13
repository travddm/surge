# Scoped speed run

Written by `mise run bench:speed:only`; do not edit by hand.

Scoped to 5 rows by the patterns leaderboard, largerecord, taggedunion,
nested, with every column, timing encode and decode, in 2 runs back to
back.

Between the runs, no cell moved by more than 10% and nine in ten by
under 4%.

The run:

- Date: 2026-10-13
- Roblox: 0.742.0.7421053
- Machine: 12th Gen Intel(R) Core(TM) i9-12900KF, 16 threads, win32 10.0.26200
- Runs: 2, back to back
- Commit: 5c4da9a
- roblox-ts: 3.0.0
- @rbxts/flamework-binary-serializer: 0.7.0
- @rbxts/serio: 1.2.7
- @flamework-experimental/core: 2.0.0-alpha.8
- Blink: 0.18.8

## Encode throughput

| Fixture              | surge      | surge (cursor) | fbs        | serio      | flamework2 | blink      | baseline   |
| -------------------- | ---------- | -------------- | ---------- | ---------- | ---------- | ---------- | ---------- |
| deeply nested object | 4.23M ±4%  | 4.74M ±6%      | 1.69M ±5%  | 461.2k ±3% | 2.80M ±3%  | 1.95M ±5%  | 4.34M ±8%  |
| nested arrays        | 798.1k ±5% | 1.19M ±2%      | 260.7k ±3% | 35.2k ±1%  | 746.2k ±2% | 354.0k ±5% | 769.3k ±8% |
| large record         | 136.1k ±3% | 216.1k ±4%     | 81.8k ±3%  | 11.6k ±4%  | 97.8k ±5%  | 42.3k ±8%  | —          |
| leaderboard          | 257.1k ±5% | 816.9k ±6%     | 135.8k ±2% | 26.0k ±4%  | 194.1k ±3% | 94.7k ±7%  | 259.9k ±5% |
| tagged union         | 215.7k ±6% | 592.6k ±3%     | 77.6k ±3%  | 13.3k ±3%  | 146.4k ±4% | 74.5k ±4%  | 215.0k ±5% |

## Encode time per value

| Fixture              | surge   | surge (cursor) | fbs     | serio   | flamework2 | blink   | baseline |
| -------------------- | ------- | -------------- | ------- | ------- | ---------- | ------- | -------- |
| deeply nested object | 0.24 µs | 0.21 µs        | 0.59 µs | 2.17 µs | 0.36 µs    | 0.51 µs | 0.23 µs  |
| nested arrays        | 1.25 µs | 0.84 µs        | 3.84 µs | 28.4 µs | 1.34 µs    | 2.82 µs | 1.30 µs  |
| large record         | 7.35 µs | 4.63 µs        | 12.2 µs | 85.9 µs | 10.2 µs    | 23.7 µs | —        |
| leaderboard          | 3.89 µs | 1.22 µs        | 7.36 µs | 38.4 µs | 5.15 µs    | 10.6 µs | 3.85 µs  |
| tagged union         | 4.64 µs | 1.69 µs        | 12.9 µs | 74.9 µs | 6.83 µs    | 13.4 µs | 4.65 µs  |

## Encode against surge

| Fixture              | surge (cursor) | fbs   | serio | flamework2 | blink | baseline |
| -------------------- | -------------- | ----- | ----- | ---------- | ----- | -------- |
| deeply nested object | 1.12×          | 0.40× | 0.11× | 0.66×      | 0.46× | 1.03×    |
| nested arrays        | 1.49×          | 0.33× | 0.04× | 0.93×      | 0.44× | 0.96×    |
| large record         | 1.59×          | 0.60× | 0.09× | 0.72×      | 0.31× | —        |
| leaderboard          | 3.18×          | 0.53× | 0.10× | 0.75×      | 0.37× | 1.01×    |
| tagged union         | 2.75×          | 0.36× | 0.06× | 0.68×      | 0.35× | 1.00×    |

## Decode throughput

| Fixture              | surge       | surge (cursor) | surge (readChecks) | fbs        | serio      | flamework2 | blink      | baseline    |
| -------------------- | ----------- | -------------- | ------------------ | ---------- | ---------- | ---------- | ---------- | ----------- |
| deeply nested object | 2.60M ±8%   | 2.43M ±7%      | 2.47M ±6%          | 1.54M ±4%  | 717.8k ±4% | 2.09M ±5%  | 1.60M ±4%  | 2.60M ±6%   |
| nested arrays        | 309.2k ±5%  | 296.7k ±8%     | 304.0k ±7%         | 156.5k ±4% | 76.3k ±2%  | 270.9k ±7% | 240.4k ±5% | 306.5k ±9%  |
| large record         | 72.3k ±7%   | 71.1k ±7%      | 71.2k ±7%          | 52.3k ±6%  | 23.9k ±4%  | 60.7k ±8%  | 68.5k ±7%  | —           |
| leaderboard          | 156.0k ±10% | 157.9k ±8%     | 157.0k ±10%        | 91.8k ±5%  | 42.7k ±3%  | 132.1k ±4% | 94.2k ±4%  | 157.2k ±6%  |
| tagged union         | 93.8k ±8%   | 92.3k ±8%      | 92.6k ±9%          | 43.3k ±6%  | 19.8k ±3%  | 84.8k ±10% | 55.5k ±5%  | 96.7k ±11%† |

## Decode time per value

| Fixture              | surge   | surge (cursor) | surge (readChecks) | fbs     | serio   | flamework2 | blink   | baseline |
| -------------------- | ------- | -------------- | ------------------ | ------- | ------- | ---------- | ------- | -------- |
| deeply nested object | 0.39 µs | 0.41 µs        | 0.41 µs            | 0.65 µs | 1.39 µs | 0.48 µs    | 0.62 µs | 0.38 µs  |
| nested arrays        | 3.23 µs | 3.37 µs        | 3.29 µs            | 6.39 µs | 13.1 µs | 3.69 µs    | 4.16 µs | 3.26 µs  |
| large record         | 13.8 µs | 14.1 µs        | 14.1 µs            | 19.1 µs | 41.8 µs | 16.5 µs    | 14.6 µs | —        |
| leaderboard          | 6.41 µs | 6.33 µs        | 6.37 µs            | 10.9 µs | 23.4 µs | 7.57 µs    | 10.6 µs | 6.36 µs  |
| tagged union         | 10.7 µs | 10.8 µs        | 10.8 µs            | 23.1 µs | 50.5 µs | 11.8 µs    | 18.0 µs | 10.3 µs† |

## Decode against surge

| Fixture              | surge (cursor) | surge (readChecks) | fbs   | serio | flamework2 | blink | baseline |
| -------------------- | -------------- | ------------------ | ----- | ----- | ---------- | ----- | -------- |
| deeply nested object | 0.94×          | 0.95×              | 0.59× | 0.28× | 0.81×      | 0.62× | 1.00×    |
| nested arrays        | 0.96×          | 0.98×              | 0.51× | 0.25× | 0.88×      | 0.78× | 0.99×    |
| large record         | 0.98×          | 0.98×              | 0.72× | 0.33× | 0.84×      | 0.95× | —        |
| leaderboard          | 1.01×          | 1.01×              | 0.59× | 0.27× | 0.85×      | 0.60× | 1.01×    |
| tagged union         | 0.98×          | 0.99×              | 0.46× | 0.21× | 0.90×      | 0.59× | 1.03×†   |
