import { Fact } from "@rbxts/runit";

import type { Entry, Fixture } from "./adapter";
import { SIZE_ONLY } from "./adapter";
import { CATALOG } from "./catalog";

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
 * `BENCH_ROW: fixture | library | half | median | lowest | highest`, in
 * values per second; src/index.ts prints the closing `BENCH_RESULT:`, and
 * the recorder writes nothing without it.
 *
 * Nothing here may yield. runit starts every `@Fact` at once and awaits them
 * together with `Promise.all`, and `runBenchmarks` does not await the promise
 * `run()` returns, so one `task.wait` would both interleave the two halves
 * and let that function return -- closing Studio under `run-in-roblox` --
 * before the last row was measured. The engine's script-timeout watchdog does
 * not fire here, which is what makes that affordable: measured directly, a
 * 25-second loop that never yields runs to the end.
 */
const WARM_UP = 1_000;
const TRIALS = 5;
const ITERATIONS = 10_000;

/** The prefix one `key=value` fact about the run leaves by, for the recorder. */
const ENVIRONMENT_PREFIX = "BENCH_ENV:";

// Printed as the module loads, so it goes out once and before any row: it describes
// the suite rather than any one test, and it is what keeps the generated file from
// restating these three constants from memory.
print(
	`${ENVIRONMENT_PREFIX} method=the median of ${TRIALS} trials of ${ITERATIONS} calls, after ${WARM_UP} warm-up calls`,
);

interface Result {
	median: number;
	lowest: number;
	highest: number;
}

/** Values per second over `TRIALS` trials of `ITERATIONS` calls, after a warm-up. */
function measure(run: () => void): Result {
	for (const _ of $range(1, WARM_UP)) {
		run();
	}

	const rates = new Array<number>();
	for (const _ of $range(1, TRIALS)) {
		const start = os.clock();
		for (const _iteration of $range(1, ITERATIONS)) {
			run();
		}
		rates.push(ITERATIONS / (os.clock() - start));
	}
	rates.sort((left, right) => left < right);

	return {
		median: rates[math.floor(TRIALS / 2)],
		lowest: rates[0],
		highest: rates[TRIALS - 1],
	};
}

/** The prefix scripts/record-speed-benchmarks.mjs reads a row out of. */
const ROW_PREFIX = "BENCH_ROW:";

function report(half: string, fixture: Fixture, entry: Entry, result: Result): void {
	// Printed as each row is measured rather than collected for the end, so a
	// run that stops early still reports what it did measure. The recorder
	// writes no file for one of those, so the output is where those rows stay.
	print(
		string.format(
			"%s %s | %s | %s | %.0f | %.0f | %.0f",
			ROW_PREFIX,
			fixture.name,
			entry.library,
			half,
			result.median,
			result.lowest,
			result.highest,
		),
	);
}

class SpeedBench {
	@Fact
	public encodeThroughput(): void {
		for (const fixture of CATALOG) {
			for (const entry of fixture.entries) {
				if (SIZE_ONLY.includes(entry.library)) {
					continue;
				}
				report("encode", fixture, entry, measure(entry.encode));
			}
		}
	}

	@Fact
	public decodeThroughput(): void {
		for (const fixture of CATALOG) {
			for (const entry of fixture.entries) {
				if (SIZE_ONLY.includes(entry.library)) {
					continue;
				}
				report("decode", fixture, entry, measure(entry.decode));
			}
		}
	}
}

export = SpeedBench;
