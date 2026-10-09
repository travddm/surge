//!native
//!optimize 2
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { baselineAdapter } from "../adapters/baseline";
import { blinkAdapter } from "../adapters/blink";
import { fbsAdapter } from "../adapters/fbs";
import { flamework2Adapter } from "../adapters/flamework2";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { zapAdapter } from "../adapters/zap";
import { nestedObject as baselineCodec } from "../baseline/codecs";
import { NestedObject as blinkCodec } from "../blink/server";
import { fbsSerializer } from "../codecs/nested-object/fbs";
import { flamework2Serializer } from "../codecs/nested-object/flamework2";
import { serioSerializer } from "../codecs/nested-object/serio";
import type { FbsNestedObject, NestedObject, SerioNestedObject } from "../codecs/nested-object/shapes";
import { serializer } from "../codecs/nested-object/surge";

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
		defineEntry<NestedObject>("flamework2", value, flamework2Adapter(flamework2Serializer)),
		defineEntry("blink", value, blinkAdapter(blinkCodec)),
		defineEntry(
			"zap",
			value,
			zapAdapter((zap) => zap.Nested),
		),
		defineEntry("baseline", value, baselineAdapter(baselineCodec)),
	],
};
