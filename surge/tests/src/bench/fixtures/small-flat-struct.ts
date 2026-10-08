//!native
//!optimize 2
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
import { fbsSerializer } from "../codecs/small-flat-struct/fbs";
import { serioSerializer } from "../codecs/small-flat-struct/serio";
import type { FbsSmallFlatStruct, SerioSmallFlatStruct, SmallFlatStruct } from "../codecs/small-flat-struct/shapes";
import { serializer } from "../codecs/small-flat-struct/surge";

const value = { id: 4_000_000, x: 1.5, y: -2.25, z: 0.125, active: true };

export const smallFlatStruct: Fixture = {
	name: "small flat struct",
	note: "five fixed-size fields, no container",
	entries: [
		defineEntry<SmallFlatStruct>("surge", value, surgeAdapter(serializer)),
		defineEntry<FbsSmallFlatStruct>("fbs", value, fbsAdapter(fbsSerializer)),
		defineEntry<SerioSmallFlatStruct>("serio", value, serioAdapter(serioSerializer)),
		defineEntry("blink", value, blinkAdapter(blinkCodec)),
		defineEntry(
			"zap",
			value,
			zapAdapter((zap) => zap.SmallFlat),
		),
		defineEntry("baseline", value, baselineAdapter(baselineCodec)),
	],
};
