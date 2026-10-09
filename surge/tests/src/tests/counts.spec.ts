//!optimize 2
import { Assert, Fact } from "@rbxts/runit";
import { DataType, createCodec } from "@rbxts/surge";

import { countBytes, difference } from "../support";

// Round trips of each kind that writes an unbranded count, at the edges of
// Wire format 6.9: the last one-byte count, the first and the last count of
// the u16 form, and the first of the u32 form. The set keeps the shape on the
// scratch buffer, whose count is reserved before the entries are counted
// (Transformer 5.6), and the shape without it is sized exactly (Transformer
// 5.20). Each is read with and without readChecks.
interface Counted {
	bytes: buffer;
	list: Array<DataType.u8>;
	rest: [DataType.u8, ...Array<DataType.u8>];
	set: Set<DataType.u16>;
	text: string;
}
type Sized = Omit<Counted, "set">;

const counted = createCodec<Counted>();
const countedChecked = createCodec<Counted>({ readChecks: true });
const sized = createCodec<Sized>();
const sizedChecked = createCodec<Sized>({ readChecks: true });

const EDGES = [253, 254, 65535, 65536];

function countedOf(count: number): Counted {
	const list = new Array<number>(count, 7);
	const rest: [number, ...Array<number>] = [9];
	for (const _ of $range(1, count)) {
		rest.push(5);
	}
	const set = new Set<number>();
	for (const i of $range(0, count - 1)) {
		set.add(i);
	}
	return { bytes: buffer.create(count), list, rest, set, text: string.rep("a", count) };
}

class CountsTest {
	@Fact
	public roundTripsEachKindAtTheEdgesOfTheLongForms(): void {
		for (const count of EDGES) {
			const value = countedOf(count);
			const head = countBytes(count);
			for (const codec of [counted, countedChecked]) {
				const buf = codec.serialize(value);
				// Five counts of `count`: the buffer's bytes, the list's and the
				// rest's elements after one fixed element, the set's u16s, and
				// the string's bytes.
				Assert.equal(5 * head + count + count + 1 + count + 2 * count + count, buffer.len(buf));
				Assert.equal(undefined, difference(value, codec.deserialize(buf)));
			}
			const without: Sized = { bytes: value.bytes, list: value.list, rest: value.rest, text: value.text };
			for (const codec of [sized, sizedChecked]) {
				const buf = codec.serialize(without);
				Assert.equal(4 * head + count + count + 1 + count + count, buffer.len(buf));
				Assert.equal(undefined, difference(without, codec.deserialize(buf)));
			}
		}
	}
}

export = CountsTest;
