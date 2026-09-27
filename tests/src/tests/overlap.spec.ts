//!optimize 2
import { Assert, Fact } from "@rbxts/runit";
import { DataType, createCodec } from "@rbxts/surge";

import { difference, hex } from "../support";

// Runtime API 5.7 and 5.8 in docs/specs/runtime-api.md: a serializer runs code
// it did not generate only through a metamethod of a table it is given, and a
// call of a different serializer may run inside it. Neither type here has a
// blob field, so 5.5 does not apply.
//
// The other path 5.7 names, an `__iter` iterator that yields while another
// thread serializes, is not run here: Luau lets that iterator yield from
// release 0.736, and Lune 0.10.5 bundles Luau 0.709, where the yield raises.
//
// Runtime API 5.9: a `serialize` sized ahead of its write iterates a
// dictionary twice, once for the size and once for the write.

interface Readings {
	values: number[];
}

interface Label {
	name: string;
	id: DataType.u16;
}

interface Scores {
	byName: Map<string, number>;
}

const readings = createCodec<Readings>();
const label = createCodec<Label>();
const scores = createCodec<Scores>();

const VALUES: ReadonlyArray<number> = [1, 2.5, -3];
const LABEL: Label = { name: "inner", id: 7 };

/**
 * A copy of `items` whose `__iter` calls `during` before it hands out each
 * element. The generated `serialize` walks an array with a generalized `for`,
 * so `during` runs inside it, once per element.
 */
function iteratingWith(items: ReadonlyArray<number>, during: () => void): number[] {
	const copy = [...items];
	const metatable = {
		__iter: () => {
			let index = 0;
			return () => {
				index += 1;
				if (index > copy.size()) {
					return undefined;
				}
				during();
				// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple -- a Luau iterator returns the index and the value as two values, not one table.
				return $tuple(index, copy[index - 1]);
			};
		},
	};
	// `LuaMetatable` in `@rbxts/types` does not declare `__iter`.
	return setmetatable(copy, metatable as unknown as LuaMetatable<number[]>);
}

/** A map of `entries` whose `__iter` calls `during` each time an iteration starts. */
function countingIterations(entries: ReadonlyArray<[string, number]>, during: () => void): Map<string, number> {
	const copy = new Map(entries);
	const metatable = {
		__iter: () => {
			during();
			// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple -- `__iter` returns the iterator function and the table as two values, not one table.
			return $tuple(next, copy);
		},
	};
	// `LuaMetatable` in `@rbxts/types` does not declare `__iter`.
	return setmetatable(copy, metatable as unknown as LuaMetatable<Map<string, number>>);
}

class OverlapTest {
	@Fact
	public iteratesADictionaryOnceForItsSizeAndOnceForItsWrite(): void {
		const entries: ReadonlyArray<[string, number]> = [
			["a", 1],
			["bb", 2.5],
		];
		let iterations = 0;
		const written = scores.serialize({ byName: countingIterations(entries, () => iterations++) });

		Assert.equal(2, iterations);
		Assert.equal(undefined, difference({ byName: new Map(entries) }, scores.deserialize(written)));
	}

	@Fact
	public runsAnotherSerializerInsideAnIterator(): void {
		const inner: buffer[] = [];
		const value: Readings = {
			values: iteratingWith(VALUES, () => {
				inner.push(label.serialize(LABEL));
			}),
		};
		const written = readings.serialize(value);

		Assert.equal(VALUES.size(), inner.size());
		Assert.equal(hex(readings.serialize({ values: [...VALUES] })), hex(written));
		for (const bytes of inner) {
			Assert.equal(undefined, difference(LABEL, label.deserialize(bytes)));
		}
	}
}

export = OverlapTest;
