# Scoped speed run

Written by `mise run bench:speed:only`; do not edit by hand.

Scoped to 5 rows by the patterns leaderboard, largerecord, taggedunion,
nested, with every column, timing encode and decode, in 2 runs back to
back.

Between the runs, no cell moved by more than 7% and nine in ten by under
6%.

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

| Fixture              | surge      | surge (cursor) | fbs        | serio      | flamework2 | blink      | baseline   |
| -------------------- | ---------- | -------------- | ---------- | ---------- | ---------- | ---------- | ---------- |
| deeply nested object | 4.26M ±5%  | 4.69M ±5%      | 1.74M ±4%  | 459.6k ±2% | 2.83M ±5%  | 1.91M ±7%  | 4.25M ±6%  |
| nested arrays        | 774.6k ±4% | 1.17M ±2%      | 258.4k ±2% | 35.0k ±1%  | 741.6k ±3% | 338.3k ±4% | 765.3k ±5% |
| large record         | 135.9k ±3% | 211.2k ±3%     | 80.7k ±3%  | 11.8k ±3%  | 96.2k ±3%  | 43.2k ±6%  | —          |
| leaderboard          | 255.7k ±3% | 763.6k ±5%     | 134.6k ±4% | 25.8k ±4%  | 192.7k ±3% | 94.3k ±7%  | 253.5k ±6% |
| tagged union         | 217.9k ±2% | 584.3k ±4%     | 78.4k ±4%  | 13.4k ±4%  | 147.6k ±4% | 75.1k ±8%  | 215.3k ±6% |

## Encode time per value

| Fixture              | surge   | surge (cursor) | fbs     | serio   | flamework2 | blink   | baseline |
| -------------------- | ------- | -------------- | ------- | ------- | ---------- | ------- | -------- |
| deeply nested object | 0.23 µs | 0.21 µs        | 0.57 µs | 2.18 µs | 0.35 µs    | 0.52 µs | 0.24 µs  |
| nested arrays        | 1.29 µs | 0.85 µs        | 3.87 µs | 28.6 µs | 1.35 µs    | 2.96 µs | 1.31 µs  |
| large record         | 7.36 µs | 4.74 µs        | 12.4 µs | 84.6 µs | 10.4 µs    | 23.1 µs | —        |
| leaderboard          | 3.91 µs | 1.31 µs        | 7.43 µs | 38.8 µs | 5.19 µs    | 10.6 µs | 3.95 µs  |
| tagged union         | 4.59 µs | 1.71 µs        | 12.7 µs | 74.8 µs | 6.78 µs    | 13.3 µs | 4.65 µs  |

## Encode against surge

| Fixture              | surge (cursor) | fbs   | serio | flamework2 | blink | baseline |
| -------------------- | -------------- | ----- | ----- | ---------- | ----- | -------- |
| deeply nested object | 1.10×          | 0.41× | 0.11× | 0.66×      | 0.45× | 1.00×    |
| nested arrays        | 1.51×          | 0.33× | 0.05× | 0.96×      | 0.44× | 0.99×    |
| large record         | 1.55×          | 0.59× | 0.09× | 0.71×      | 0.32× | —        |
| leaderboard          | 2.99×          | 0.53× | 0.10× | 0.75×      | 0.37× | 0.99×    |
| tagged union         | 2.68×          | 0.36× | 0.06× | 0.68×      | 0.34× | 0.99×    |

## Decode throughput

| Fixture              | surge       | surge (cursor) | surge (readChecks) | fbs        | serio      | flamework2 | blink      | baseline   |
| -------------------- | ----------- | -------------- | ------------------ | ---------- | ---------- | ---------- | ---------- | ---------- |
| deeply nested object | 2.56M ±5%   | 2.42M ±5%      | 2.37M ±7%          | 1.52M ±3%  | 718.4k ±3% | 2.07M ±6%  | 1.59M ±4%  | 2.60M ±8%  |
| nested arrays        | 299.2k ±8%  | 300.9k ±9%     | 298.1k ±8%         | 155.6k ±5% | 76.0k ±2%  | 269.6k ±7% | 239.0k ±6% | 303.8k ±8% |
| large record         | 72.0k ±7%   | 71.0k ±6%      | 70.6k ±7%          | 51.9k ±6%  | 23.9k ±3%  | 60.7k ±5%  | 67.4k ±7%  | —          |
| leaderboard          | 157.5k ±8%  | 155.8k ±8%     | 155.9k ±7%         | 93.5k ±4%  | 42.6k ±2%  | 130.8k ±8% | 94.0k ±6%  | 157.4k ±7% |
| tagged union         | 93.7k ±10%† | 93.7k ±8%      | 92.8k ±8%          | 43.8k ±4%  | 19.6k ±2%  | 84.0k ±7%  | 55.4k ±4%  | 92.3k ±9%  |

## Decode time per value

| Fixture              | surge    | surge (cursor) | surge (readChecks) | fbs     | serio   | flamework2 | blink   | baseline |
| -------------------- | -------- | -------------- | ------------------ | ------- | ------- | ---------- | ------- | -------- |
| deeply nested object | 0.39 µs  | 0.41 µs        | 0.42 µs            | 0.66 µs | 1.39 µs | 0.48 µs    | 0.63 µs | 0.38 µs  |
| nested arrays        | 3.34 µs  | 3.32 µs        | 3.35 µs            | 6.43 µs | 13.2 µs | 3.71 µs    | 4.18 µs | 3.29 µs  |
| large record         | 13.9 µs  | 14.1 µs        | 14.2 µs            | 19.3 µs | 41.9 µs | 16.5 µs    | 14.8 µs | —        |
| leaderboard          | 6.35 µs  | 6.42 µs        | 6.41 µs            | 10.7 µs | 23.5 µs | 7.65 µs    | 10.6 µs | 6.35 µs  |
| tagged union         | 10.7 µs† | 10.7 µs        | 10.8 µs            | 22.9 µs | 51.0 µs | 11.9 µs    | 18.0 µs | 10.8 µs  |

## Decode against surge

| Fixture              | surge (cursor) | surge (readChecks) | fbs    | serio  | flamework2 | blink  | baseline |
| -------------------- | -------------- | ------------------ | ------ | ------ | ---------- | ------ | -------- |
| deeply nested object | 0.95×          | 0.93×              | 0.59×  | 0.28×  | 0.81×      | 0.62×  | 1.01×    |
| nested arrays        | 1.01×          | 1.00×              | 0.52×  | 0.25×  | 0.90×      | 0.80×  | 1.02×    |
| large record         | 0.99×          | 0.98×              | 0.72×  | 0.33×  | 0.84×      | 0.94×  | —        |
| leaderboard          | 0.99×          | 0.99×              | 0.59×  | 0.27×  | 0.83×      | 0.60×  | 1.00×    |
| tagged union         | 1.00×†         | 0.99×†             | 0.47×† | 0.21×† | 0.90×†     | 0.59×† | 0.98×†   |
