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
}

export = PackedTest;
