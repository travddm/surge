//!optimize 2
import { Assert, Fact, InlineData, Theory } from "@rbxts/runit";
import { DataType, createCodec } from "@rbxts/surge";

import { Rng, countBytes, difference } from "../support";

interface WithStrings {
	single: string;
	list: string[];
	byName: Map<string, string>;
}
const stringsSerializer = createCodec<WithStrings>();

// A `buffer` is encoded like a string: a count of its bytes, then the bytes.
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

// A string or a buffer reserves the fixed-size properties beside it, before
// or after it, with its own bytes in its count's one-byte form, and on their
// own beside its long form (Transformer 5.19 in docs/specs/transformer.md).
// `WithJoinedRuns` is sized exactly, and `WithJoinedRunsInMaps` keeps the
// scratch buffer. Properties are written in the order of their names, so
// each `atHead` is written first, where the cursor's position is known and
// folded (Transformer 5.30): a string then a run, and a run then a string,
// with the first of the two at that position.
interface RunAfterFirst {
	label: string;
	level: DataType.u16;
	marks: DataType.u8[];
	rank: DataType.u8;
	title: string;
}
interface RunBeforeFirst {
	level: DataType.u8;
	motto: string;
	ranks: DataType.u8[];
	tag: string;
	tier: DataType.u16;
}
interface JoinedEntry {
	name: string;
	score: DataType.u32;
	userId: DataType.f64;
}
type JoinedEvent = { kind: "chat"; id: DataType.u32; text: string } | { kind: "ping"; id: DataType.u32 };
interface WithJoinedRuns {
	entries: JoinedEntry[];
	events: JoinedEvent[];
	blob: { bytes: DataType.Length<buffer, DataType.u16>; tag: DataType.u8 };
	atHead: RunAfterFirst;
}
interface WithJoinedRunsInMaps {
	byName: Map<string, DataType.u8>;
	notes: Map<DataType.u16, string>;
	byId: Map<DataType.u16, JoinedEvent>;
	entries: JoinedEntry[];
	atHead: RunBeforeFirst;
}
const joinedSerializer = createCodec<WithJoinedRuns>();
const joinedCheckedSerializer = createCodec<WithJoinedRuns>({ readChecks: true });
const joinedInMapsSerializer = createCodec<WithJoinedRunsInMaps>();
const joinedInMapsCheckedSerializer = createCodec<WithJoinedRunsInMaps>({ readChecks: true });

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
		// Fields in name order: byName (count), list (count), single (count + 2 bytes of UTF-8), each
		// count one byte.
		Assert.equal(1 + 1 + 1 + 2, buffer.len(buf));
		Assert.equal(2, buffer.readu8(buf, 2));
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
			let bytes = 0;
			for (const __ of $range(1, rng.int(0, 5))) {
				const entry = {
					name: rng.str(),
					score: rng.int(0, 4_294_967_295),
					title: rng.bool() ? rng.str() : undefined,
				};
				entries.push(entry);
				// The name's count and bytes, the score, the title's presence byte, and its count and bytes.
				bytes +=
					countBytes(entry.name.size()) +
					entry.name.size() +
					4 +
					1 +
					(entry.title === undefined ? 0 : countBytes(entry.title.size()) + entry.title.size());
			}
			bytes += countBytes(entries.size());
			const value: WithNamedEntries = { entries };
			const buf = namedEntriesSerializer.serialize(value);
			Assert.equal(bytes, buffer.len(buf));
			Assert.equal(undefined, difference(value, namedEntriesSerializer.deserialize(buf)));
		}
	}

	// 253 is the longest count of one byte, and 254 the shortest of the long form.
	@Theory
	@InlineData(0)
	@InlineData(253)
	@InlineData(254)
	@InlineData(300)
	public roundTripsAStringJoinedWithTheRunBesideIt(length: number): void {
		const text = string.rep("x", length);
		const value: WithJoinedRuns = {
			entries: [
				{ name: text, score: 7, userId: 1.5 },
				{ name: "", score: 4_294_967_295, userId: -2 },
			],
			events: [
				{ kind: "chat", id: 9, text },
				{ kind: "ping", id: 10 },
				{ kind: "chat", id: 11, text: "" },
			],
			blob: { bytes: buffer.fromstring(text), tag: 200 },
			atHead: { label: text, level: 65_535, marks: [1, 2], rank: 3, title: text },
		};
		const inMaps: WithJoinedRunsInMaps = {
			byName: new Map([
				[text, 1],
				[`${text}!`, 2],
			]),
			notes: new Map([
				[1, text],
				[2, ""],
			]),
			byId: new Map([
				[3, { kind: "chat", id: 12, text }],
				[4, { kind: "ping", id: 13 }],
			]),
			entries: value.entries,
			atHead: { level: 255, motto: text, ranks: [4], tag: text, tier: 65_535 },
		};
		for (const serializer of [joinedSerializer, joinedCheckedSerializer]) {
			Assert.equal(undefined, difference(value, serializer.deserialize(serializer.serialize(value))));
		}
		for (const serializer of [joinedInMapsSerializer, joinedInMapsCheckedSerializer]) {
			Assert.equal(undefined, difference(inMaps, serializer.deserialize(serializer.serialize(inMaps))));
		}
	}

	@Fact
	public roundTripsRandomStringsJoinedWithTheRunBesideThem(): void {
		const rng = new Rng(17);
		for (const _ of $range(1, FUZZ_ITERATIONS)) {
			const entries = new Array<JoinedEntry>();
			const events = new Array<JoinedEvent>();
			const byName = new Map<string, number>();
			const notes = new Map<number, string>();
			const byId = new Map<number, JoinedEvent>();
			for (const __ of $range(1, rng.int(0, 4))) {
				entries.push({ name: rng.str(300), score: rng.int(0, 4_294_967_295), userId: rng.int(-100, 100) });
				events.push(
					rng.bool()
						? { kind: "chat", id: rng.int(0, 99), text: rng.str(300) }
						: { kind: "ping", id: rng.int(0, 99) },
				);
				byName.set(rng.str(300), rng.int(0, 255));
				notes.set(rng.int(0, 65535), rng.str(300));
				byId.set(rng.int(0, 65535), { kind: "chat", id: rng.int(0, 99), text: rng.str(300) });
			}
			const value: WithJoinedRuns = {
				entries,
				events,
				blob: { bytes: buffer.fromstring(rng.str(300)), tag: rng.int(0, 255) },
				atHead: {
					label: rng.str(300),
					level: rng.int(0, 65535),
					marks: [],
					rank: rng.int(0, 255),
					title: rng.str(300),
				},
			};
			const inMaps: WithJoinedRunsInMaps = {
				byName,
				notes,
				byId,
				entries,
				atHead: {
					level: rng.int(0, 255),
					motto: rng.str(300),
					ranks: [],
					tag: rng.str(300),
					tier: rng.int(0, 65535),
				},
			};
			for (const serializer of [joinedSerializer, joinedCheckedSerializer]) {
				Assert.equal(undefined, difference(value, serializer.deserialize(serializer.serialize(value))));
			}
			for (const serializer of [joinedInMapsSerializer, joinedInMapsCheckedSerializer]) {
				Assert.equal(undefined, difference(inMaps, serializer.deserialize(serializer.serialize(inMaps))));
			}
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
