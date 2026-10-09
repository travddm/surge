//!native
//!optimize 2
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
import { nestedArrays as baselineCodec } from "../baseline/codecs";
import { NestedArrays as blinkCodec } from "../blink/server";
import { fbsSerializer } from "../codecs/nested-arrays/fbs";
import { flamework2Serializer } from "../codecs/nested-arrays/flamework2";
import { serioSerializer } from "../codecs/nested-arrays/serio";
import type { FbsNestedArrays, NestedArrays, SerioNestedArrays } from "../codecs/nested-arrays/shapes";
import { serializer } from "../codecs/nested-arrays/surge";

const ROWS = 20;
const MAX_LENGTH = 20;

const rng = new Rng(7919);
const rows = new Array<Array<number>>();
for (const _ of $range(1, ROWS)) {
	const row = new Array<number>();
	for (const __ of $range(1, rng.int(0, MAX_LENGTH))) {
		row.push(rng.int(0, 65535));
	}
	rows.push(row);
}

export const nestedArrays: Fixture = {
	name: "nested arrays",
	note: `${ROWS} rows of up to ${MAX_LENGTH} u16 elements, each row with a u32 count`,
	entries: [
		defineEntry<NestedArrays>("surge", { rows }, surgeAdapter(serializer)),
		defineEntry<FbsNestedArrays>("fbs", { rows }, fbsAdapter(fbsSerializer)),
		defineEntry<SerioNestedArrays>("serio", { rows }, serioAdapter(serioSerializer)),
		defineEntry<NestedArrays>("flamework2", { rows }, flamework2Adapter(flamework2Serializer)),
		defineEntry("blink", { rows }, blinkAdapter(blinkCodec)),
		defineEntry(
			"zap",
			{ rows },
			zapAdapter((zap) => zap.Rows),
		),
		defineEntry("baseline", { rows }, baselineAdapter(baselineCodec)),
	],
};
