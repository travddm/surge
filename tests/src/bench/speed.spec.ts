//!optimize 2
import { Fact } from "@rbxts/runit";

import type { Entry, Fixture } from "./adapter";
import { SIZE_ONLY } from "./adapter";
import { CATALOG } from "./catalog";
import { matching, scopedPatterns } from "./selection";

/**
 * Tier 2 of docs/future-work/benchmark-tooling.md: encode and decode values
 * per second, over the same catalog the size run measures, one line per
 * fixture and library. Real Roblox only (`mise run bench:speed`, or the
 * disabled `MainBenchmarks` Script in default.project.json): a timing from
 * Lune is not evidence about the engine this project claims to be fast on,
 * which is why the Lune runner never reaches this suite -- it lives under
 * `src/bench/`, not `src/tests/`.
 *
 * A Roblox process cannot write a file, so the results leave as printed
 * lines and scripts/record-speed-benchmarks.mjs turns them into
 * `docs/benchmarks/speed.md`. Each line is
 * `BENCH_ROW: fixture | library | half | rate rate ...`, one rate in values
 * per second per trial, in the order the trials ran; the recorder sorts
 * and summarizes them, so the statistic is defined once, there.
 * src/index.ts prints the closing `BENCH_RESULT:`, and the recorder writes
 * nothing without it.
 *
 * The catalog is narrowed per fact rather than once at module scope because a
 * pattern that matches nothing throws: raised inside a fact it is one failed
 * test with its message, and raised at module scope it would break runit's
 * discovery instead.
 *
 * A trial is a length of time, not a number of calls. It used to be 10,000
 * calls, which is five milliseconds on a row that runs at two million values
 * a second, and every cell whose trial was under ten milliseconds spread by
 * more than 10% -- most by more than 100%, with one trial two or three times
 * faster than the median, the shape of a periodic cost of a few milliseconds
 * that most short trials carry and one slips between. Those were the flat
 * struct, the nested object, the wide struct, and the toggles: the rows the
 * hand-written baseline exists to be read against. A trial now runs chunks
 * of calls until `TRIAL_SECONDS` of measured time have passed and reports
 * calls over time, so a fast row gets hundreds of thousands of calls per
 * trial and the periodic cost averages in, and a slow row keeps roughly what
 * it had. The warm-up is time-based for the same reason: a thousand calls is
 * a quarter of a millisecond on a fast row.
 *
 * Within a fixture, the libraries take turns: every library is warmed up,
 * then trial one runs for each library in turn, then trial two, and so on.
 * A drift over the row -- the process slowing as it heats, the collector
 * catching up -- then lands on every column alike instead of on whichever
 * library ran last, which is what makes a ratio between two columns of the
 * same row a fair one. Between rows the loop yields `SETTLE_FRAMES` frames
 * with no work in them, so the collector can catch up on the previous row's
 * garbage before the next row's warm-up starts, and a row's first trials do
 * not pay for the row before it.
 *
 * The loops yield, on purpose. `run-in-roblox` calls the injected script on
 * its own plugin thread and does not report the run finished until that
 * call returns, so a suite that never yielded held that thread for the whole
 * catalog -- about thirteen minutes by the earlier speed-trials.tsv -- with
 * no frame in between. Studio raised its "plugin has stopped responding"
 * prompt over that, which is how it was noticed, but the prompt is not the
 * damage. About ten seconds in, every path that allocates per call slows by
 * close to an order of magnitude and stays slow for the rest of the run,
 * which is most of the catalog. docs/research/frame-starvation.md reports
 * the A/B that establishes it, what it cost each cell, and why the mechanism
 * behind it is not established.
 *
 * Yielding once per row or per trial would not be enough: in that slow mode
 * a cell spends up to ninety seconds on one row and seventeen on one trial.
 * So every call is timed inside a chunk of `CHUNK` calls, a trial's time is
 * the sum of its chunks, and the loop yields between two chunks once
 * `YIELD_AFTER` seconds of measured work have gone by since it last did. The
 * yield is never inside a timed chunk. A row fast enough to finish a trial
 * inside the budget never yields mid-trial and pays only the two clock reads
 * per chunk.
 *
 * Because the loops yield, the two halves are one `@Fact`: runit starts
 * every fact at once and awaits them together with `Promise.all`, and two
 * facts would interleave at every yield. And `runBenchmarks` waits for the
 * run to settle before it returns, or the injected script would hand
 * control back -- closing Studio under `run-in-roblox` -- before the last
 * row was measured.
 */
/** Seconds of measured calls each library gets before a row's trials begin. */
const WARM_UP_SECONDS = 0.1;
/** Trials per cell. Odd, so that one run's median is a trial and not an average. */
const TRIALS = 9;
/**
 * Seconds of measured calls a trial runs for, at least: the trial ends at
 * the first chunk boundary past it, so a slow row's trial is one chunk.
 */
const TRIAL_SECONDS = 0.2;
/**
 * Calls between two clock reads. Small enough that the slowest cell in
 * speed-trials.tsv (about 600 calls a second) finishes a chunk well inside
 * a second, so the yield the budget below asks for is never far away; large
 * enough that the fastest cell (millions a second) spends a fraction of a
 * percent of a chunk on the clock reads around it.
 */
const CHUNK = 250;
/** Frames yielded, idle, between one row and the next. */
const SETTLE_FRAMES = 3;
/**
 * Seconds of measured work after which the loop yields between chunks. The
 * slow mode described above set in after roughly ten seconds without a
 * frame; a quarter second stays far from that and costs a run one frame per
 * quarter second of measurement.
 */
const YIELD_AFTER = 0.25;

/** The prefix one `key=value` fact about the run leaves by, for the recorder. */
const ENVIRONMENT_PREFIX = "BENCH_ENV:";

// Printed as the module loads, so it goes out once and before any row: it describes
// the suite rather than any one test, and it is what keeps the generated file from
// restating these constants from memory.
print(
	`${ENVIRONMENT_PREFIX} method=${TRIALS} trials per cell, each at least ${TRIAL_SECONDS} seconds of calls after ${WARM_UP_SECONDS} seconds of warm-up calls, timed in chunks of ${CHUNK} calls so that the yields between chunks are not in the time; within a row the libraries take turns, one trial each, and ${SETTLE_FRAMES} idle frames separate one row from the next`,
);

/** Measured seconds since the loop last yielded; shared by every row, since the budget is. */
let sinceYield = 0;

/** Runs `CHUNK` calls and returns the seconds they took; yields afterwards once the budget is spent. */
function chunk(run: () => void): number {
	const start = os.clock();
	for (const _ of $range(1, CHUNK)) {
		run();
	}
	const elapsed = os.clock() - start;

	sinceYield += elapsed;
	if (sinceYield >= YIELD_AFTER) {
		sinceYield = 0;
		task.wait();
	}
	return elapsed;
}

function warmUp(run: () => void): void {
	let elapsed = 0;
	while (elapsed < WARM_UP_SECONDS) {
		elapsed += chunk(run);
	}
}

/** Idle frames between rows; the yield budget starts over, since nothing measured has run. */
function settle(): void {
	for (const _ of $range(1, SETTLE_FRAMES)) {
		task.wait();
	}
	sinceYield = 0;
}

/** One trial: values per second over at least `TRIAL_SECONDS` of calls. */
function trial(run: () => void): number {
	let elapsed = 0;
	let calls = 0;
	while (elapsed < TRIAL_SECONDS) {
		elapsed += chunk(run);
		calls += CHUNK;
	}
	return calls / elapsed;
}

/** The prefix scripts/record-speed-benchmarks.mjs reads a row out of. */
const ROW_PREFIX = "BENCH_ROW:";

function report(half: string, fixture: Fixture, entry: Entry, rates: ReadonlyArray<number>): void {
	// Printed as each row is measured rather than collected for the end, so a
	// run that stops early still reports what it did measure. The recorder
	// writes no file for one of those, so the output is where those rows stay.
	print(
		string.format(
			"%s %s | %s | %s | %s",
			ROW_PREFIX,
			fixture.name,
			entry.library,
			half,
			rates.map((rate) => string.format("%.0f", rate)).join(" "),
		),
	);
}

class SpeedBench {
	@Fact
	public throughput(): void {
		for (const half of ["encode", "decode"] as const) {
			for (const fixture of matching(CATALOG, scopedPatterns())) {
				const entries = fixture.entries.filter((entry) => !SIZE_ONLY.includes(entry.library));
				const rates = entries.map(() => new Array<number>());

				for (const entry of entries) {
					warmUp(entry[half]);
				}
				for (const _ of $range(1, TRIALS)) {
					entries.forEach((entry, index) => rates[index].push(trial(entry[half])));
				}
				entries.forEach((entry, index) => report(half, fixture, entry, rates[index]));
				settle();
			}
		}
	}
}

export = SpeedBench;
