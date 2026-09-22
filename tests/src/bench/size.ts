import { CATALOG } from "./catalog";

/** One row of `docs/benchmarks/size.md`. */
export interface SizeRow {
	name: string;
	note: string;
	bytes: number;
	side: number;
	/** `"exact"`, or `"inexact"` when the decoded value differs from the input. */
	roundTrip: string;
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
export function collectSizeRows(): Array<SizeRow> {
	const rows = new Array<SizeRow>();
	for (const fixture of CATALOG) {
		const measurement = fixture.measure();
		if (measurement.roundTrip !== undefined) {
			// The detail stays out of the table, which has to be stable enough to
			// diff, but a row that does not round-trip has to say why somewhere.
			print(`${fixture.name}: ${measurement.roundTrip}`);
		}
		rows.push({
			name: fixture.name,
			note: fixture.note,
			bytes: measurement.bytes,
			side: measurement.side,
			roundTrip: measurement.roundTrip === undefined ? "exact" : "inexact",
		});
	}
	return rows;
}
