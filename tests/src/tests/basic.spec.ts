//!optimize 2
import { Assert, Fact } from "@rbxts/runit";
import { DataType, createCodec } from "@rbxts/surge";

interface Basic {
	a: number;
	flag: boolean;
	name: string;
	nickname?: string;
}

const basicSerializer = createCodec<Basic>();

// A nested object of fixed-size fields, between two more: all of them share
// one reservation (Transformer 5.5).
interface Placed {
	id: DataType.u32;
	spot: { x: DataType.f64; y: DataType.i16 };
	tag: DataType.u8;
}

const placedSerializer = createCodec<Placed>();

/**
 * Covers primitives, a plain object, a nested object, and an optional field, serialized and
 * deserialized through the actual
 * `rbxts-transformer-surge` + `@rbxts/surge` pipeline.
 */
class BasicRoundTripTest {
	@Fact
	public roundTripsWithOptionalPresent(): void {
		const value: Basic = { a: 1.5, flag: true, name: "hello", nickname: "hi" };
		const buffer = basicSerializer.serialize(value);
		const result = basicSerializer.deserialize(buffer);
		Assert.equal(value.a, result.a);
		Assert.equal(value.flag, result.flag);
		Assert.equal(value.name, result.name);
		Assert.equal(value.nickname, result.nickname);
	}

	@Fact
	public roundTripsWithOptionalAbsent(): void {
		const value: Basic = { a: -2, flag: false, name: "" };
		const buffer = basicSerializer.serialize(value);
		const result = basicSerializer.deserialize(buffer);
		Assert.equal(value.a, result.a);
		Assert.equal(value.flag, result.flag);
		Assert.equal(value.name, result.name);
		Assert.undefined(result.nickname);
	}

	@Fact
	public roundTripsANestedObjectOfFixedSizeFields(): void {
		const value: Placed = { id: 70000, spot: { x: 1.25, y: -300 }, tag: 5 };
		const buf = placedSerializer.serialize(value);
		Assert.equal(15, buffer.len(buf));
		const result = placedSerializer.deserialize(buf);
		Assert.equal(value.id, result.id);
		Assert.equal(value.spot.x, result.spot.x);
		Assert.equal(value.spot.y, result.spot.y);
		Assert.equal(value.tag, result.tag);
	}
}

export = BasicRoundTripTest;
