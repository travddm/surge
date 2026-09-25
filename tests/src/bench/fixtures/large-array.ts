//!native
//!optimize 2
import { DataType as Fbs, createBinarySerializer as createFbsSerializer } from "@rbxts/flamework-binary-serializer";
import createSerioSerializer from "@rbxts/serio";
import type * as Serio from "@rbxts/serio";
import { DataType, createCodec } from "@rbxts/surge";

import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { blinkAdapter } from "../adapters/blink";
import { fbsAdapter } from "../adapters/fbs";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { zapAdapter } from "../adapters/zap";
import { LargeArray as blinkCodec } from "../blink/server";

const COUNT = 1000;

interface LargeArray {
	values: DataType.u16[];
}

interface FbsLargeArray {
	values: Fbs.u16[];
}

/** serio's plain array is a `List` with a u32 length prefix, the width the other two also take. */
interface SerioLargeArray {
	values: Serio.u16[];
}

const serializer = createCodec<LargeArray>();
const fbsSerializer = createFbsSerializer<FbsLargeArray>();
const serioSerializer = createSerioSerializer<SerioLargeArray>();

const rng = new Rng(4127);
const values = new Array<number>();
for (const _ of $range(1, COUNT)) {
	values.push(rng.int(0, 65535));
}

export const largeArray: Fixture = {
	name: "large array",
	note: `${COUNT} u16 elements behind one u32 length prefix`,
	entries: [
		defineEntry<LargeArray>("surge", { values }, surgeAdapter(serializer)),
		defineEntry<FbsLargeArray>("fbs", { values }, fbsAdapter(fbsSerializer)),
		defineEntry<SerioLargeArray>("serio", { values }, serioAdapter(serioSerializer)),
		defineEntry("blink", { values }, blinkAdapter(blinkCodec)),
		defineEntry(
			"zap",
			{ values },
			zapAdapter((zap) => zap.Large),
		),
	],
};
