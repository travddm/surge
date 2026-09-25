//!optimize 2
import { Assert, Fact } from "@rbxts/runit";
import { DataType, createCodec } from "@rbxts/surge";

import { Rng, difference, hex, unhex } from "../support";

// The `readChecks` factory option (Transformer 5.10 in docs/specs/transformer.md): the
// read side stays inside the input buffer and rejects a count the rest of the
// input cannot hold. Every payload here is written by hand, because no
// `serialize` would produce one. And the `writeChecks` option (Transformer
// 5.14): `serialize` rejects a value whose length or count does not fit its
// type.

interface Flat {
	count: DataType.u32;
	flag: boolean;
}
const flat = createCodec<Flat>({ readChecks: true });
const flatUnchecked = createCodec<Flat>();

interface WithList {
	list: Array<DataType.f64>;
}
const list = createCodec<WithList>({ readChecks: true });

// A literal constant reads no bytes, so its count has nothing to bound it but
// the cap: this is the shape a short payload could otherwise turn into
// billions of loop iterations.
interface WithConstants {
	marks: Array<"x">;
}
const constants = createCodec<WithConstants>({ readChecks: true });

interface WithBlobs {
	first: unknown;
	second: unknown;
}
const blobs = createCodec<WithBlobs>({ readChecks: true });

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
const everything = createCodec<Everything>({ readChecks: true });

// A packed `CFrame`'s size is in its own header, and an enum index names one of
// a fixed list of items. Checks bound both before the value is read (Runtime
// API 4.2 and 4.9 in docs/specs/runtime-api.md).
interface WithPackedCFrame {
	placement: DataType.Packed<{ at: CFrame }>;
}
const packedCFrame = createCodec<WithPackedCFrame>({ readChecks: true });

interface WithEnum {
	material: Enum.Material;
}
const withEnum = createCodec<WithEnum>({ readChecks: true });

interface Exact {
	code: DataType.Length<string, 4>;
	triple: DataType.Length<Array<DataType.u8>, 3>;
	bytes: DataType.Length<buffer, 2>;
	slots: DataType.Length<Array<DataType.u8 | undefined>, 3>;
	marks: DataType.Length<Array<"a" | "b" | undefined>, 3>;
}
const exact = createCodec<Exact>({ writeChecks: true });

interface Narrow {
	list: DataType.Length<Array<DataType.u8>, DataType.u8>;
	text: DataType.Length<string, DataType.u8>;
	tags: DataType.Length<Map<string, boolean>, DataType.u8>;
}
const narrow = createCodec<Narrow>({ writeChecks: true });

// One field, so the element bytes after a wrapped count are left unread
// rather than misread as the next field.
interface NarrowList {
	list: DataType.Length<Array<DataType.u8>, DataType.u8>;
}
const narrowListUnchecked = createCodec<NarrowList>();

// `writeChecks` holds a number to its `Range` (Runtime API 3.10): outside the
// bounds, a NaN, and a fraction where the range holds whole numbers.
interface Ranged {
	health: DataType.Range<number, 0, 100>;
	offset: DataType.Range<DataType.i16, -1000, 1000>;
	ratio: DataType.Range<DataType.f32, 0, 1>;
}
const ranged = createCodec<Ranged>({ writeChecks: true });
const rangedUnchecked = createCodec<Ranged>();

function rangedValue(): Ranged {
	return { health: 100, offset: -1000, ratio: 0.5 };
}

function exactValue(): Exact {
	return { code: "abcd", triple: [1, 2, 3], bytes: buffer.create(2), slots: [1, 2, 3], marks: ["a", "b", "a"] };
}

function narrowValue(size: number): Narrow {
	const list = new Array<DataType.u8>();
	const tags = new Map<string, boolean>();
	for (const i of $range(1, size)) {
		list.push(1 as DataType.u8);
		tags.set(tostring(i), true);
	}
	return { list, text: "", tags };
}

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
		const bytes = flat.serialize(value);
		Assert.equal(hex(flatUnchecked.serialize(value)), hex(bytes));
		Assert.equal(7, flat.deserialize(bytes).count);
		const many: WithList = { list: [1, 2, 3] };
		Assert.equal(3, list.deserialize(list.serialize(many)).list.size());
		Assert.equal(0, list.deserialize(list.serialize({ list: [] })).list.size());
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
			const bytes = everything.serialize(value);
			Assert.equal(undefined, difference(value, everything.deserialize(bytes)));
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
		const bytes = everything.serialize(value);
		Assert.equal(undefined, difference(value, everything.deserialize(bytes)));
	}

	@Fact
	public rejectsATruncatedPayload(): void {
		const full = hex(flat.serialize({ count: 7, flag: true }));
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
	public rejectsATruncatedPackedCFrame(): void {
		// An arbitrary rotation away from the origin takes all 25 bytes.
		const value: WithPackedCFrame = { placement: { at: CFrame.Angles(0.1, 0.2, 0.3).add(new Vector3(1, 2, 3)) } };
		const full = hex(packedCFrame.serialize(value));
		Assert.equal(25 * 2, full.size());
		for (const bytes of $range(0, full.size() / 2 - 1)) {
			assertRejected(() => packedCFrame.deserialize(unhex(full.sub(1, bytes * 2))));
		}
		Assert.undefined(rejection(() => packedCFrame.deserialize(unhex(full))));
	}

	// Header 0x38 is rotation code 24, which names no rotation, at the origin;
	// 0x20 is rotation code 0 at the origin, the one-byte form.
	@Fact
	public rejectsAPackedRotationCodeThatNamesNoRotation(): void {
		assertRejected(() => packedCFrame.deserialize(unhex("38")));
		Assert.undefined(rejection(() => packedCFrame.deserialize(unhex("20"))));
	}

	// `Enum.Material` has far fewer than 255 items, so index 255 names none.
	@Fact
	public rejectsAnEnumIndexPastItsItems(): void {
		assertRejected(() => withEnum.deserialize(unhex("ff")));
		const written = withEnum.serialize({ material: Enum.Material.Plastic });
		Assert.equal(Enum.Material.Plastic, withEnum.deserialize(written).material);
	}

	@Fact
	public rejectsAnExactLengthValueOfAnyOtherLength(): void {
		Assert.undefined(rejection(() => exact.serialize(exactValue())));
		assertRejected(() => exact.serialize({ ...exactValue(), code: "abc" }));
		assertRejected(() => exact.serialize({ ...exactValue(), code: "abcde" }));
		assertRejected(() => exact.serialize({ ...exactValue(), triple: [1, 2] }));
		assertRejected(() => exact.serialize({ ...exactValue(), triple: [1, 2, 3, 4] }));
		assertRejected(() => exact.serialize({ ...exactValue(), bytes: buffer.create(3) }));
	}

	// An absent value is what a missing element writes, so an array of optionals,
	// or of a literal that includes `undefined`, may be shorter (Wire format
	// 6.6); only a longer one is rejected.
	@Fact
	public letsAnExactArrayOfOptionalsBeShorterButNotLonger(): void {
		Assert.undefined(rejection(() => exact.serialize({ ...exactValue(), slots: [1] })));
		assertRejected(() => exact.serialize({ ...exactValue(), slots: [1, 2, 3, 4] }));
		const written = exact.serialize({ ...exactValue(), marks: ["b"] });
		Assert.equal(1, exact.deserialize(written).marks.size());
		assertRejected(() => exact.serialize({ ...exactValue(), marks: ["a", "a", "a", "a"] }));
	}

	@Fact
	public rejectsACountPastItsWidth(): void {
		Assert.undefined(rejection(() => narrow.serialize(narrowValue(255))));
		assertRejected(() => narrow.serialize(narrowValue(256)));
		assertRejected(() => narrow.serialize({ ...narrowValue(0), text: string.rep("x", 256) }));
		const tags = new Map<string, boolean>();
		for (const i of $range(1, 256)) {
			tags.set(tostring(i), true);
		}
		assertRejected(() => narrow.serialize({ ...narrowValue(0), tags }));
	}

	// Unchecked, the count's write wraps it modulo its width, which is what
	// writeChecks exists to catch: 256 elements under a u8 count read back as none.
	@Fact
	public wrapsACountPastItsWidthWithoutWriteChecks(): void {
		const written = narrowListUnchecked.serialize({ list: narrowValue(256).list });
		Assert.equal(0, narrowListUnchecked.deserialize(written).list.size());
	}

	@Fact
	public rejectsANumberItsRangeDoesNotAdmit(): void {
		Assert.undefined(rejection(() => ranged.serialize(rangedValue())));
		Assert.undefined(rejection(() => ranged.serialize({ health: 0, offset: 1000, ratio: 0 })));
		assertRejected(() => ranged.serialize({ ...rangedValue(), health: 101 }));
		assertRejected(() => ranged.serialize({ ...rangedValue(), health: -1 }));
		assertRejected(() => ranged.serialize({ ...rangedValue(), health: 0 / 0 }));
		assertRejected(() => ranged.serialize({ ...rangedValue(), health: 50.5 }));
		assertRejected(() => ranged.serialize({ ...rangedValue(), offset: -1001 }));
		assertRejected(() => ranged.serialize({ ...rangedValue(), offset: 0.5 }));
		assertRejected(() => ranged.serialize({ ...rangedValue(), ratio: 1.5 }));
		assertRejected(() => ranged.serialize({ ...rangedValue(), ratio: 0 / 0 }));
		// A float width admits a fraction inside the range.
		Assert.undefined(rejection(() => ranged.serialize({ ...rangedValue(), ratio: 0.25 })));
	}

	// Unchecked, the value is written at its width, which wraps it (Wire
	// format 4.15): 300 under a range narrowed to u8 reads back as 44.
	@Fact
	public wrapsANumberOutsideItsRangeWithoutWriteChecks(): void {
		const written = rangedUnchecked.serialize({ ...rangedValue(), health: 300 });
		Assert.equal(44, rangedUnchecked.deserialize(written).health);
	}

	@Fact
	public rejectsAReadPastTheEndOfTheBlobs(): void {
		const value: WithBlobs = { first: "a", second: "b" };
		const { buffer: bytes, blobs: sent } = blobs.serialize(value);
		Assert.equal("a", blobs.deserialize({ buffer: bytes, blobs: sent }).first);
		assertRejected(() => blobs.deserialize({ buffer: bytes, blobs: [sent[0]] }));
	}

	// With `readChecks`, `deserialize` also takes `unknown`, so what a remote
	// delivered can be passed to it as it is, and anything but what `serialize`
	// returns for the type is rejected before it is read (Runtime API 3.14 and
	// 4.11 in docs/specs/runtime-api.md).
	@Fact
	public rejectsAnythingButABufferForAShapeWithNoBlob(): void {
		const bytes = flat.serialize({ count: 7, flag: true });
		assertRejected(() => flat.deserialize(undefined));
		for (const input of [7, "text", {}, { buffer: bytes, blobs: [] }]) {
			assertRejected(() => flat.deserialize(input));
		}
		Assert.equal(7, flat.deserialize(bytes).count);
	}

	@Fact
	public rejectsAnythingButItsTableForAShapeWithABlob(): void {
		const { buffer: bytes, blobs: sent } = blobs.serialize({ first: "a", second: "b" });
		assertRejected(() => blobs.deserialize(undefined));
		for (const input of [
			bytes,
			7,
			{},
			{ buffer: bytes },
			{ buffer: "text", blobs: sent },
			{ buffer: bytes, blobs: 7 },
		]) {
			assertRejected(() => blobs.deserialize(input));
		}
		Assert.equal("b", blobs.deserialize({ buffer: bytes, blobs: sent }).second);
	}
}

export = ChecksTest;
