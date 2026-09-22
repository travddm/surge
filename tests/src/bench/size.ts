//!optimize 2
import type { Library } from "./adapter";
import { LIBRARIES } from "./adapter";
import { CATALOG } from "./catalog";
import { matching } from "./selection";

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
	/**
	 * One cell per library that can express the row, in `libraries` order. A
	 * library with no cell has no entry for the row -- Blink has no Roblox
	 * `EnumItem`, no guarded union, and no `Packed<T>` -- and the runner
	 * renders that as an empty cell. The cells are an array rather than one
	 * slot per library because a Luau array cannot hold a hole.
	 */
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
 * `patterns` narrows the catalog to the rows a scoped run asked for (see
 * selection.ts); empty measures all of them.
 *
 * Not a `.spec` module: it returns rows instead of asserting, so @rbxts/runit
 * never picks it up (its discovery takes ModuleScripts whose name ends in
 * `.spec`).
 */
export function collectSizeRows(patterns: ReadonlyArray<string>): SizeResult {
	const rows = new Array<SizeRow>();
	for (const fixture of matching(CATALOG, patterns)) {
		const cells = new Array<SizeCell>();
		for (const library of LIBRARIES) {
			const entry = fixture.entries.find((candidate) => candidate.library === library);
			if (entry === undefined) {
				continue;
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
