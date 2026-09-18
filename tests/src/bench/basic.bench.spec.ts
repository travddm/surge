import { Fact } from "@rbxts/runit";
import { createBinarySerializer } from "@rbxts/surge";

interface SmallFlatStruct {
	a: number;
	b: number;
	flag: boolean;
}

const serializer = createBinarySerializer<SmallFlatStruct>();
const ITERATIONS = 100_000;

/**
 * Benchmarks live in their own top-level `src/bench/` root -- a sibling of
 * `src/tests/`, not nested inside it -- specifically so the Lune test
 * runner (see testing.md) never picks these up: it only points at
 * `script.tests`, and Roblox Studio (or `run-in-roblox`) remains the only
 * way to run this suite. A benchmark failing to compile/run is also never
 * confused with a correctness regression this way. Results are printed,
 * not recorded automatically -- read them from the runner's output during
 * a deliberate benchmarking pass and record them by hand (e.g. in a
 * checked-in benchmark log); nothing here fabricates a number.
 *
 * This suite has never been run: it requires an actual Roblox Studio
 * session connected to the `tests` place (see testing.md). It is not, by
 * itself, an `fbs`/hand-written baseline comparison yet -- see the
 * two-baseline plan in testing.md for what those rows still need to add.
 */
class SmallFlatStructBench {
	@Fact
	public serializeThroughput(): void {
		const value: SmallFlatStruct = { a: 1.5, b: -2.25, flag: true };
		const start = os.clock();
		for (let i = 0; i < ITERATIONS; i++) {
			serializer.serialize(value);
		}
		const elapsed = os.clock() - start;
		print(`surge serialize: ${ITERATIONS} iterations in ${elapsed}s (${ITERATIONS / elapsed} values/sec)`);
	}

	@Fact
	public deserializeThroughput(): void {
		const value: SmallFlatStruct = { a: 1.5, b: -2.25, flag: true };
		const { buffer, blobs } = serializer.serialize(value);
		const start = os.clock();
		for (let i = 0; i < ITERATIONS; i++) {
			serializer.deserialize(buffer, blobs);
		}
		const elapsed = os.clock() - start;
		print(`surge deserialize: ${ITERATIONS} iterations in ${elapsed}s (${ITERATIONS / elapsed} values/sec)`);
	}
}

export = SmallFlatStructBench;
