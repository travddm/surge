//!native
//!optimize 2
import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { fbsAdapter } from "../adapters/fbs";
import { flamework2Adapter } from "../adapters/flamework2";
import { surgeAdapter } from "../adapters/surge";
import { cursorAdapter } from "../adapters/surge-cursor";
import { fbsSerializer } from "../codecs/tuple-rest/fbs";
import { flamework2Serializer } from "../codecs/tuple-rest/flamework2";
import type { FbsReadings, Reading, Readings } from "../codecs/tuple-rest/shapes";
import { serializer } from "../codecs/tuple-rest/surge";
import { checkedSerializer } from "../codecs/tuple-rest/surge-checked";
import { cursorSerializer } from "../codecs/tuple-rest/surge-cursor";

const COUNT = 50;
const MAX_SAMPLES = 8;

const rng = new Rng(6151);
const readings = new Array<Reading>();
for (const _ of $range(1, COUNT)) {
	const reading: Reading = [rng.int(0, 65535), rng.f32()];
	for (const _ of $range(1, rng.int(0, MAX_SAMPLES))) {
		reading.push(rng.int(0, 255));
	}
	readings.push(reading);
}

export const tupleRest: Fixture = {
	name: "tuples with a rest",
	note: `${COUNT} tuples of a u16, an f32 and up to ${MAX_SAMPLES} u8 samples`,
	entries: [
		defineEntry<Readings>("surge", { readings }, surgeAdapter(serializer)),
		defineEntry<Readings>("surge (cursor)", { readings }, cursorAdapter(cursorSerializer)),
		defineEntry<Readings>("surge (readChecks)", { readings }, surgeAdapter(checkedSerializer)),
		defineEntry<FbsReadings>("fbs", { readings }, fbsAdapter(fbsSerializer)),
		defineEntry<Readings>("flamework2", { readings }, flamework2Adapter(flamework2Serializer)),
	],
};
