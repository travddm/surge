import { Assert, Fact } from "@rbxts/runit";

import { difference } from "../support";

// Every other suite asserts `difference(...) === undefined`, so a `difference`
// that reports nothing would pass them all.
class SupportTest {
	@Fact
	public reportsNoDifferenceForEqualValues(): void {
		const value = { list: [1, "a", true], map: new Map([["k", { x: 0 / 0 }]]), set: new Set([1]) };
		const copy = { list: [1, "a", true], map: new Map([["k", { x: 0 / 0 }]]), set: new Set([1]) };
		Assert.undefined(difference(value, copy));
	}

	@Fact
	public reportsAChangedMissingOrExtraEntry(): void {
		Assert.defined(difference({ a: [1, 2] }, { a: [1, 3] }));
		Assert.defined(difference({ a: 1, b: 2 }, { a: 1 }));
		Assert.defined(difference({ a: 1 }, { a: 1, b: 2 }));
		Assert.defined(difference([1], ["1"]));
	}

	@Fact
	public comparesBuffersByTheirBytes(): void {
		Assert.undefined(difference(buffer.fromstring("ab"), buffer.fromstring("ab")));
		Assert.defined(difference(buffer.fromstring("ab"), buffer.fromstring("ac")));
		Assert.defined(difference(buffer.fromstring("ab"), buffer.fromstring("abc")));
	}

	@Fact
	public readsANativeVectorAsTheVector3ItIsInRoblox(): void {
		// Lune keeps the two types apart; serio decodes every vector field into a
		// native one, so the benchmark harness compares across the split.
		const native = vector.create(1, 2, 3) as unknown;
		Assert.undefined(difference(new Vector3(1, 2, 3), native));
		Assert.defined(difference(new Vector3(1, 2, 4), native));
	}

	@Fact
	public tellsZeroFromNegativeZero(): void {
		Assert.defined(difference(0, -0));
		Assert.undefined(difference(-0, -0));
	}
}

export = SupportTest;
