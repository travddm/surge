import { TestRunner } from "@rbxts/runit";

/** Sentinel consumed by scripts/check-test-output.mjs to derive an exit code (see testing.md). */
const RESULT_PREFIX = "RUNIT_RESULT:";

function finish(summary: string): void {
	print(`${RESULT_PREFIX} ${summary}`);
}

/**
 * Runs the round-trip correctness suites (`src/tests/*.spec.ts`) only --
 * never `src/bench/`, which is a sibling root, not a descendant of this
 * one. Both Roblox Studio's `MainServer` script and the Lune test runner
 * call this same function, so there is exactly one reporter/sentinel
 * implementation to keep correct.
 */
export function main(): void {
	const testsRoot = script.WaitForChild("tests");
	new TestRunner(testsRoot)
		.run({
			colors: false,
			reporter: (results) => {
				print(results);
				const [ranText] = results.match("Ran%s*(%d+)%s*test");
				const [failedText] = results.match("Failed:%s*(%d+)%s*$");
				const ran = tonumber(ranText);
				const failed = tonumber(failedText);
				if (ran === undefined || failed === undefined) {
					finish("ERROR (could not parse the runit report)");
				} else if (ran === 0) {
					// Guards against a broken mount (an empty/misconfigured `tests`
					// folder) silently reporting PASSED with zero suites actually run.
					finish("ERROR (no suites ran)");
				} else {
					finish(failed > 0 ? "FAILED" : "PASSED");
				}
			},
		})
		.catch((err) => finish(`ERROR (${err})`));
}

/**
 * Runs the speed suite (`src/bench/speed.spec.ts`) -- Roblox Studio or
 * `run-in-roblox` only (`mise run bench:speed`), never the Lune test runner,
 * because only the real engine's timings count (see testing.md). The size
 * tier is not here: `scripts/lune-size-runner.luau` requires
 * `src/bench/size.ts` directly, so a broken fixture cannot fail this file's
 * round-trip entry point. Reads the `script` global, so it only works from
 * inside a running Script/ModuleScript, not from Studio's command bar (where
 * `script` is nil) -- invoke it via the disabled `MainBenchmarks` Script in
 * default.project.json: enable it and Play when doing a deliberate
 * benchmarking pass (see testing.md).
 */
export function runBenchmarks(): void {
	const benchRoot = script.WaitForChild("bench");
	new TestRunner(benchRoot).run({ colors: false });
}
