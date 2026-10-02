//!native
//!optimize 2
import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { blinkAdapter } from "../adapters/blink";
import { fbsAdapter } from "../adapters/fbs";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { zapAdapter } from "../adapters/zap";
import { LargeRecord as blinkCodec } from "../blink/server";
import { fbsSerializer } from "../codecs/large-record/fbs";
import { serioSerializer } from "../codecs/large-record/serio";
import type { FbsLargeRecord, LargeRecord, SerioLargeRecord } from "../codecs/large-record/shapes";
import { serializer } from "../codecs/large-record/surge";

const COUNT = 200;

const rng = new Rng(9311);
const entries: Record<string, number> = {};
const mapEntries = new Map<string, number>();
for (const index of $range(1, COUNT)) {
	const value = rng.int(0, 255);
	entries[`key${index}`] = value;
	mapEntries.set(`key${index}`, value);
}

export const largeRecord: Fixture = {
	name: "large record",
	note: `${COUNT} string keys, each with a u8 value; a \`Map\` under fbs and serio`,
	entries: [
		defineEntry<LargeRecord>("surge", { entries }, surgeAdapter(serializer)),
		defineEntry<FbsLargeRecord>("fbs", { entries: mapEntries }, fbsAdapter(fbsSerializer)),
		defineEntry<SerioLargeRecord>("serio", { entries: mapEntries }, serioAdapter(serioSerializer)),
		defineEntry("blink", { entries }, blinkAdapter(blinkCodec)),
		defineEntry(
			"zap",
			{ entries },
			zapAdapter((zap) => zap.Record),
		),
	],
};
