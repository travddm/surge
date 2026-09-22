//!optimize 2
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

// A packed tagged union with two variants, as a direct property: one tag bit.
type Toggle = { mode: "off" } | { mode: "on"; level: DataType.u8 };
interface Device {
	name: string;
	primary: Toggle;
	secondary: Toggle;
	// Three variants: the tag stays an index byte.
	source: { from: "battery" } | { from: "mains" } | { from: "solar"; watts: number };
}
const deviceSerializer = createBinarySerializer<DataType.Packed<Device>>();
// At the root there is no enclosing object, so the tag stays an index byte.
const toggleSerializer = createBinarySerializer<DataType.Packed<Toggle>>();

const packedCFrameSerializer = createBinarySerializer<DataType.Packed<CFrame>>();
const packedCFramesSerializer = createBinarySerializer<DataType.Packed<{ list: CFrame[]; maybe?: CFrame }>>();

// Every product of quarter turns about X, Y, and Z: 64 products, which are the
// 24 axis-aligned rotations. `CFrame.Angles` leaves components of about 4e-8
// where the exact rotation has 0, so these also cover the tolerance.
function quarterTurns(x: number, y: number, z: number): CFrame {
	return CFrame.Angles(math.rad(90 * x), 0, 0)
		.mul(CFrame.Angles(0, math.rad(90 * y), 0))
		.mul(CFrame.Angles(0, 0, math.rad(90 * z)));
}

function assertCFramesMatch(expected: CFrame, actual: CFrame, epsilon: number): void {
	const expectedComponents = [...expected.GetComponents()];
	const actualComponents = [...actual.GetComponents()];
	for (const i of $range(0, 11)) {
		Assert.fuzzyEqual(expectedComponents[i], actualComponents[i], epsilon);
	}
}

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

	@Fact
	public packsEachAxisAlignedRotationIntoItsOwnHeaderByte(): void {
		const headers = new Set<number>();
		for (const x of $range(0, 3)) {
			for (const y of $range(0, 3)) {
				for (const z of $range(0, 3)) {
					const value = quarterTurns(x, y, z);
					const { buffer: buf, blobs } = packedCFrameSerializer.serialize(value);
					Assert.equal(1, buffer.len(buf));
					headers.add(buffer.readu8(buf, 0));
					assertCFramesMatch(value, packedCFrameSerializer.deserialize(buf, blobs), 1e-6);
				}
			}
		}
		Assert.equal(24, headers.size());
	}

	@Fact
	public writesOnlyThePartsOfACFrameThatTheHeaderDoesNotGive(): void {
		const aligned = CFrame.Angles(0, math.rad(90), 0);
		const tilted = CFrame.Angles(0.3, -1.1, 2);
		const cases: Array<[CFrame, number]> = [
			[aligned, 1],
			[aligned.add(Vector3.one), 1],
			[aligned.add(new Vector3(1, 2, 3)), 1 + 12],
			[tilted, 1 + 12],
			[tilted.add(new Vector3(1, 2, 3)), 1 + 12 + 12],
		];
		for (const [value, size] of cases) {
			const { buffer: buf, blobs } = packedCFrameSerializer.serialize(value);
			Assert.equal(size, buffer.len(buf));
			assertCFramesMatch(value, packedCFrameSerializer.deserialize(buf, blobs), 1e-4);
		}
	}

	@Fact
	public doesNotSnapARotationThatIsOnlyNearlyAxisAligned(): void {
		const value = CFrame.Angles(0, math.rad(90) + 1e-4, 0);
		const { buffer: buf, blobs } = packedCFrameSerializer.serialize(value);
		Assert.equal(1 + 12, buffer.len(buf));
		// Snapping would move a component by 1e-4.
		assertCFramesMatch(value, packedCFrameSerializer.deserialize(buf, blobs), 1e-5);
	}

	@Fact
	public roundTripsRandomPackedCFrames(): void {
		const rng = new Rng(17);
		for (const _ of $range(1, 100)) {
			const list = new Array<CFrame>();
			for (const __ of $range(1, rng.int(0, 4))) {
				const rotation = rng.bool()
					? quarterTurns(rng.int(0, 3), rng.int(0, 3), rng.int(0, 3))
					: CFrame.Angles(rng.next() * 6 - 3, rng.next() * 6 - 3, rng.next() * 6 - 3);
				list.push(rng.bool() ? rotation : rotation.add(new Vector3(rng.f32(), rng.f32(), rng.f32())));
			}
			const value = { list, maybe: rng.bool() ? list[0] : undefined };
			const { buffer, blobs } = packedCFramesSerializer.serialize(value);
			const result = packedCFramesSerializer.deserialize(buffer, blobs);
			Assert.equal(list.size(), result.list.size());
			list.forEach((expected, i) => assertCFramesMatch(expected, result.list[i], 1e-4));
			Assert.equal(value.maybe === undefined, result.maybe === undefined);
		}
	}

	@Fact
	public packsTheTagOfATwoVariantUnionIntoOneBit(): void {
		const value: Device = {
			name: "",
			primary: { mode: "off" },
			secondary: { mode: "on", level: 9 },
			source: { from: "mains" },
		};
		const { buffer: buf, blobs } = deviceSerializer.serialize(value);
		// The packed region (2 tag bits), `name`, the level of `secondary`, and the index byte of `source`.
		Assert.equal(1 + 4 + 1 + 1, buffer.len(buf));
		// Bit 0 is `primary` (off, the first variant), bit 1 is `secondary` (on, the second).
		Assert.equal(2, buffer.readu8(buf, 0));
		Assert.equal(undefined, difference(value, deviceSerializer.deserialize(buf, blobs)));
		// One index byte and nothing else.
		Assert.equal(1, buffer.len(toggleSerializer.serialize({ mode: "off" }).buffer));
	}

	@Fact
	public roundTripsRandomPackedTaggedUnions(): void {
		const rng = new Rng(18);
		const toggle = (): Toggle => (rng.bool() ? { mode: "off" } : { mode: "on", level: rng.int(0, 255) });
		for (const _ of $range(1, 100)) {
			const choice = rng.int(0, 2);
			const value: Device = {
				name: rng.str(),
				primary: toggle(),
				secondary: toggle(),
				source:
					choice === 0
						? { from: "battery" }
						: choice === 1
							? { from: "mains" }
							: { from: "solar", watts: rng.f64() },
			};
			const { buffer, blobs } = deviceSerializer.serialize(value);
			Assert.equal(undefined, difference(value, deviceSerializer.deserialize(buffer, blobs)));
			const alone = toggleSerializer.serialize(value.primary);
			Assert.equal(undefined, difference(value.primary, toggleSerializer.deserialize(alone.buffer, alone.blobs)));
		}
	}
}

export = PackedTest;
