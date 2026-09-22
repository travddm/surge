import { TestRunner } from "@rbxts/runit";

/** Sentinel consumed by scripts/check-test-output.mjs to derive an exit code (see testing.md). */
const RESULT_PREFIX = "RUNIT_RESULT:";

/** The same contract for the speed tier, read by scripts/record-speed-benchmarks.mjs. */
const BENCH_RESULT_PREFIX = "BENCH_RESULT:";

/**
 * One `key=value` fact about the run, which the recorder copies into the
 * results file. The suite prints its own; this file knows the engine version.
 */
const BENCH_ENVIRONMENT_PREFIX = "BENCH_ENV:";

/** Turns runit's report into the one-line verdict a runner script reads. */
function summarize(results: string): string {
	const [ranText] = results.match("Ran%s*(%d+)%s*test");
	const [failedText] = results.match("Failed:%s*(%d+)%s*$");
	const ran = tonumber(ranText);
	const failed = tonumber(failedText);
	if (ran === undefined || failed === undefined) {
		return "ERROR (could not parse the runit report)";
	}
	// Guards against a broken mount (an empty/misconfigured folder) silently
	// reporting PASSED with zero suites actually run.
	if (ran === 0) {
		return "ERROR (no suites ran)";
	}
	return failed > 0 ? "FAILED" : "PASSED";
}

/** Runs one suite root and prints `prefix` with the verdict, whatever happens. */
function run(root: Instance, prefix: string): void {
	const finish = (summary: string): void => print(`${prefix} ${summary}`);
	new TestRunner(root)
		.run({
			colors: false,
			reporter: (results) => {
				print(results);
				finish(summarize(results));
			},
		})
		.catch((err) => finish(`ERROR (${err})`));
}

/**
 * Runs the round-trip correctness suites (`src/tests/*.spec.ts`) only --
 * never `src/bench/`, which is a sibling root, not a descendant of this
 * one. Both Roblox Studio's `MainServer` script and the Lune test runner
 * call this same function, so there is exactly one reporter/sentinel
 * implementation to keep correct.
 */
export function main(): void {
	run(script.WaitForChild("tests"), RESULT_PREFIX);
}

/**
 * Runs the speed suite (`src/bench/speed.spec.ts`) -- Roblox Studio or
 * `run-in-roblox` only (`mise run bench:speed`), never the Lune test runner,
 * because only the real engine's timings count (see testing.md). The size
 * tier is not here: `scripts/lune-size-runner.luau` requires
 * `src/bench/size.ts` directly, so a broken fixture cannot fail this file's
 * round-trip entry point. Reads the `script` global, so it only works from
 * inside a running Script/ModuleScript, not from Studio's command bar (where
 * `script` is nil) -- invoke it via `mise run bench:speed`, or through the
 * disabled `MainBenchmarks` Script in default.project.json: enable it and
 * Play when doing a deliberate benchmarking pass (see testing.md).
 *
 * The engine version goes out first because the recorder records the whole
 * environment a timing was taken in, and this is the part of it that only
 * the process itself knows.
 */
export function runBenchmarks(): void {
	print(`${BENCH_ENVIRONMENT_PREFIX} engine=${version()}`);
	run(script.WaitForChild("bench"), BENCH_RESULT_PREFIX);
}
