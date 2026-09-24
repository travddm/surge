//!optimize 2
import { Assert, Fact } from "@rbxts/runit";
import { DataType, createBinarySerializer } from "@rbxts/surge";

import { Rng, difference, hex, unhex } from "../support";

// The `checks` factory option (Transformer 5.10 in docs/specs/transformer.md): the
// read side stays inside the input buffer and rejects a count the rest of the
// input cannot hold. Every payload here is written by hand, because no
// `serialize` would produce one.

interface Flat {
	count: DataType.u32;
	flag: boolean;
}
const flat = createBinarySerializer<Flat>({ checks: true });
const flatUnchecked = createBinarySerializer<Flat>();

interface WithList {
	list: Array<DataType.f64>;
}
const list = createBinarySerializer<WithList>({ checks: true });

// A literal constant reads no bytes, so its count has nothing to bound it but
// the cap: this is the shape a short payload could otherwise turn into
// billions of loop iterations.
interface WithConstants {
	marks: Array<"x">;
}
const constants = createBinarySerializer<WithConstants>({ checks: true });

interface WithBlobs {
	first: unknown;
	second: unknown;
}
const blobs = createBinarySerializer<WithBlobs>({ checks: true });

// Every kind that reads a count, each with an element whose own minimum is
// worth getting wrong: a bound that overstated any of them would reject a
// value `serialize` had just written.
interface Node {
	name: DataType.Length<string, DataType.u8>;
	children: Array<Node>;
}
interface Everything {
	bytes: buffer;
	labels: Map<string, Array<DataType.u8>>;
	marks: Set<string>;
	either: string | number;
	pair: [string, ...Array<DataType.u16>];
	maybeText?: string;
	packed: DataType.Packed<{ on: boolean; off: boolean; maybe?: DataType.u8 }>;
	tagged: { kind: "one"; value: DataType.u8 } | { kind: "two" } | { kind: "three"; text: string };
	tree: Node;
}
const everything = createBinarySerializer<Everything>({ checks: true });

/** The message of a `deserialize` that raised, or `undefined` if it returned. */
function rejection(run: () => unknown): string | undefined {
	const [ok, err] = pcall(run);
	if (ok) {
		return undefined;
	}
	return tostring(err);
}

function assertRejected(run: () => unknown): void {
	const message = rejection(run);
	Assert.defined(message);
	// Every check raises a string a caller can tell from a bug in their own code.
	Assert.true(message!.find("@rbxts/surge: ")[0] !== undefined);
}

class ChecksTest {
	// The checked path must accept everything the unchecked one does, or it is
	// rejecting valid input rather than malformed input.
	@Fact
	public acceptsWhatSerializeWrote(): void {
		const value: Flat = { count: 7, flag: true };
		const { buffer: bytes } = flat.serialize(value);
		Assert.equal(hex(flatUnchecked.serialize(value).buffer), hex(bytes));
		Assert.equal(7, flat.deserialize(bytes).count);
		const many: WithList = { list: [1, 2, 3] };
		Assert.equal(3, list.deserialize(list.serialize(many).buffer).list.size());
		Assert.equal(0, list.deserialize(list.serialize({ list: [] }).buffer).list.size());
	}

	// The bound of every count-carrying kind must be a true lower bound: one
	// byte too high on any of them and a value its own `serialize` wrote comes
	// back as a rejection.
	@Fact
	public acceptsEveryKindThatReadsACount(): void {
		const rng = new Rng(21);
		for (const _ of $range(1, 50)) {
			const labels = new Map<string, Array<number>>();
			for (const __ of $range(1, rng.int(0, 3))) {
				const counts = new Array<number>();
				for (const ___ of $range(1, rng.int(0, 3))) {
					counts.push(rng.int(0, 255));
				}
				labels.set(rng.str(), counts);
			}
			const marks = new Set<string>();
			for (const __ of $range(1, rng.int(0, 3))) {
				marks.add(rng.str());
			}
			const rest = new Array<number>();
			for (const __ of $range(1, rng.int(0, 3))) {
				rest.push(rng.int(0, 65535));
			}
			const leaf: Node = { name: rng.str(), children: [] };
			const value: Everything = {
				bytes: buffer.fromstring(rng.str()),
				labels,
				marks,
				either: rng.bool() ? rng.str() : rng.f64(),
				pair: [rng.str(), ...rest],
				maybeText: rng.bool() ? rng.str() : undefined,
				packed: { on: rng.bool(), off: rng.bool(), maybe: rng.bool() ? rng.int(0, 255) : undefined },
				tagged: rng.bool() ? { kind: "one", value: rng.int(0, 255) } : { kind: "three", text: rng.str() },
				tree: { name: rng.str(), children: rng.bool() ? [leaf] : [] },
			};
			const { buffer: bytes, blobs: sent } = everything.serialize(value);
			Assert.equal(undefined, difference(value, everything.deserialize(bytes, sent)));
		}
	}

	// A count of zero is the boundary the byte bound is compared at.
	@Fact
	public acceptsEmptyContainers(): void {
		const value: Everything = {
			bytes: buffer.create(0),
			labels: new Map(),
			marks: new Set(),
			either: "",
			pair: [""],
			packed: { on: false, off: false },
			tagged: { kind: "two" },
			tree: { name: "", children: [] },
		};
		const { buffer: bytes, blobs: sent } = everything.serialize(value);
		Assert.equal(undefined, difference(value, everything.deserialize(bytes, sent)));
	}

	@Fact
	public rejectsATruncatedPayload(): void {
		const full = hex(flat.serialize({ count: 7, flag: true }).buffer);
		// Every prefix short of the whole is a read past the end.
		for (const bytes of $range(0, full.size() / 2 - 1)) {
			assertRejected(() => flat.deserialize(unhex(full.sub(1, bytes * 2))));
		}
		Assert.undefined(rejection(() => flat.deserialize(unhex(full))));
	}

	// The count says a billion f64s; the payload has four bytes left.
	@Fact
	public rejectsACountTheInputCannotHold(): void {
		assertRejected(() => list.deserialize(unhex("ffffffff")));
		assertRejected(() => list.deserialize(unhex("0a000000" + "0000000000000000")));
	}

	// Nothing in the payload grows with the count, so only the cap stops it.
	@Fact
	public rejectsACountOfElementsThatReadNoBytes(): void {
		assertRejected(() => constants.deserialize(unhex("ffffffff")));
		// Just past the cap of 2^24, and just inside it.
		assertRejected(() => constants.deserialize(unhex("01000001")));
		Assert.equal(3, constants.deserialize(unhex("03000000")).marks.size());
	}

	@Fact
	public rejectsAReadPastTheEndOfTheBlobs(): void {
		const value: WithBlobs = { first: "a", second: "b" };
		const { buffer: bytes, blobs: sent } = blobs.serialize(value);
		Assert.equal("a", blobs.deserialize(bytes, sent).first);
		assertRejected(() => blobs.deserialize(bytes, [sent[0]]));
	}
}

export = ChecksTest;
