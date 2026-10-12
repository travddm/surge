//!optimize 2
import type { Entry, Fixture, Library } from "./adapter";
import { CONTROLS } from "./adapter";

/**
 * Which fixtures a run measures, for `mise run bench:size:only` and
 * `mise run bench:speed:only`. Both tiers scope by this one rule, so a
 * pattern that selects three rows of the size table selects the same three
 * rows of the speed table.
 *
 * A pattern matches a fixture whose name contains it, after both are
 * lowercased and stripped of everything that is not a letter or a digit. The
 * catalog's names carry spaces, colons, and parentheses -- `CFrame array
 * (packed, arbitrary)` -- and a mise task argument does not reliably reach
 * the task with its quoting intact, so a pattern has to be one word. On
 * Windows a quoted `large array` arrives as two arguments; stripping is what
 * lets that one word be `largearray` or `large-array` and select the row it
 * would have.
 */
function normalize(text: string): string {
	const [stripped] = text.lower().gsub("[^%w]", "");
	return stripped;
}

/**
 * The fixtures of `catalog` that `patterns` selects, in catalog order, or all
 * of them when `patterns` is empty.
 *
 * Throws on a pattern that matches nothing instead of measuring the rest. A
 * scoped run is read against the recorded file by eye, so a mistyped name
 * that quietly dropped a row would be read as a result about the rows left.
 */
export function matching(catalog: ReadonlyArray<Fixture>, patterns: ReadonlyArray<string>): ReadonlyArray<Fixture> {
	if (patterns.size() === 0) {
		return catalog;
	}

	const names = catalog.map((fixture) => normalize(fixture.name));
	const wanted = new Set<number>();

	for (const pattern of patterns) {
		const normalized = normalize(pattern);
		// A pattern of punctuation alone normalizes to the empty string, which
		// every name contains: it would select the whole catalog rather than
		// report that it selected nothing.
		if (normalized === "") {
			throw `The fixture pattern "${pattern}" has no letters or digits to match on.`;
		}

		let found = false;
		for (let index = 0; index < names.size(); index++) {
			const [start] = names[index].find(normalized, 1, true);
			if (start !== undefined) {
				wanted.add(index);
				found = true;
			}
		}

		if (!found) {
			throw `No benchmark fixture matches "${pattern}". The catalog holds: ${catalog
				.map((fixture) => fixture.name)
				.join(", ")}.`;
		}
	}

	return catalog.filter((_, index) => wanted.has(index));
}

/** One half of a cell: what the speed suite times. */
export type Half = "encode" | "decode";

/**
 * What a speed run measures (Benchmark harness 9 in
 * docs/specs/benchmark-harness.md). Each field left out measures all of its
 * kind.
 */
export interface Scope {
	/** Patterns that select rows, as {@link matching} reads them. */
	readonly fixtures?: ReadonlyArray<string>;
	/** The columns to keep beside surge's and the baseline's, by name, as {@link keptEntries} reads them. */
	readonly columns?: ReadonlyArray<string>;
	/** The halves to time. */
	readonly halves?: ReadonlyArray<Half>;
}

/** The columns a scoped run keeps on every row it selects. */
const ALWAYS_KEPT: ReadonlyArray<Library> = ["surge", "baseline"];

/**
 * The entries of `fixture` a run times: all of them, or, where `columns`
 * names some, surge's, the baseline's and the ones it names. surge's is kept
 * because every ratio divides by it, and the baseline's because it is what
 * surge's code is read against. A name matches a column whose name, with case
 * and everything that is not a letter or a digit removed, is the same, so
 * `surgereadchecks` names `surge (readChecks)`.
 *
 * Throws where a name matches no column of the row's catalog, and where the
 * columns kept leave a row fewer than two controls of the ones it has: a
 * change is read against how far its row's controls moved, and one control
 * cannot say how far one moves on its own.
 */
export function keptEntries(
	fixture: Fixture,
	entries: ReadonlyArray<Entry>,
	columns: ReadonlyArray<string> | undefined,
	known: ReadonlyArray<Library>,
): ReadonlyArray<Entry> {
	if (columns === undefined) {
		return entries;
	}
	const named = new Set<string>();
	for (const column of columns) {
		const normalized = normalize(column);
		if (!known.some((library) => normalize(library) === normalized)) {
			throw `No benchmark column is named "${column}". The columns are: ${known.join(", ")}.`;
		}
		named.add(normalized);
	}

	const kept = entries.filter((entry) => ALWAYS_KEPT.includes(entry.library) || named.has(normalize(entry.library)));
	const controls = (list: ReadonlyArray<Entry>) => list.filter((entry) => CONTROLS.includes(entry.library)).size();
	const needed = math.min(2, controls(entries));
	if (controls(kept) < needed) {
		throw `The columns kept leave "${fixture.name}" ${controls(kept)} of its ${controls(entries)} controls, where a scoped run keeps at least ${needed}.`;
	}
	return kept;
}

let scoped: Scope = {};

/**
 * Narrows what the speed suite measures. Called before the run starts, by
 * `runBenchmarks` in src/index.ts.
 *
 * Module state rather than an argument because @rbxts/runit instantiates the
 * suite itself and a `@Fact` takes no parameters, so `runBenchmarks` has no
 * other way to reach it. It holds the patterns and not the fixtures they
 * select so that this module never imports the catalog: src/index.ts sets it,
 * and src/index.ts has to stay loadable when a fixture module is broken --
 * that is what keeps a broken fixture from failing the round-trip suite.
 */
export function scopeTo(scope: Scope): void {
	scoped = scope;
}

/** The row patterns `scopeTo` was last given; empty for a run over the whole catalog. */
export function scopedPatterns(): ReadonlyArray<string> {
	return scoped.fixtures ?? [];
}

/** The column names `scopeTo` was last given; `undefined` for every column. */
export function scopedColumns(): ReadonlyArray<string> | undefined {
	return scoped.columns;
}

/** The halves `scopeTo` was last given, or both. */
export function scopedHalves(): ReadonlyArray<Half> {
	return scoped.halves ?? ["encode", "decode"];
}
