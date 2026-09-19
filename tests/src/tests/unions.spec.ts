import { Assert, Fact } from "@rbxts/runit";
import { DataType, createBinarySerializer } from "@rbxts/surge";

import { Rng, difference } from "../support";

interface Named {
	name: string;
	aliases: string[];
}
type NameOrText = Named | string;
type Scalar = string | number | boolean;

interface WithGuardedUnions {
	who: NameOrText;
	scalars: Scalar[];
	maybeScalar?: Scalar;
}
const guardedSerializer = createBinarySerializer<WithGuardedUnions>();

type Command =
	| { op: "move"; x: number; y: number }
	| { op: "say"; text: string }
	| { op: "stop" }
	| { op: "batch"; commands: Command[] };
const commandSerializer = createBinarySerializer<Command>();

// A numeric discriminant, and a packed subtree inside one variant.
type Packet =
	| { id: 1; flags: DataType.Packed<{ urgent: boolean; signed: boolean }> }
	| { id: 2; body: string }
	| { id: 3; parts: Array<Named | string> };
const packetSerializer = createBinarySerializer<Packet>();

const FUZZ_ITERATIONS = 100;

function randomScalar(rng: Rng): Scalar {
	const choice = rng.int(0, 2);
	if (choice === 0) {
		return rng.str();
	}
	return choice === 1 ? rng.f64() : rng.bool();
}

function randomCommand(rng: Rng, depth: number): Command {
	const choice = rng.int(0, depth > 0 ? 3 : 2);
	if (choice === 0) {
		return { op: "move", x: rng.f64(), y: rng.f64() };
	} else if (choice === 1) {
		return { op: "say", text: rng.str() };
	} else if (choice === 2) {
		return { op: "stop" };
	}
	const commands = new Array<Command>();
	for (const _ of $range(1, rng.int(0, 3))) {
		commands.push(randomCommand(rng, depth - 1));
	}
	return { op: "batch", commands };
}

class UnionsTest {
	@Fact
	public roundTripsAGuardedUnionWithATableVariant(): void {
		for (const who of ["just text", { name: "Ada", aliases: ["A", ""] }] as NameOrText[]) {
			const value: WithGuardedUnions = { who, scalars: ["s", 1, true, false, "", 0], maybeScalar: false };
			const { buffer, blobs } = guardedSerializer.serialize(value);
			Assert.equal(undefined, difference(value, guardedSerializer.deserialize(buffer, blobs)));
		}
	}

	@Fact
	public roundTripsEachVariantOfATaggedUnion(): void {
		const values: Command[] = [
			{ op: "move", x: 1, y: -2 },
			{ op: "say", text: "hi" },
			{ op: "stop" },
			{ op: "batch", commands: [{ op: "stop" }, { op: "batch", commands: [] }] },
		];
		for (const value of values) {
			const { buffer, blobs } = commandSerializer.serialize(value);
			Assert.equal(undefined, difference(value, commandSerializer.deserialize(buffer, blobs)));
		}
	}

	@Fact
	public writesOnlyTheVariantIndexForAVariantWithNoFields(): void {
		const { buffer: buf } = commandSerializer.serialize({ op: "stop" });
		Assert.equal(1, buffer.len(buf));
	}

	@Fact
	public roundTripsANumericTagAndAPackedVariant(): void {
		const values: Packet[] = [
			{ id: 1, flags: { urgent: true, signed: false } },
			{ id: 2, body: "text" },
			{ id: 3, parts: ["a", { name: "b", aliases: [] }] },
		];
		for (const value of values) {
			const { buffer, blobs } = packetSerializer.serialize(value);
			Assert.equal(undefined, difference(value, packetSerializer.deserialize(buffer, blobs)));
		}
		// The variant index and one byte for both packed booleans.
		Assert.equal(2, buffer.len(packetSerializer.serialize(values[0]).buffer));
	}

	@Fact
	public roundTripsRandomUnions(): void {
		const rng = new Rng(7);
		for (const _ of $range(1, FUZZ_ITERATIONS)) {
			const scalars = new Array<Scalar>();
			for (const __ of $range(1, rng.int(0, 5))) {
				scalars.push(randomScalar(rng));
			}
			const guarded: WithGuardedUnions = {
				who: rng.bool() ? rng.str() : { name: rng.str(), aliases: [rng.str()] },
				scalars,
				maybeScalar: rng.bool() ? randomScalar(rng) : undefined,
			};
			const writtenGuarded = guardedSerializer.serialize(guarded);
			Assert.equal(
				undefined,
				difference(guarded, guardedSerializer.deserialize(writtenGuarded.buffer, writtenGuarded.blobs)),
			);

			const command = randomCommand(rng, 3);
			const writtenCommand = commandSerializer.serialize(command);
			Assert.equal(
				undefined,
				difference(command, commandSerializer.deserialize(writtenCommand.buffer, writtenCommand.blobs)),
			);
		}
	}
}

export = UnionsTest;
