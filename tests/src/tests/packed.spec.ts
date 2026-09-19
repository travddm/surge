import { Assert, Fact } from "@rbxts/runit";
import { DataType, createBinarySerializer } from "@rbxts/surge";

import { Rng, difference } from "../support";

// Ten booleans: the packed region crosses a byte boundary.
interface TenFlags {
	f0: boolean;
	f1: boolean;
	f2: boolean;
	f3: boolean;
	f4: boolean;
	f5: boolean;
	f6: boolean;
	f7: boolean;
	f8: boolean;
	f9: boolean;
}
const tenFlagsSerializer = createBinarySerializer<DataType.Packed<TenFlags>>();

// Booleans of a nested object, next to fields that are not booleans.
interface Settings {
	visible: boolean;
	label: string;
	audio: { muted: boolean; volume: number; spatial: boolean };
}
interface WithPackedSubtree {
	settings: DataType.Packed<Settings>;
	outside: boolean;
}
const subtreeSerializer = createBinarySerializer<WithPackedSubtree>();

// Packed optionals: a presence bit each, and no flag byte. `muted` is a
// presence bit and a value bit, with no byte of its own.
interface Profile {
	name: string;
	nickname?: string;
	level?: DataType.u8;
	verified: boolean;
	muted?: boolean;
	extra?: unknown;
}
const profileSerializer = createBinarySerializer<DataType.Packed<Profile>>();

const FLAG_NAMES = ["f0", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9"] as const;

class PackedTest {
	@Fact
	public packsTenBooleansIntoTwoBytes(): void {
		const rng = new Rng(9);
		for (const _ of $range(1, 100)) {
			const value = {} as { [K in keyof TenFlags]: boolean };
			for (const name of FLAG_NAMES) {
				value[name] = rng.bool();
			}
			const { buffer: buf, blobs } = tenFlagsSerializer.serialize(value);
			Assert.equal(2, buffer.len(buf));
			Assert.equal(undefined, difference(value, tenFlagsSerializer.deserialize(buf, blobs)));
		}
	}

	@Fact
	public setsOneBitForEachBoolean(): void {
		for (const i of $range(0, 9)) {
			const value = {} as { [K in keyof TenFlags]: boolean };
			for (const name of FLAG_NAMES) {
				value[name] = name === FLAG_NAMES[i];
			}
			const { buffer: buf } = tenFlagsSerializer.serialize(value);
			Assert.equal(2 ** i, buffer.readu16(buf, 0));
		}
	}

	@Fact
	public roundTripsAPackedNestedObject(): void {
		const rng = new Rng(10);
		for (const _ of $range(1, 100)) {
			const value: WithPackedSubtree = {
				settings: {
					visible: rng.bool(),
					label: rng.str(),
					audio: { muted: rng.bool(), volume: rng.f64(), spatial: rng.bool() },
				},
				outside: rng.bool(),
			};
			const { buffer, blobs } = subtreeSerializer.serialize(value);
			Assert.equal(undefined, difference(value, subtreeSerializer.deserialize(buffer, blobs)));
		}
	}

	@Fact
	public packsEachOptionalPresenceIntoOneBit(): void {
		const value: Profile = { name: "ab", verified: true };
		const { buffer: buf, blobs } = profileSerializer.serialize(value);
		// The packed region (6 bits), then `name`. No absent optional costs a byte.
		Assert.equal(1 + 4 + 2, buffer.len(buf));
		// `verified` is the last of the bits, which are in name order: extra,
		// level, muted (present, value), nickname, verified.
		Assert.equal(32, buffer.readu8(buf, 0));
		Assert.equal(undefined, difference(value, profileSerializer.deserialize(buf, blobs)));
	}

	@Fact
	public roundTripsRandomPackedOptionals(): void {
		const rng = new Rng(16);
		for (const _ of $range(1, 200)) {
			const value: Profile = {
				name: rng.str(),
				nickname: rng.bool() ? rng.str() : undefined,
				level: rng.bool() ? rng.int(0, 255) : undefined,
				verified: rng.bool(),
				muted: rng.bool() ? rng.bool() : undefined,
				extra: rng.bool() ? rng.str() : undefined,
			};
			const { buffer, blobs } = profileSerializer.serialize(value);
			Assert.equal(undefined, difference(value, profileSerializer.deserialize(buffer, blobs)));
		}
	}
}

export = PackedTest;
