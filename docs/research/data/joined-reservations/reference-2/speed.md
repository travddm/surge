# Scoped speed run

Written by `mise run bench:speed:only`; do not edit by hand.

Scoped to 5 rows by the patterns leaderboard, largerecord, taggedunion,
nested, with every column, timing encode and decode, in 2 runs back to
back.

Between the runs, no cell moved by more than 9% and nine in ten by under
4%.

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

| Fixture              | surge      | surge (cursor) | fbs        | serio       | flamework2 | blink      | baseline   |
| -------------------- | ---------- | -------------- | ---------- | ----------- | ---------- | ---------- | ---------- |
| deeply nested object | 4.26M ±5%  | 4.72M ±4%      | 1.73M ±5%  | 460.3k ±3%  | 2.80M ±4%  | 1.92M ±4%  | 4.34M ±5%  |
| nested arrays        | 788.2k ±2% | 1.19M ±2%      | 262.3k ±2% | 35.2k ±0.7% | 749.8k ±2% | 343.3k ±4% | 781.1k ±4% |
| large record         | 135.5k ±3% | 213.3k ±4%     | 82.2k ±4%  | 11.8k ±5%   | 98.1k ±5%  | 42.8k ±4%  | —          |
| leaderboard          | 262.1k ±6% | 781.6k ±4%     | 136.6k ±4% | 26.0k ±4%   | 193.4k ±4% | 95.7k ±3%  | 264.5k ±4% |
| tagged union         | 216.1k ±3% | 589.3k ±3%     | 78.9k ±4%  | 13.3k ±4%   | 149.6k ±3% | 74.3k ±7%  | 218.9k ±3% |

## Encode time per value

| Fixture              | surge   | surge (cursor) | fbs     | serio   | flamework2 | blink   | baseline |
| -------------------- | ------- | -------------- | ------- | ------- | ---------- | ------- | -------- |
| deeply nested object | 0.23 µs | 0.21 µs        | 0.58 µs | 2.17 µs | 0.36 µs    | 0.52 µs | 0.23 µs  |
| nested arrays        | 1.27 µs | 0.84 µs        | 3.81 µs | 28.4 µs | 1.33 µs    | 2.91 µs | 1.28 µs  |
| large record         | 7.38 µs | 4.69 µs        | 12.2 µs | 85.0 µs | 10.2 µs    | 23.4 µs | —        |
| leaderboard          | 3.82 µs | 1.28 µs        | 7.32 µs | 38.5 µs | 5.17 µs    | 10.5 µs | 3.78 µs  |
| tagged union         | 4.63 µs | 1.70 µs        | 12.7 µs | 75.3 µs | 6.68 µs    | 13.5 µs | 4.57 µs  |

## Encode against surge

| Fixture              | surge (cursor) | fbs   | serio | flamework2 | blink | baseline |
| -------------------- | -------------- | ----- | ----- | ---------- | ----- | -------- |
| deeply nested object | 1.11×          | 0.41× | 0.11× | 0.66×      | 0.45× | 1.02×    |
| nested arrays        | 1.51×          | 0.33× | 0.04× | 0.95×      | 0.44× | 0.99×    |
| large record         | 1.57×          | 0.61× | 0.09× | 0.72×      | 0.32× | —        |
| leaderboard          | 2.98×          | 0.52× | 0.10× | 0.74×      | 0.37× | 1.01×    |
| tagged union         | 2.73×          | 0.37× | 0.06× | 0.69×      | 0.34× | 1.01×    |

## Decode throughput

| Fixture              | surge       | surge (cursor) | surge (readChecks) | fbs        | serio      | flamework2 | blink      | baseline    |
| -------------------- | ----------- | -------------- | ------------------ | ---------- | ---------- | ---------- | ---------- | ----------- |
| deeply nested object | 2.66M ±5%   | 2.46M ±4%      | 2.49M ±7%          | 1.56M ±2%  | 713.6k ±1% | 2.07M ±6%  | 1.62M ±6%  | 2.61M ±7%   |
| nested arrays        | 306.4k ±9%  | 303.7k ±7%     | 300.6k ±6%         | 157.6k ±3% | 76.3k ±2%  | 266.5k ±7% | 244.0k ±4% | 304.1k ±7%  |
| large record         | 71.9k ±6%   | 72.7k ±6%      | 72.1k ±7%          | 52.8k ±4%  | 24.3k ±2%  | 61.5k ±5%  | 68.9k ±7%  | —           |
| leaderboard          | 148.6k ±9%  | 155.9k ±7%     | 157.4k ±7%         | 92.6k ±3%  | 42.8k ±2%  | 126.7k ±8% | 93.1k ±5%  | 156.2k ±6%  |
| tagged union         | 91.5k ±11%† | 93.6k ±9%      | 92.8k ±8%          | 43.6k ±4%  | 19.7k ±3%  | 82.9k ±5%  | 55.9k ±6%  | 89.1k ±12%† |

## Decode time per value

| Fixture              | surge    | surge (cursor) | surge (readChecks) | fbs     | serio   | flamework2 | blink   | baseline |
| -------------------- | -------- | -------------- | ------------------ | ------- | ------- | ---------- | ------- | -------- |
| deeply nested object | 0.38 µs  | 0.41 µs        | 0.40 µs            | 0.64 µs | 1.40 µs | 0.48 µs    | 0.62 µs | 0.38 µs  |
| nested arrays        | 3.26 µs  | 3.29 µs        | 3.33 µs            | 6.34 µs | 13.1 µs | 3.75 µs    | 4.10 µs | 3.29 µs  |
| large record         | 13.9 µs  | 13.8 µs        | 13.9 µs            | 19.0 µs | 41.2 µs | 16.3 µs    | 14.5 µs | —        |
| leaderboard          | 6.73 µs  | 6.41 µs        | 6.35 µs            | 10.8 µs | 23.4 µs | 7.89 µs    | 10.7 µs | 6.40 µs  |
| tagged union         | 10.9 µs† | 10.7 µs        | 10.8 µs            | 23.0 µs | 50.8 µs | 12.1 µs    | 17.9 µs | 11.2 µs† |

## Decode against surge

| Fixture              | surge (cursor) | surge (readChecks) | fbs    | serio  | flamework2 | blink  | baseline |
| -------------------- | -------------- | ------------------ | ------ | ------ | ---------- | ------ | -------- |
| deeply nested object | 0.93×          | 0.94×              | 0.59×  | 0.27×  | 0.78×      | 0.61×  | 0.98×    |
| nested arrays        | 0.99×          | 0.98×              | 0.51×  | 0.25×  | 0.87×      | 0.80×  | 0.99×    |
| large record         | 1.01×          | 1.00×              | 0.73×  | 0.34×  | 0.85×      | 0.96×  | —        |
| leaderboard          | 1.05×          | 1.06×              | 0.62×  | 0.29×  | 0.85×      | 0.63×  | 1.05×    |
| tagged union         | 1.02×†         | 1.01×†             | 0.48×† | 0.22×† | 0.91×†     | 0.61×† | 0.97×†   |
