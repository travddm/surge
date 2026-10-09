//!native
//!optimize 2
import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { blinkAdapter } from "../adapters/blink";
import { fbsAdapter } from "../adapters/fbs";
import { flamework2Adapter } from "../adapters/flamework2";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { zapAdapter } from "../adapters/zap";
import { LargeArray as blinkCodec } from "../blink/server";
import { fbsSerializer } from "../codecs/large-array/fbs";
import { flamework2Serializer } from "../codecs/large-array/flamework2";
import { serioSerializer } from "../codecs/large-array/serio";
import type { FbsLargeArray, LargeArray, SerioLargeArray } from "../codecs/large-array/shapes";
import { serializer } from "../codecs/large-array/surge";

const COUNT = 1000;

const rng = new Rng(4127);
const values = new Array<number>();
for (const _ of $range(1, COUNT)) {
	values.push(rng.int(0, 65535));
}

export const largeArray: Fixture = {
	name: "large array",
	note: `${COUNT} u16 elements behind one count`,
	entries: [
		defineEntry<LargeArray>("surge", { values }, surgeAdapter(serializer)),
		defineEntry<FbsLargeArray>("fbs", { values }, fbsAdapter(fbsSerializer)),
		defineEntry<SerioLargeArray>("serio", { values }, serioAdapter(serioSerializer)),
		defineEntry<LargeArray>("flamework2", { values }, flamework2Adapter(flamework2Serializer)),
		defineEntry("blink", { values }, blinkAdapter(blinkCodec)),
		defineEntry(
			"zap",
			{ values },
			zapAdapter((zap) => zap.Large),
		),
	],
};
