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
import { nestedObject as baselineCodec } from "../baseline/codecs";
import { NestedObject as blinkCodec } from "../blink/server";

interface Leaf {
	name: string;
	weight: DataType.f32;
}

interface Third {
	leaf: Leaf;
	flag: boolean;
}

interface Second {
	inner: Third;
	count: DataType.u16;
}

interface First {
	inner: Second;
	label: string;
}

/** Five levels of objects: what nesting costs when no level repeats. */
interface NestedObject {
	root: First;
	version: DataType.u8;
}

interface FbsNestedObject {
	root: {
		inner: {
			inner: { leaf: { name: string; weight: Fbs.f32 }; flag: boolean };
			count: Fbs.u16;
		};
		label: string;
	};
	version: Fbs.u8;
}

interface SerioNestedObject {
	root: {
		inner: {
			inner: { leaf: { name: string; weight: Serio.f32 }; flag: boolean };
			count: Serio.u16;
		};
		label: string;
	};
	version: Serio.u8;
}

const serializer = createBinarySerializer<NestedObject>();
const fbsSerializer = createFbsSerializer<FbsNestedObject>();
const serioSerializer = createSerioSerializer<SerioNestedObject>();

const value = {
	root: {
		inner: { inner: { leaf: { name: "leaf", weight: 0.5 }, flag: true }, count: 1200 },
		label: "root",
	},
	version: 3,
};

export const nestedObject: Fixture = {
	name: "deeply nested object",
	note: "five levels of objects, one field each level",
	entries: [
		defineEntry<NestedObject>("surge", value, surgeAdapter(serializer)),
		defineEntry<FbsNestedObject>("fbs", value, fbsAdapter(fbsSerializer)),
		defineEntry<SerioNestedObject>("serio", value, serioAdapter(serioSerializer)),
		defineEntry("blink", value, blinkAdapter(blinkCodec)),
		defineEntry(
			"zap",
			value,
			zapAdapter((zap) => zap.Nested),
		),
		defineEntry("baseline", value, baselineAdapter(baselineCodec)),
	],
};
