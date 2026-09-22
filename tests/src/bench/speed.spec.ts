import { Fact } from "@rbxts/runit";

import type { Entry, Fixture } from "./adapter";
import { CATALOG } from "./catalog";

/**
 * Tier 2 of docs/future-work/benchmark-tooling.md: encode and decode values
 * per second, over the same catalog the size run measures, one line per
 * fixture and library. Real Roblox only
 * (`mise run bench:speed`, or the disabled `MainBenchmarks` Script in
 * default.project.json): a timing from Lune is not evidence about the engine
 * this project claims to be fast on, which is why the Lune runner never
 * reaches this suite -- it lives under `src/bench/`, not `src/tests/`.
 *
 * Results are printed, not recorded automatically. Read them from the
 * runner's output during a deliberate benchmarking pass and copy them into
 * `docs/benchmarks/speed.md` with the machine, the date, and the commit.
 *
 * As of this suite's own commit it compiles and type-checks but has never
 * been run: that needs a Roblox Studio process.
 */
const WARM_UP = 1_000;
const TRIALS = 5;
const ITERATIONS = 10_000;

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

function report(half: string, fixture: Fixture, entry: Entry, result: Result): void {
	print(
		string.format(
			"%s [%s] %s: %.0f values/sec (median of %d x %d; %.0f to %.0f)",
			fixture.name,
			entry.library,
			half,
			result.median,
			TRIALS,
			ITERATIONS,
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
				report("encode", fixture, entry, measure(entry.encode));
			}
		}
	}

	@Fact
	public decodeThroughput(): void {
		for (const fixture of CATALOG) {
			for (const entry of fixture.entries) {
				report("decode", fixture, entry, measure(entry.decode));
			}
		}
	}
}

export = SpeedBench;
