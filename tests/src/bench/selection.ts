//!optimize 2
import type { Fixture } from "./adapter";

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

let scoped: ReadonlyArray<string> = [];

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
export function scopeTo(patterns: ReadonlyArray<string>): void {
	scoped = patterns;
}

/** The patterns `scopeTo` was last given; empty for a run over the whole catalog. */
export function scopedPatterns(): ReadonlyArray<string> {
	return scoped;
}
