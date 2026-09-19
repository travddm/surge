import { Assert, Fact, InlineData, Theory } from "@rbxts/runit";
import { createBinarySerializer } from "@rbxts/surge";

import { Rng, difference } from "../support";

interface WithStrings {
	single: string;
	list: string[];
	byName: Map<string, string>;
}
const stringsSerializer = createBinarySerializer<WithStrings>();

const FUZZ_ITERATIONS = 100;

class StringsTest {
	@Theory
	@InlineData("")
	@InlineData("plain ascii")
	@InlineData("embedded\0zero\0")
	@InlineData("multibyte: é ∑ 日本語 🚀")
	public roundTripsAStringAloneAndInsideCollections(text: string): void {
		const value: WithStrings = {
			single: text,
			list: [text, "", text],
			byName: new Map([
				[text, ""],
				[`${text}!`, text],
			]),
		};
		const { buffer, blobs } = stringsSerializer.serialize(value);
		Assert.equal(undefined, difference(value, stringsSerializer.deserialize(buffer, blobs)));
	}

	@Fact
	public prefixesAStringWithItsByteLengthNotItsCharacterCount(): void {
		const value: WithStrings = { single: "é", list: [], byName: new Map() };
		const { buffer: buf } = stringsSerializer.serialize(value);
		// Fields in name order: byName (u32 count), list (u32 count), single (u32 length + 2 bytes of UTF-8).
		Assert.equal(4 + 4 + 4 + 2, buffer.len(buf));
		Assert.equal(2, buffer.readu32(buf, 8));
	}

	@Fact
	public roundTripsRandomByteStrings(): void {
		const rng = new Rng(3);
		for (const _ of $range(1, FUZZ_ITERATIONS)) {
			const byName = new Map<string, string>();
			for (const __ of $range(1, rng.int(0, 4))) {
				byName.set(rng.str(), rng.str());
			}
			const list = new Array<string>();
			for (const __ of $range(1, rng.int(0, 4))) {
				list.push(rng.str(40));
			}
			const value: WithStrings = { single: rng.str(300), list, byName };
			const { buffer, blobs } = stringsSerializer.serialize(value);
			Assert.equal(undefined, difference(value, stringsSerializer.deserialize(buffer, blobs)));
		}
	}
}

export = StringsTest;
