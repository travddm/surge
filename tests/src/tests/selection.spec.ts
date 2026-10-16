//!optimize 2
import { Assert, Fact } from "@rbxts/runit";

import type { Entry, Fixture, Library } from "../bench/adapter";
import { keptEntries } from "../bench/selection";

/** Every column a row may have, as the suite's `timedColumns` would list them. */
const KNOWN: ReadonlyArray<Library> = [
	"surge",
	"surge (cursor)",
	"surge (readChecks)",
	"fbs",
	"serio",
	"flamework2",
	"blink",
	"baseline",
];

/** A row with an entry per column in `libraries`, whose halves do nothing. */
function row(libraries: ReadonlyArray<Library>): Fixture {
	return {
		name: "row",
		note: "",
		entries: libraries.map((library): Entry => ({
			library,
			measure: () => ({ bytes: 0, side: 0, roundTrip: undefined, maxError: 0 }),
			encode: () => {},
			decode: () => {},
		})),
	};
}

/** The columns `keptEntries` keeps of `fixture`, in order, joined for one comparison. */
function kept(fixture: Fixture, columns: ReadonlyArray<string> | undefined): string {
	return keptEntries(fixture, fixture.entries, columns, KNOWN)
		.map((entry) => entry.library)
		.join(", ");
}

/** Whether `keptEntries` stops on `fixture` with `columns`, rather than return what it keeps. */
function stops(fixture: Fixture, columns: ReadonlyArray<string>): boolean {
	const [ok] = pcall(() => keptEntries(fixture, fixture.entries, columns, KNOWN));
	return !ok;
}

// A scoped run's columns decide which cells a paper is read from, and its
// controls are what the paper reads drift against (Benchmark harness 9.3 in
// docs/specs/benchmark-harness.md).
class SelectionTest {
	@Fact
	public keepsEveryColumnWhereNoneIsNamed(): void {
		const fixture = row(["surge", "surge (cursor)", "fbs", "serio", "flamework2"]);
		Assert.equal("surge, surge (cursor), fbs, serio, flamework2", kept(fixture, undefined));
	}

	@Fact
	public keepsSurgeAndTheBaselineBesideTheColumnsNamed(): void {
		const fixture = row(["surge", "surge (cursor)", "fbs", "serio", "flamework2", "baseline"]);
		Assert.equal("surge, fbs, serio, baseline", kept(fixture, ["fbs", "serio"]));
	}

	@Fact
	public namesAColumnByItsLettersAndDigits(): void {
		const fixture = row(["surge", "surge (cursor)", "surge (readChecks)", "fbs", "serio"]);
		Assert.equal("surge, surge (cursor), fbs, serio", kept(fixture, ["surgecursor", "FBS", "serio"]));
	}

	@Fact
	public stopsWhereTheColumnsKeptLeaveARowOneControl(): void {
		Assert.true(stops(row(["surge", "fbs", "serio", "flamework2"]), ["fbs"]));
		Assert.true(stops(row(["surge", "fbs", "serio"]), ["surgecursor"]));
	}

	@Fact
	public countsTheBaselineAmongTheControls(): void {
		Assert.equal("surge, fbs, baseline", kept(row(["surge", "fbs", "serio", "baseline"]), ["fbs"]));
		Assert.true(stops(row(["surge", "fbs", "serio", "baseline"]), ["surgecursor"]));
	}

	@Fact
	public keepsTheOneControlOfARowThatHasOne(): void {
		Assert.equal("surge, fbs", kept(row(["surge", "surge (cursor)", "fbs"]), ["fbs"]));
		Assert.true(stops(row(["surge", "surge (cursor)", "fbs"]), ["surgecursor"]));
	}

	@Fact
	public stopsOnANameThatIsNoColumn(): void {
		Assert.true(stops(row(["surge", "fbs", "serio"]), ["fbs", "serio", "squash"]));
	}
}

export = SelectionTest;
