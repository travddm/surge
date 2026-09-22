import type { Library } from "./adapter";
import { LIBRARIES } from "./adapter";
import { CATALOG } from "./catalog";

/** One library's cell of one row of `docs/benchmarks/size.md`. */
export interface SizeCell {
	library: Library;
	bytes: number;
	side: number;
	/** `"exact"`, or `"inexact"` when the decoded value differs from the input. */
	roundTrip: string;
	/** The worst component the round trip moved, or -1 where no number describes the difference. */
	maxError: number;
}

/** One row of `docs/benchmarks/size.md`: one shape across every library. */
export interface SizeRow {
	name: string;
	note: string;
	/** One cell per entry of `libraries`, in that order. */
	cells: Array<SizeCell>;
}

/** What `scripts/lune-size-runner.luau` renders: the column order, then the rows. */
export interface SizeResult {
	libraries: Array<Library>;
	rows: Array<SizeRow>;
}

/**
 * Tier 1 of docs/future-work/benchmark-tooling.md: bytes per value, which is
 * deterministic and therefore worth recording from Lune rather than from a
 * real Roblox process. `scripts/lune-size-runner.luau` calls this and writes
 * the table; nothing here prints a number it did not measure.
 *
 * Not a `.spec` module: it returns rows instead of asserting, so @rbxts/runit
 * never picks it up (its discovery takes ModuleScripts whose name ends in
 * `.spec`).
 */
export function collectSizeRows(): SizeResult {
	const rows = new Array<SizeRow>();
	for (const fixture of CATALOG) {
		const cells = new Array<SizeCell>();
		for (const library of LIBRARIES) {
			const entry = fixture.entries.find((candidate) => candidate.library === library);
			if (entry === undefined) {
				// Every row is declared for every library with an adapter, so a
				// gap is a mistake in the fixture module, not a result.
				error(`${fixture.name}: no ${library} entry`);
			}

			const measurement = entry.measure();
			if (measurement.roundTrip !== undefined) {
				// The detail stays out of the table, which has to be stable enough
				// to diff, but a row that does not round-trip has to say why
				// somewhere.
				print(`${fixture.name} (${library}): ${measurement.roundTrip}`);
			}
			cells.push({
				library,
				bytes: measurement.bytes,
				side: measurement.side,
				roundTrip: measurement.roundTrip === undefined ? "exact" : "inexact",
				// A nil field is simply absent from the Luau table the runner reads,
				// so a difference no number describes travels as -1 rather than as
				// `undefined`.
				maxError: measurement.maxError ?? -1,
			});
		}
		rows.push({ name: fixture.name, note: fixture.note, cells });
	}
	return { libraries: [...LIBRARIES], rows };
}
