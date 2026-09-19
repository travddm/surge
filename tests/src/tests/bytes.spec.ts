import { Assert, Fact } from "@rbxts/runit";
import { DataType, createBinarySerializer } from "@rbxts/surge";

import { hex } from "../support";

// Pins the exact bytes of shapes whose encoding is final, so a change to the
// wire format fails here and must be made on purpose. Each expected string is
// worked out from Type Coverage in transformer.md, not copied from the output.
// All integers and floats are little-endian. Not pinned, because an open
// future-work item changes their bytes: anything inside `Packed<T>` except
// booleans, and a union with an enum member.

// Declared out of name order: fields are written sorted by name.
interface Primitives {
	d: string;
	c: boolean;
	b: DataType.i16;
	a: DataType.u8;
}
const primitivesSerializer = createBinarySerializer<Primitives>();

interface Floats {
	double: number;
	single: DataType.f32;
}
const floatsSerializer = createBinarySerializer<Floats>();

interface Containers {
	list: DataType.u16[];
	pair: [DataType.u8, boolean, ...DataType.u8[]];
	record: Record<string, DataType.u8>;
}
const containersSerializer = createBinarySerializer<Containers>();

interface WithOptional {
	n?: DataType.u8;
}
const optionalSerializer = createBinarySerializer<WithOptional>();

interface Flags {
	a: boolean;
	b: boolean;
	c: boolean;
}
const flagsSerializer = createBinarySerializer<DataType.Packed<Flags>>();

interface Choices {
	direction: "north" | "east" | "south" | "west";
	rig: Enum.HumanoidRigType;
	version: 1;
}
const choicesSerializer = createBinarySerializer<Choices>();

type Shape = { kind: "circle"; radius: number } | { kind: "rect"; width: number; height: number };
const shapeSerializer = createBinarySerializer<Shape>();

type StringOrNumber = string | number;
const guardedSerializer = createBinarySerializer<StringOrNumber>();

interface Datatypes {
	tint: Color3;
	offset: Vector2;
	position: Vector3;
}
const datatypesSerializer = createBinarySerializer<Datatypes>();

// One fact per row of `FIXED_DATATYPES` in the transformer.
const vector3int16Serializer = createBinarySerializer<Vector3int16>();
const insetSerializer = createBinarySerializer<UDim>();
const sizeSerializer = createBinarySerializer<UDim2>();
const paintSerializer = createBinarySerializer<BrickColor>();
const spanSerializer = createBinarySerializer<NumberRange>();
const boundsSerializer = createBinarySerializer<Rect>();
const rawSerializer = createBinarySerializer<buffer>();
const sequencesSerializer = createBinarySerializer<{ colors: ColorSequence; numbers: NumberSequence }>();
const mediumSerializer = createBinarySerializer<{ signed: DataType.i24; unsigned: DataType.u24 }>();
const placementSerializer = createBinarySerializer<CFrame>();

class BytesTest {
	@Fact
	public pinsPrimitivesInNameOrder(): void {
		const { buffer } = primitivesSerializer.serialize({ a: 7, b: -2, c: true, d: "hi" });
		// a: u8 | b: i16 | c: bool | d: u32 length + bytes
		Assert.equal("07" + "feff" + "01" + "02000000" + "6869", hex(buffer));
	}

	@Fact
	public pinsFloats(): void {
		const { buffer } = floatsSerializer.serialize({ double: 1.5, single: 1.5 });
		// double: f64 0x3FF8000000000000 | single: f32 0x3FC00000
		Assert.equal("000000000000f83f" + "0000c03f", hex(buffer));
	}

	@Fact
	public pinsContainers(): void {
		// One record entry: the order of several entries is not specified.
		const { buffer } = containersSerializer.serialize({ list: [1, 258], pair: [9, true, 4, 5], record: { k: 3 } });
		const list = "02000000" + "0100" + "0201";
		// Fixed elements, then a u32 count of rest elements.
		const pair = "09" + "01" + "02000000" + "04" + "05";
		// u32 count, then key (u32 length + bytes) and value per entry.
		const record = "01000000" + "01000000" + "6b" + "03";
		Assert.equal(list + pair + record, hex(buffer));
	}

	@Fact
	public pinsAnOptional(): void {
		Assert.equal("01" + "05", hex(optionalSerializer.serialize({ n: 5 }).buffer));
		Assert.equal("00", hex(optionalSerializer.serialize({}).buffer));
	}

	@Fact
	public pinsPackedBooleans(): void {
		// Bit 0 is the first field in name order.
		Assert.equal("05", hex(flagsSerializer.serialize({ a: true, b: false, c: true }).buffer));
	}

	@Fact
	public pinsLiteralAndEnumIndexes(): void {
		const { buffer } = choicesSerializer.serialize({
			direction: "south",
			rig: Enum.HumanoidRigType.R6,
			version: 1,
		});
		// direction: index 2 of east, north, south, west | rig: index 1 of R15, R6 | version: no bytes
		Assert.equal("02" + "01", hex(buffer));
	}

	@Fact
	public pinsATaggedUnion(): void {
		const { buffer } = shapeSerializer.serialize({ kind: "rect", width: 2, height: 3 });
		// Variant 1 of circle, rect | height: f64 3 | width: f64 2. The tag itself is not written.
		Assert.equal("01" + "0000000000000840" + "0000000000000040", hex(buffer));
	}

	@Fact
	public pinsAGuardedUnion(): void {
		// Variants in `Field` kind order: num, str.
		Assert.equal("00" + "0000000000004540", hex(guardedSerializer.serialize(42).buffer));
		Assert.equal("01" + "02000000" + "6869", hex(guardedSerializer.serialize("hi").buffer));
	}

	@Fact
	public pinsFixedSizeDatatypes(): void {
		const { buffer } = datatypesSerializer.serialize({
			tint: Color3.fromRGB(255, 128, 0),
			offset: new Vector2(1, -2),
			position: new Vector3(0.5, 0, 2),
		});
		// offset: 2 x f32 | position: 3 x f32 | tint: 3 x u8
		const offset = "0000803f" + "000000c0";
		const position = "0000003f" + "00000000" + "00000040";
		Assert.equal(offset + position + "ff8000", hex(buffer));
	}

	@Fact
	public pinsVector3int16(): void {
		// 3 x i16
		Assert.equal(
			"0100" + "feff" + "0300",
			hex(vector3int16Serializer.serialize(new Vector3int16(1, -2, 3)).buffer),
		);
	}

	@Fact
	public pinsUDim(): void {
		// f32 scale + i32 offset
		Assert.equal("0000003f" + "f9ffffff", hex(insetSerializer.serialize(new UDim(0.5, -7)).buffer));
	}

	@Fact
	public pinsUDim2(): void {
		// 2 x UDim: f32 + i32 for X, then for Y
		Assert.equal(
			"0000003f" + "f9ffffff" + "0000803e" + "03000000",
			hex(sizeSerializer.serialize(new UDim2(0.5, -7, 0.25, 3)).buffer),
		);
	}

	@Fact
	public pinsBrickColor(): void {
		// u16 `.Number`
		Assert.equal("ec03", hex(paintSerializer.serialize(new BrickColor(1004)).buffer));
	}

	@Fact
	public pinsNumberRange(): void {
		// 2 x f32: Min, Max
		Assert.equal("0000803f" + "00002040", hex(spanSerializer.serialize(new NumberRange(1, 2.5)).buffer));
	}

	@Fact
	public pinsRect(): void {
		// 4 x f32: Min.X, Min.Y, Max.X, Max.Y
		Assert.equal(
			"00000000" + "000020c0" + "00000040" + "0000803f",
			hex(boundsSerializer.serialize(new Rect(0, -2.5, 2, 1)).buffer),
		);
	}

	@Fact
	public pinsABuffer(): void {
		// u32 length + bytes
		Assert.equal(
			"03000000" + "0102ff",
			hex(rawSerializer.serialize(buffer.fromstring(string.char(1, 2, 255))).buffer),
		);
	}

	@Fact
	public pinsSequences(): void {
		const { buffer } = sequencesSerializer.serialize({
			colors: new ColorSequence(Color3.fromRGB(255, 0, 128)),
			numbers: new NumberSequence([new NumberSequenceKeypoint(0, 2, 0.5), new NumberSequenceKeypoint(1, 0.5, 0)]),
		});
		// u8 count, then f32 time + 3 x u8 per keypoint. One color makes two keypoints, at 0 and 1.
		const colors = "02" + "00000000" + "ff0080" + "0000803f" + "ff0080";
		// u8 count, then f32 time + f32 value + f32 envelope per keypoint.
		const numbers = "02" + "00000000" + "00000040" + "0000003f" + "0000803f" + "0000003f" + "00000000";
		Assert.equal(colors + numbers, hex(buffer));
	}

	@Fact
	public pinsThe24BitWidths(): void {
		// signed: -2 in two's complement | unsigned: 0x010203, low byte first
		Assert.equal("feffff" + "030201", hex(mediumSerializer.serialize({ signed: -2, unsigned: 0x010203 }).buffer));
	}

	@Fact
	public pinsACFrameWithNoRotation(): void {
		// 3 x f32 position, then 3 x f32 axis * angle, which is zero with no
		// rotation. A rotation is not pinned: its axis-angle form is not exact.
		const position = "0000803f" + "00000040" + "00004040";
		Assert.equal(position + string.rep("00", 12), hex(placementSerializer.serialize(new CFrame(1, 2, 3)).buffer));
	}
}

export = BytesTest;
