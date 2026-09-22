import { DataType as Fbs, createBinarySerializer as createFbsSerializer } from "@rbxts/flamework-binary-serializer";
import createSerioSerializer from "@rbxts/serio";
import type * as Serio from "@rbxts/serio";
import { DataType, createBinarySerializer } from "@rbxts/surge";

import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { baselineAdapter } from "../adapters/baseline";
import { blinkAdapter } from "../adapters/blink";
import { fbsAdapter } from "../adapters/fbs";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { zapAdapter } from "../adapters/zap";
import { smallFlatStruct as baselineCodec } from "../baseline/codecs";
import { SmallFlatStruct as blinkCodec } from "../blink/server";
import { SmallFlat as zapEvent } from "../zap/server";

/**
 * Widths are explicit so a size delta reflects a format decision, not a
 * library's default. Each library brands its widths with its own type
 * aliases, which is why the shape is declared once per library over one
 * shared sample value.
 */
interface SmallFlatStruct {
	id: DataType.u32;
	x: DataType.f32;
	y: DataType.f32;
	z: DataType.f32;
	active: boolean;
}

interface FbsSmallFlatStruct {
	id: Fbs.u32;
	x: Fbs.f32;
	y: Fbs.f32;
	z: Fbs.f32;
	active: boolean;
}

interface SerioSmallFlatStruct {
	id: Serio.u32;
	x: Serio.f32;
	y: Serio.f32;
	z: Serio.f32;
	active: boolean;
}

const serializer = createBinarySerializer<SmallFlatStruct>();
const fbsSerializer = createFbsSerializer<FbsSmallFlatStruct>();
const serioSerializer = createSerioSerializer<SerioSmallFlatStruct>();

const value = { id: 4_000_000, x: 1.5, y: -2.25, z: 0.125, active: true };

export const smallFlatStruct: Fixture = {
	name: "small flat struct",
	note: "five fixed-size fields, no container",
	entries: [
		defineEntry<SmallFlatStruct>("surge", value, surgeAdapter(serializer)),
		defineEntry<FbsSmallFlatStruct>("fbs", value, fbsAdapter(fbsSerializer)),
		defineEntry<SerioSmallFlatStruct>("serio", value, serioAdapter(serioSerializer)),
		defineEntry("blink", value, blinkAdapter(blinkCodec)),
		defineEntry("zap", value, zapAdapter(zapEvent)),
		defineEntry("baseline", value, baselineAdapter(baselineCodec)),
	],
};
