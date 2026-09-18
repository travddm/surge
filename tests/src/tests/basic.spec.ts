import { Assert, Fact } from "@rbxts/runit";
import { createBinarySerializer } from "@rbxts/surge";

interface Basic {
	a: number;
	flag: boolean;
	name: string;
	nickname?: string;
}

const basicSerializer = createBinarySerializer<Basic>();

/**
 * Covers the step-2 scope in architecture.md: primitives, a plain object,
 * and an optional field, serialized and deserialized through the actual
 * `rbxts-transformer-surge` + `@rbxts/surge` pipeline.
 */
class BasicRoundTripTest {
	@Fact
	public roundTripsWithOptionalPresent(): void {
		const value: Basic = { a: 1.5, flag: true, name: "hello", nickname: "hi" };
		const { buffer, blobs } = basicSerializer.serialize(value);
		const result = basicSerializer.deserialize(buffer, blobs);
		Assert.equal(value.a, result.a);
		Assert.equal(value.flag, result.flag);
		Assert.equal(value.name, result.name);
		Assert.equal(value.nickname, result.nickname);
	}

	@Fact
	public roundTripsWithOptionalAbsent(): void {
		const value: Basic = { a: -2, flag: false, name: "" };
		const { buffer, blobs } = basicSerializer.serialize(value);
		const result = basicSerializer.deserialize(buffer, blobs);
		Assert.equal(value.a, result.a);
		Assert.equal(value.flag, result.flag);
		Assert.equal(value.name, result.name);
		Assert.undefined(result.nickname);
	}
}

export = BasicRoundTripTest;
