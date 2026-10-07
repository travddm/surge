//!optimize 2
import { Assert, Fact, InlineData, Theory } from "@rbxts/runit";
import { DataType, createCodec } from "@rbxts/surge";

import { Rng, difference } from "../support";

interface WithStrings {
	single: string;
	list: string[];
	byName: Map<string, string>;
}
const stringsSerializer = createCodec<WithStrings>();

// A `buffer` is encoded like a string: a u32 length, then the bytes.
interface WithBuffers {
	raw: buffer;
	rawOrText: buffer | string;
	maybeRaw?: buffer;
	list: buffer[];
}
const buffersSerializer = createCodec<WithBuffers>();

// Each element's size varies with its strings, so the array is sized by a loop
// over its elements ahead of the result (Transformer 5.20 in
// docs/specs/transformer.md).
interface WithNamedEntries {
	entries: Array<{ name: string; score: DataType.u32; title?: string }>;
}
const namedEntriesSerializer = createCodec<WithNamedEntries>();

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
		const buffer = stringsSerializer.serialize(value);
		Assert.equal(undefined, difference(value, stringsSerializer.deserialize(buffer)));
	}

	@Fact
	public prefixesAStringWithItsByteLengthNotItsCharacterCount(): void {
		const value: WithStrings = { single: "é", list: [], byName: new Map() };
		const buf = stringsSerializer.serialize(value);
		// Fields in name order: byName (u32 count), list (u32 count), single (u32 length + 2 bytes of UTF-8).
		Assert.equal(4 + 4 + 4 + 2, buffer.len(buf));
		Assert.equal(2, buffer.readu32(buf, 8));
	}

	@Fact
	public roundTripsBuffers(): void {
		const value: WithBuffers = {
			raw: buffer.create(0),
			rawOrText: buffer.fromstring("bytes\0"),
			list: [buffer.fromstring("a"), buffer.create(0)],
		};
		const buf = buffersSerializer.serialize(value);
		Assert.equal("buffer", typeOf(buf));
		const result = buffersSerializer.deserialize(buf);
		Assert.equal(undefined, difference(value, result));
		// A copy, not a view of the payload or the original.
		Assert.notEqual(value.rawOrText, result.rawOrText);
	}

	@Fact
	public roundTripsAnArrayOfObjectsThatHoldAString(): void {
		const rng = new Rng(16);
		for (const _ of $range(1, FUZZ_ITERATIONS)) {
			const entries = new Array<WithNamedEntries["entries"][number]>();
			let bytes = 4;
			for (const __ of $range(1, rng.int(0, 5))) {
				const entry = {
					name: rng.str(),
					score: rng.int(0, 4_294_967_295),
					title: rng.bool() ? rng.str() : undefined,
				};
				entries.push(entry);
				// The name's length and bytes, the score, the title's presence byte, and its length and bytes.
				bytes += 4 + entry.name.size() + 4 + 1 + (entry.title === undefined ? 0 : 4 + entry.title.size());
			}
			const value: WithNamedEntries = { entries };
			const buf = namedEntriesSerializer.serialize(value);
			Assert.equal(bytes, buffer.len(buf));
			Assert.equal(undefined, difference(value, namedEntriesSerializer.deserialize(buf)));
		}
	}

	@Fact
	public roundTripsRandomBuffers(): void {
		const rng = new Rng(15);
		for (const _ of $range(1, FUZZ_ITERATIONS)) {
			const value: WithBuffers = {
				raw: buffer.fromstring(rng.str(300)),
				rawOrText: rng.bool() ? buffer.fromstring(rng.str()) : rng.str(),
				maybeRaw: rng.bool() ? buffer.fromstring(rng.str()) : undefined,
				list: [buffer.fromstring(rng.str()), buffer.fromstring(rng.str())],
			};
			const buf = buffersSerializer.serialize(value);
			Assert.equal(undefined, difference(value, buffersSerializer.deserialize(buf)));
		}
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
			const buffer = stringsSerializer.serialize(value);
			Assert.equal(undefined, difference(value, stringsSerializer.deserialize(buffer)));
		}
	}
}

export = StringsTest;
