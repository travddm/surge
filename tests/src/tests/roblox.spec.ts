//!optimize 2
import { Assert, Fact } from "@rbxts/runit";
import { DataType, createBinarySerializer } from "@rbxts/surge";

import { Rng, difference } from "../support";

interface WithSequences {
	colors: ColorSequence;
	numbers: NumberSequence;
}
const sequencesSerializer = createBinarySerializer<WithSequences>();

interface WithBlobs {
	anything: unknown;
	part: Instance;
	maybePart?: Part;
	count: number;
}
const blobsSerializer = createBinarySerializer<WithBlobs>();

// An `unknown` that is `undefined` used to push no blob, so every later blob
// was read one position early (Blob / passthrough channel in transformer.md).
interface WithAbsentUnknowns {
	first?: unknown;
	second: unknown;
	third: unknown;
	list: unknown[];
}
const absentUnknownsSerializer = createBinarySerializer<WithAbsentUnknowns>();

interface WithDatatypes {
	position: Vector3;
	offset: Vector2;
	tint: Color3;
	placement: CFrame;
	rig: Enum.HumanoidRigType;
	path: Vector3[];
	maybeTint?: Color3;
}
const datatypesSerializer = createBinarySerializer<WithDatatypes>();

// The datatypes of `FIXED_DATATYPES` in the transformer: a fixed list of numbers each.
interface WithFixedDatatypes {
	cell: Vector3int16;
	cellOrLabel: Vector3int16 | string;
	maybeCell?: Vector3int16;
	inset: UDim;
	insetOrLabel: UDim | string;
	size: UDim2;
	sizeOrLabel: UDim2 | string;
	paint: BrickColor;
	paintOrLabel: BrickColor | string;
	span: NumberRange;
	spanOrLabel: NumberRange | string;
	bounds: Rect;
	boundsOrLabel: Rect | string;
	// Not a union member: the Lune runner's `DateTime` is a stand-in that `typeof` reports as a table.
	stamp: DateTime;
}
const fixedDatatypesSerializer = createBinarySerializer<WithFixedDatatypes>();

// Per-component widths: a `Vector3`'s components and a `CFrame`'s position at
// a width of their own, wherever a brand has to survive being walked into --
// an array element, an optional, and a union member. `Cell` is a re-alias,
// which carries no brand alias, so its widths are read back out of the brand
// property; `i24` is the one width whose read side is not a single buffer
// call, but a u16 and a u8 folded back over the sign.
type Cell = DataType.Vector<DataType.i24, DataType.u8, DataType.i16>;

interface WithNarrowedComponents {
	cell: Cell;
	cellOrLabel: Cell | string;
	maybeCell?: Cell;
	placement: DataType.Transform<DataType.i16, DataType.u8, DataType.i16>;
	path: Array<DataType.Vector<DataType.u8>>;
}
const narrowedComponentsSerializer = createBinarySerializer<WithNarrowedComponents>();

const RIGS: ReadonlyArray<Enum.HumanoidRigType> = [Enum.HumanoidRigType.R6, Enum.HumanoidRigType.R15];

function randomVector3(rng: Rng): Vector3 {
	return new Vector3(rng.f32(), rng.f32(), rng.f32());
}

class RobloxTest {
	@Fact
	public roundTripsSequences(): void {
		// Every time, value, and envelope is exact in an f32, and every
		// channel is a multiple of 1/255.
		const value: WithSequences = {
			colors: new ColorSequence([
				new ColorSequenceKeypoint(0, new Color3(1, 0, 0)),
				new ColorSequenceKeypoint(0.5, new Color3(0, 1, 0)),
				new ColorSequenceKeypoint(1, new Color3(0, 0, 1)),
			]),
			numbers: new NumberSequence([
				new NumberSequenceKeypoint(0, 0.25, 0.125),
				new NumberSequenceKeypoint(1, 8, 0.5),
			]),
		};
		const { buffer: buf, blobs } = sequencesSerializer.serialize(value);
		// u8 count + 3 x (f32 time + 3 x u8), then u8 count + 2 x (f32 time + f32 value + f32 envelope).
		Assert.equal(1 + 3 * 7 + 1 + 2 * 12, buffer.len(buf));
		Assert.empty(blobs);
		const result = sequencesSerializer.deserialize(buf, blobs);
		Assert.equal(value.colors, result.colors);
		Assert.equal(value.numbers, result.numbers);
		// Asserted on its own, in case `==` on a sequence ignores the envelope.
		Assert.equal(0.125, result.numbers.Keypoints[0].Envelope);
		Assert.equal(0.5, result.numbers.Keypoints[1].Envelope);
	}

	@Fact
	public passesUnknownAndInstanceValuesThroughTheBlobChannel(): void {
		const anything = { nested: ["any", "shape"] };
		const part = new Instance("Part");
		const value: WithBlobs = { anything, part, maybePart: part, count: 3 };
		const { buffer: buf, blobs } = blobsSerializer.serialize(value);
		// `count`, and the presence bytes of `anything` and `maybePart`. A blob writes nothing into the buffer.
		Assert.equal(8 + 1 + 1, buffer.len(buf));
		Assert.equal(3, blobs.size());
		const result = blobsSerializer.deserialize(buf, blobs);
		// By identity: a blob is passed through, not copied.
		Assert.equal(anything, result.anything);
		Assert.equal(part, result.part);
		Assert.equal(part, result.maybePart);
		Assert.equal(3, result.count);
	}

	@Fact
	public keepsLaterBlobsInPlaceWhenAnUnknownIsUndefined(): void {
		const value: WithAbsentUnknowns = { second: undefined, third: "third", list: ["a", 2] };
		const { buffer: buf, blobs } = absentUnknownsSerializer.serialize(value);
		// Three presence bytes, then the u32 count and one presence byte per element of `list`.
		Assert.equal(3 + 4 + 2, buffer.len(buf));
		Assert.equal(3, blobs.size());
		Assert.equal(undefined, difference(value, absentUnknownsSerializer.deserialize(buf, blobs)));
	}

	@Fact
	public writesNoBlobForAnAbsentOptionalBlob(): void {
		const value: WithBlobs = { anything: "text", part: new Instance("Part"), count: 0 };
		const { buffer, blobs } = blobsSerializer.serialize(value);
		Assert.equal(2, blobs.size());
		Assert.undefined(blobsSerializer.deserialize(buffer, blobs).maybePart);
	}

	@Fact
	public roundTripsRandomDatatypes(): void {
		const rng = new Rng(11);
		for (const _ of $range(1, 100)) {
			const path = new Array<Vector3>();
			for (const __ of $range(1, rng.int(0, 4))) {
				path.push(randomVector3(rng));
			}
			const value: WithDatatypes = {
				position: randomVector3(rng),
				offset: new Vector2(rng.f32(), rng.f32()),
				tint: Color3.fromRGB(rng.int(0, 255), rng.int(0, 255), rng.int(0, 255)),
				// Translation only: a rotation does not survive the axis-angle encoding bit for bit.
				placement: new CFrame(randomVector3(rng)),
				rig: rng.pick(RIGS),
				path,
				maybeTint: rng.bool() ? Color3.fromRGB(rng.int(0, 255), 0, 255) : undefined,
			};
			const { buffer, blobs } = datatypesSerializer.serialize(value);
			Assert.equal(undefined, difference(value, datatypesSerializer.deserialize(buffer, blobs)));
		}
	}

	@Fact
	public roundTripsRandomFixedDatatypes(): void {
		const rng = new Rng(14);
		for (const _ of $range(1, 100)) {
			const cell = new Vector3int16(rng.int(-32768, 32767), rng.int(-32768, 32767), rng.int(-32768, 32767));
			const inset = new UDim(rng.f32(), rng.int(-2147483648, 2147483647));
			const size = new UDim2(
				rng.f32(),
				rng.int(-2147483648, 2147483647),
				rng.f32(),
				rng.int(-2147483648, 2147483647),
			);
			const paint = new BrickColor(rng.pick([1, 21, 194, 1004, 1032]));
			const span = new NumberRange(-rng.int(0, 1000) / 8, rng.int(0, 1000) / 8);
			const bounds = new Rect(rng.f32(), rng.f32(), rng.f32(), rng.f32());
			const stamp = DateTime.fromUnixTimestampMillis(rng.int(0, 4102444800000));
			const value: WithFixedDatatypes = {
				cell,
				cellOrLabel: rng.bool() ? cell : rng.str(),
				maybeCell: rng.bool() ? cell : undefined,
				stamp,
				bounds,
				boundsOrLabel: rng.bool() ? bounds : rng.str(),
				span,
				spanOrLabel: rng.bool() ? span : rng.str(),
				paint,
				paintOrLabel: rng.bool() ? paint : rng.str(),
				size,
				sizeOrLabel: rng.bool() ? size : rng.str(),
				inset,
				insetOrLabel: rng.bool() ? inset : rng.str(),
			};
			const { buffer, blobs } = fixedDatatypesSerializer.serialize(value);
			Assert.empty(blobs);
			Assert.equal(undefined, difference(value, fixedDatatypesSerializer.deserialize(buffer, blobs)));
		}
	}

	// Every component is a whole number inside the width that holds it, so a
	// narrowed value comes back exactly. What a component outside its width
	// does is a write-side contract, documented on `DataType.Vector`, and not
	// something a round trip can show.
	@Fact
	public roundTripsNarrowedComponents(): void {
		const rng = new Rng(15);
		for (const _ of $range(1, 100)) {
			const cell = new Vector3(rng.int(-8388608, 8388607), rng.int(0, 255), rng.int(-32768, 32767));
			const path = new Array<Vector3>();
			for (const __ of $range(1, rng.int(0, 4))) {
				path.push(new Vector3(rng.int(0, 255), rng.int(0, 255), rng.int(0, 255)));
			}
			const value: WithNarrowedComponents = {
				cell,
				cellOrLabel: rng.bool() ? cell : rng.str(),
				maybeCell: rng.bool() ? cell : undefined,
				// Translation only: a rotation does not survive the axis-angle encoding bit for bit.
				placement: new CFrame(rng.int(-32768, 32767), rng.int(0, 255), rng.int(-32768, 32767)),
				path,
			};
			const { buffer, blobs } = narrowedComponentsSerializer.serialize(value);
			Assert.empty(blobs);
			Assert.equal(undefined, difference(value, narrowedComponentsSerializer.deserialize(buffer, blobs)));
		}
	}

	@Fact
	public roundTripsACFrameRotationWithinF32Precision(): void {
		const rng = new Rng(12);
		for (const _ of $range(1, 100)) {
			const placement = CFrame.Angles(rng.next() * 6 - 3, rng.next() * 6 - 3, rng.next() * 6 - 3).add(
				randomVector3(rng),
			);
			const value: WithDatatypes = {
				position: Vector3.zero,
				offset: Vector2.zero,
				tint: new Color3(),
				placement,
				rig: Enum.HumanoidRigType.R6,
				path: [],
			};
			const { buffer, blobs } = datatypesSerializer.serialize(value);
			const result = datatypesSerializer.deserialize(buffer, blobs).placement;
			const expectedComponents = [...placement.GetComponents()];
			const actualComponents = [...result.GetComponents()];
			for (const i of $range(0, 11)) {
				Assert.fuzzyEqual(expectedComponents[i], actualComponents[i], 0.0001);
			}
		}
	}
}

export = RobloxTest;
