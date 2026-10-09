//!native
//!optimize 2
import type { DataType as Fbs } from "@rbxts/flamework-binary-serializer";
import type * as Serio from "@rbxts/serio";
import type { DataType } from "@rbxts/surge";

import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { baselineAdapter } from "../adapters/baseline";
import { blinkAdapter } from "../adapters/blink";
import { fbsAdapter } from "../adapters/fbs";
import { flamework2Adapter } from "../adapters/flamework2";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { zapAdapter } from "../adapters/zap";
import { transforms as baselineCodec } from "../baseline/codecs";
import { Transforms as blinkCodec } from "../blink/server";
import { fbsSerializer } from "../codecs/cframes/fbs";
import { fbsPackedSerializer } from "../codecs/cframes/fbs-packed";
import { flamework2Serializer } from "../codecs/cframes/flamework2";
import { serioSerializer } from "../codecs/cframes/serio";
import { serioPackedSerializer } from "../codecs/cframes/serio-packed";
import type { Transforms } from "../codecs/cframes/shapes";
import { serializer } from "../codecs/cframes/surge";
import { packedSerializer } from "../codecs/cframes/surge-packed";

const COUNT = 50;

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

export const cframeArray: Fixture = {
	name: "CFrame array",
	note: `${COUNT} arbitrary rotations, unpacked: position plus axis-angle`,
	entries: [
		defineEntry<Transforms>("surge", { list: arbitrary }, surgeAdapter(serializer)),
		defineEntry<Transforms>("fbs", { list: arbitrary }, fbsAdapter(fbsSerializer)),
		defineEntry<Transforms>("serio", { list: arbitrary }, serioAdapter(serioSerializer)),
		defineEntry<Transforms>("flamework2", { list: arbitrary }, flamework2Adapter(flamework2Serializer)),
		defineEntry("blink", { list: arbitrary }, blinkAdapter(blinkCodec)),
		defineEntry(
			"zap",
			{ list: arbitrary },
			zapAdapter((zap) => zap.Frames),
		),
		defineEntry("baseline", { list: arbitrary }, baselineAdapter(baselineCodec)),
	],
};

export const cframeArrayPackedAligned: Fixture = {
	name: "CFrame array (packed, axis-aligned)",
	note: `${COUNT} axis-aligned rotations in \`Packed<T>\`: header byte plus position`,
	entries: [
		defineEntry<DataType.Packed<Transforms>>("surge", { list: aligned }, surgeAdapter(packedSerializer)),
		defineEntry<Fbs.Packed<Transforms>>("fbs", { list: aligned }, fbsAdapter(fbsPackedSerializer)),
		defineEntry<Serio.Packed<Transforms>>("serio", { list: aligned }, serioAdapter(serioPackedSerializer)),
	],
};

export const cframeArrayPackedArbitrary: Fixture = {
	name: "CFrame array (packed, arbitrary)",
	note: `${COUNT} arbitrary rotations in \`Packed<T>\`: header byte, position, and axis-angle`,
	entries: [
		defineEntry<DataType.Packed<Transforms>>("surge", { list: arbitrary }, surgeAdapter(packedSerializer)),
		defineEntry<Fbs.Packed<Transforms>>("fbs", { list: arbitrary }, fbsAdapter(fbsPackedSerializer)),
		defineEntry<Serio.Packed<Transforms>>("serio", { list: arbitrary }, serioAdapter(serioPackedSerializer)),
	],
};
