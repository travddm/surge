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

interface Readings {
	values: number[];
}

interface Label {
	name: string;
	id: DataType.u16;
}

const readings = createCodec<Readings>();
const label = createCodec<Label>();

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

class OverlapTest {
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
