import { Assert, Fact, InlineData, Theory } from "@rbxts/runit";
import { DataType, createBinarySerializer } from "@rbxts/surge";

import { Rng, difference } from "../support";

interface Integers {
	u8: DataType.u8;
	u16: DataType.u16;
	u32: DataType.u32;
	i8: DataType.i8;
	i16: DataType.i16;
	i32: DataType.i32;
	u24: DataType.u24;
	i24: DataType.i24;
}
const integersSerializer = createBinarySerializer<Integers>();

interface Floats {
	single: DataType.f32;
	double: DataType.f64;
	plain: number;
}
const floatsSerializer = createBinarySerializer<Floats>();

const FUZZ_ITERATIONS = 200;

class NumbersTest {
	// The bounds of each width. A value outside its width is not covered: the
	// design states no result for it.
	@Theory
	@InlineData(0, 0, 0, 0, 0, 0, 0, 0)
	@InlineData(255, 65535, 4294967295, 127, 32767, 2147483647, 16777215, 8388607)
	@InlineData(1, 256, 65536, -128, -32768, -2147483648, 65536, -8388608)
	@InlineData(1, 1, 1, -1, -1, -1, 65535, -1)
	public roundTripsIntegerWidthsAtTheirBounds(
		u8: number,
		u16: number,
		u32: number,
		i8: number,
		i16: number,
		i32: number,
		u24: number,
		i24: number,
	): void {
		const value: Integers = { u8, u16, u32, i8, i16, i32, u24, i24 };
		const { buffer: buf, blobs } = integersSerializer.serialize(value);
		Assert.equal(1 + 2 + 4 + 1 + 2 + 4 + 3 + 3, buffer.len(buf));
		Assert.equal(undefined, difference(value, integersSerializer.deserialize(buf, blobs)));
	}

	@Theory
	@InlineData(0)
	@InlineData(-0)
	@InlineData(0 / 0)
	@InlineData(math.huge)
	@InlineData(-math.huge)
	@InlineData(0.5)
	@InlineData(-16777216)
	public roundTripsFloatEdgeValues(edge: number): void {
		const value: Floats = { single: edge, double: edge, plain: edge };
		const { buffer: buf, blobs } = floatsSerializer.serialize(value);
		Assert.equal(4 + 8 + 8, buffer.len(buf));
		Assert.equal(undefined, difference(value, floatsSerializer.deserialize(buf, blobs)));
	}

	@Fact
	public keepsFullDoublePrecisionForAPlainNumber(): void {
		const value: Floats = { single: 0, double: 0.1, plain: 2 ** 53 - 1 };
		const { buffer: buf, blobs } = floatsSerializer.serialize(value);
		Assert.equal(undefined, difference(value, floatsSerializer.deserialize(buf, blobs)));
	}

	@Fact
	public roundTripsRandomIntegers(): void {
		const rng = new Rng(1);
		for (const _ of $range(1, FUZZ_ITERATIONS)) {
			const value: Integers = {
				u8: rng.int(0, 255),
				u16: rng.int(0, 65535),
				u32: rng.int(0, 4294967295),
				i8: rng.int(-128, 127),
				i16: rng.int(-32768, 32767),
				i32: rng.int(-2147483648, 2147483647),
				u24: rng.int(0, 16777215),
				i24: rng.int(-8388608, 8388607),
			};
			const { buffer: buf, blobs } = integersSerializer.serialize(value);
			Assert.equal(undefined, difference(value, integersSerializer.deserialize(buf, blobs)));
		}
	}

	@Fact
	public roundTripsRandomFloats(): void {
		const rng = new Rng(2);
		for (const _ of $range(1, FUZZ_ITERATIONS)) {
			const value: Floats = { single: rng.f32(), double: rng.f64(), plain: rng.f64() };
			const { buffer: buf, blobs } = floatsSerializer.serialize(value);
			Assert.equal(undefined, difference(value, floatsSerializer.deserialize(buf, blobs)));
		}
	}
}

export = NumbersTest;
