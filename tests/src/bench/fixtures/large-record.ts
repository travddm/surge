import { DataType as Fbs, createBinarySerializer as createFbsSerializer } from "@rbxts/flamework-binary-serializer";
import createSerioSerializer from "@rbxts/serio";
import type * as Serio from "@rbxts/serio";
import { DataType, createBinarySerializer } from "@rbxts/surge";

import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { blinkAdapter } from "../adapters/blink";
import { fbsAdapter } from "../adapters/fbs";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { zapAdapter } from "../adapters/zap";
import { LargeRecord as blinkCodec } from "../blink/server";

const COUNT = 200;

interface LargeRecord {
	entries: Record<string, DataType.u8>;
}

/**
 * fbs and serio read an object's fields from the property list their
 * Flamework macro sees, which an index signature does not provide: both
 * reach a string-keyed table only as a `Map`. The two shapes therefore
 * differ, and the row compares surge's index signature against their map --
 * the same 200 pairs either way, so the byte counts stay comparable.
 */
interface FbsLargeRecord {
	entries: Map<string, Fbs.u8>;
}

interface SerioLargeRecord {
	entries: Map<string, Serio.u8>;
}

const serializer = createBinarySerializer<LargeRecord>();
const fbsSerializer = createFbsSerializer<FbsLargeRecord>();
const serioSerializer = createSerioSerializer<SerioLargeRecord>();

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
