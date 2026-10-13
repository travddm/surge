# Scoped speed run

Written by `mise run bench:speed:only`; do not edit by hand.

Scoped to 5 rows by the patterns leaderboard, largerecord, taggedunion,
nested, with every column, timing encode and decode, in 2 runs back to
back.

Between the runs, no cell moved by more than 7% and nine in ten by under
4%.

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
| deeply nested object | 4.21M ±7%  | 4.74M ±5%      | 1.74M ±3%  | 456.9k ±2% | 2.75M ±4%  | 1.91M ±7%  | 4.34M ±6%  |
| nested arrays        | 777.6k ±3% | 1.19M ±7%      | 261.4k ±1% | 35.1k ±1%  | 750.1k ±2% | 348.8k ±3% | 744.5k ±1% |
| large record         | 138.3k ±2% | 213.4k ±3%     | 81.7k ±5%  | 11.6k ±4%  | 98.5k ±5%  | 43.3k ±6%  | —          |
| leaderboard          | 262.0k ±3% | 811.8k ±4%     | 136.4k ±2% | 26.0k ±2%  | 191.4k ±5% | 96.9k ±6%  | 258.6k ±5% |
| tagged union         | 219.7k ±3% | 577.4k ±4%     | 78.8k ±2%  | 13.3k ±6%  | 149.4k ±4% | 73.8k ±8%  | 221.8k ±5% |

## Encode time per value

| Fixture              | surge   | surge (cursor) | fbs     | serio   | flamework2 | blink   | baseline |
| -------------------- | ------- | -------------- | ------- | ------- | ---------- | ------- | -------- |
| deeply nested object | 0.24 µs | 0.21 µs        | 0.58 µs | 2.19 µs | 0.36 µs    | 0.52 µs | 0.23 µs  |
| nested arrays        | 1.29 µs | 0.84 µs        | 3.83 µs | 28.5 µs | 1.33 µs    | 2.87 µs | 1.34 µs  |
| large record         | 7.23 µs | 4.69 µs        | 12.2 µs | 86.0 µs | 10.2 µs    | 23.1 µs | —        |
| leaderboard          | 3.82 µs | 1.23 µs        | 7.33 µs | 38.5 µs | 5.22 µs    | 10.3 µs | 3.87 µs  |
| tagged union         | 4.55 µs | 1.73 µs        | 12.7 µs | 75.5 µs | 6.69 µs    | 13.5 µs | 4.51 µs  |

## Encode against surge

| Fixture              | surge (cursor) | fbs   | serio | flamework2 | blink | baseline |
| -------------------- | -------------- | ----- | ----- | ---------- | ----- | -------- |
| deeply nested object | 1.13×          | 0.41× | 0.11× | 0.65×      | 0.45× | 1.03×    |
| nested arrays        | 1.53×          | 0.34× | 0.05× | 0.96×      | 0.45× | 0.96×    |
| large record         | 1.54×          | 0.59× | 0.08× | 0.71×      | 0.31× | —        |
| leaderboard          | 3.10×          | 0.52× | 0.10× | 0.73×      | 0.37× | 0.99×    |
| tagged union         | 2.63×          | 0.36× | 0.06× | 0.68×      | 0.34× | 1.01×    |

## Decode throughput

| Fixture              | surge      | surge (cursor) | surge (readChecks) | fbs        | serio       | flamework2 | blink      | baseline   |
| -------------------- | ---------- | -------------- | ------------------ | ---------- | ----------- | ---------- | ---------- | ---------- |
| deeply nested object | 2.62M ±2%  | 2.49M ±2%      | 2.51M ±4%          | 1.54M ±3%  | 716.2k ±2%  | 2.09M ±4%  | 1.62M ±2%  | 2.63M ±4%  |
| nested arrays        | 303.4k ±5% | 300.6k ±5%     | 298.6k ±7%         | 155.6k ±2% | 75.8k ±2%   | 265.7k ±4% | 239.7k ±2% | 304.8k ±7% |
| large record         | 70.0k ±3%  | 69.6k ±3%      | 68.1k ±3%          | 51.5k ±2%  | 23.7k ±0.9% | 59.2k ±3%  | 65.3k ±3%  | —          |
| leaderboard          | 159.5k ±3% | 158.7k ±5%     | 158.3k ±3%         | 93.5k ±4%  | 43.0k ±1%   | 128.5k ±4% | 93.7k ±3%  | 153.6k ±4% |
| tagged union         | 94.0k ±4%  | 93.6k ±5%      | 93.5k ±5%          | 43.9k ±4%  | 19.8k ±1%   | 85.6k ±4%  | 55.5k ±4%  | 95.9k ±6%  |

## Decode time per value

| Fixture              | surge   | surge (cursor) | surge (readChecks) | fbs     | serio   | flamework2 | blink   | baseline |
| -------------------- | ------- | -------------- | ------------------ | ------- | ------- | ---------- | ------- | -------- |
| deeply nested object | 0.38 µs | 0.40 µs        | 0.40 µs            | 0.65 µs | 1.40 µs | 0.48 µs    | 0.62 µs | 0.38 µs  |
| nested arrays        | 3.30 µs | 3.33 µs        | 3.35 µs            | 6.43 µs | 13.2 µs | 3.76 µs    | 4.17 µs | 3.28 µs  |
| large record         | 14.3 µs | 14.4 µs        | 14.7 µs            | 19.4 µs | 42.2 µs | 16.9 µs    | 15.3 µs | —        |
| leaderboard          | 6.27 µs | 6.30 µs        | 6.32 µs            | 10.7 µs | 23.3 µs | 7.78 µs    | 10.7 µs | 6.51 µs  |
| tagged union         | 10.6 µs | 10.7 µs        | 10.7 µs            | 22.8 µs | 50.5 µs | 11.7 µs    | 18.0 µs | 10.4 µs  |

## Decode against surge

| Fixture              | surge (cursor) | surge (readChecks) | fbs   | serio | flamework2 | blink | baseline |
| -------------------- | -------------- | ------------------ | ----- | ----- | ---------- | ----- | -------- |
| deeply nested object | 0.95×          | 0.96×              | 0.59× | 0.27× | 0.80×      | 0.62× | 1.00×    |
| nested arrays        | 0.99×          | 0.98×              | 0.51× | 0.25× | 0.88×      | 0.79× | 1.00×    |
| large record         | 1.00×          | 0.97×              | 0.74× | 0.34× | 0.85×      | 0.93× | —        |
| leaderboard          | 1.00×          | 0.99×              | 0.59× | 0.27× | 0.81×      | 0.59× | 0.96×    |
| tagged union         | 1.00×          | 1.00×              | 0.47× | 0.21× | 0.91×      | 0.59× | 1.02×    |
