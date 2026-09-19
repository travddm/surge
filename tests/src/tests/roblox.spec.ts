import { Assert, Fact } from "@rbxts/runit";
import { createBinarySerializer } from "@rbxts/surge";

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

const RIGS: ReadonlyArray<Enum.HumanoidRigType> = [Enum.HumanoidRigType.R6, Enum.HumanoidRigType.R15];

function randomVector3(rng: Rng): Vector3 {
	return new Vector3(rng.f32(), rng.f32(), rng.f32());
}

class RobloxTest {
	@Fact
	public roundTripsSequences(): void {
		// Every time and value is exact in an f32, and every channel is a
		// multiple of 1/255. Each envelope is 0: the encoding does not carry
		// the envelope yet (type-coverage-parity.md Tier A).
		const value: WithSequences = {
			colors: new ColorSequence([
				new ColorSequenceKeypoint(0, new Color3(1, 0, 0)),
				new ColorSequenceKeypoint(0.5, new Color3(0, 1, 0)),
				new ColorSequenceKeypoint(1, new Color3(0, 0, 1)),
			]),
			numbers: new NumberSequence([new NumberSequenceKeypoint(0, 0.25), new NumberSequenceKeypoint(1, 8)]),
		};
		const { buffer: buf, blobs } = sequencesSerializer.serialize(value);
		// u8 count + 3 x (f32 time + 3 x u8), then u8 count + 2 x (f32 time + f32 value).
		Assert.equal(1 + 3 * 7 + 1 + 2 * 8, buffer.len(buf));
		Assert.empty(blobs);
		const result = sequencesSerializer.deserialize(buf, blobs);
		Assert.equal(value.colors, result.colors);
		Assert.equal(value.numbers, result.numbers);
	}

	@Fact
	public passesUnknownAndInstanceValuesThroughTheBlobChannel(): void {
		const anything = { nested: ["any", "shape"] };
		const part = new Instance("Part");
		const value: WithBlobs = { anything, part, maybePart: part, count: 3 };
		const { buffer: buf, blobs } = blobsSerializer.serialize(value);
		// `count`, and the presence byte of `maybePart`. A blob writes nothing into the buffer.
		Assert.equal(8 + 1, buffer.len(buf));
		Assert.equal(3, blobs.size());
		const result = blobsSerializer.deserialize(buf, blobs);
		// By identity: a blob is passed through, not copied.
		Assert.equal(anything, result.anything);
		Assert.equal(part, result.part);
		Assert.equal(part, result.maybePart);
		Assert.equal(3, result.count);
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
