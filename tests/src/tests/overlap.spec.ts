//!optimize 2
import { Assert, Fact } from "@rbxts/runit";
import { DataType, createCodec } from "@rbxts/surge";

import { difference } from "../support";

// Runtime API 5.7 and 5.8 in docs/specs/runtime-api.md: a serializer runs code
// it did not generate only through a metamethod of a table it is given, and a
// call of a different serializer may run inside it. Neither type here has a
// blob field, so 5.5 does not apply.
//
// The other path 5.7 names, an `__iter` iterator that yields while another
// thread serializes, is not run here: Luau lets that iterator yield from
// release 0.736, and Lune 0.10.5 bundles Luau 0.709, where the yield raises.

interface Readings {
	values: Map<string, number>;
}

interface Label {
	name: string;
	id: DataType.u16;
}

const readings = createCodec<Readings>();
const label = createCodec<Label>();

const ENTRIES: ReadonlyArray<[string, number]> = [
	["a", 1],
	["b", 2.5],
	["c", -3],
];
const LABEL: Label = { name: "inner", id: 7 };

/**
 * A map of `entries` whose `__iter` calls `during` before it hands out each
 * entry. The generated `serialize` walks a dictionary with a generalized
 * `for`, so `during` runs inside it, once per entry. An array is walked by
 * index instead (Transformer 5.22 in docs/specs/transformer.md), which calls
 * no `__iter`.
 */
function iteratingWith(entries: ReadonlyArray<[string, number]>, during: () => void): Map<string, number> {
	const copy = new Map(entries);
	const metatable = {
		__iter: () => {
			let index = 0;
			return () => {
				index += 1;
				if (index > entries.size()) {
					return undefined;
				}
				during();
				const [key, value] = entries[index - 1];
				// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple -- a Luau iterator returns the key and the value as two values, not one table.
				return $tuple(key, value);
			};
		},
	};
	// `LuaMetatable` in `@rbxts/types` does not declare `__iter`.
	return setmetatable(copy, metatable as unknown as LuaMetatable<Map<string, number>>);
}

class OverlapTest {
	@Fact
	public runsAnotherSerializerInsideAnIterator(): void {
		const inner: buffer[] = [];
		const value: Readings = {
			values: iteratingWith(ENTRIES, () => {
				inner.push(label.serialize(LABEL));
			}),
		};
		const written = readings.serialize(value);

		Assert.equal(ENTRIES.size(), inner.size());
		// A dictionary's bytes follow its iteration order, so the value is
		// compared rather than the bytes.
		Assert.equal(undefined, difference({ values: new Map(ENTRIES) }, readings.deserialize(written)));
		for (const bytes of inner) {
			Assert.equal(undefined, difference(LABEL, label.deserialize(bytes)));
		}
	}
}

export = OverlapTest;
