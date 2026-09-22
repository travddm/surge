import { DataType, createBinarySerializer } from "@rbxts/surge";

import { Rng } from "../../support";
import { defineFixture } from "../adapter";
import { surgeAdapter } from "../adapters/surge";

const COUNT = 50;

interface Transforms {
	list: CFrame[];
}

const serializer = createBinarySerializer<Transforms>();
const packedSerializer = createBinarySerializer<DataType.Packed<Transforms>>();

const rng = new Rng(5419);

const AXES = [
	new Vector3(1, 0, 0),
	new Vector3(-1, 0, 0),
	new Vector3(0, 1, 0),
	new Vector3(0, -1, 0),
	new Vector3(0, 0, 1),
	new Vector3(0, 0, -1),
];

/**
 * One of the 24 rotations the packed header carries on its own, built from
 * unit axes rather than from `CFrame.Angles`: a product of quarter turns
 * leaves components of about 4e-8 where the exact rotation has 0, which would
 * make the round trip inexact for a reason that has nothing to do with the
 * encoding.
 */
function alignedRotation(position: Vector3): CFrame {
	const right = rng.pick(AXES);
	const up = rng.pick(AXES.filter((axis) => axis.Dot(right) === 0));
	return CFrame.fromMatrix(position, right, up);
}

const aligned = new Array<CFrame>();
const arbitrary = new Array<CFrame>();
for (const _ of $range(1, COUNT)) {
	const position = new Vector3(rng.f32(), rng.f32(), rng.f32());
	aligned.push(alignedRotation(position));
	arbitrary.push(CFrame.Angles(rng.next(), rng.next(), rng.next()).add(position));
}

export const cframeArray = defineFixture<Transforms>(
	"CFrame array",
	`${COUNT} arbitrary rotations, unpacked: position plus axis-angle`,
	{ list: arbitrary },
	surgeAdapter(serializer),
);

export const cframeArrayPackedAligned = defineFixture<DataType.Packed<Transforms>>(
	"CFrame array (packed, axis-aligned)",
	`${COUNT} axis-aligned rotations in \`Packed<T>\`: header byte plus position`,
	{ list: aligned },
	surgeAdapter(packedSerializer),
);

export const cframeArrayPackedArbitrary = defineFixture<DataType.Packed<Transforms>>(
	"CFrame array (packed, arbitrary)",
	`${COUNT} arbitrary rotations in \`Packed<T>\`: header byte, position, and axis-angle`,
	{ list: arbitrary },
	surgeAdapter(packedSerializer),
);
