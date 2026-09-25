//!native
//!optimize 2
import { createBinarySerializer as createFbsSerializer } from "@rbxts/flamework-binary-serializer";
import createSerioSerializer from "@rbxts/serio";
import { createCodec } from "@rbxts/surge";

import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { blinkAdapter } from "../adapters/blink";
import { fbsAdapter } from "../adapters/fbs";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { zapAdapter } from "../adapters/zap";
import { StringHeavy as blinkCodec } from "../blink/server";

const COUNT = 100;

/**
 * No width brands anywhere, so the three libraries declare the same shape:
 * a plain `string` is a u32 length prefix plus its bytes in all of them.
 */
interface StringHeavy {
	title: string;
	author: string;
	lines: string[];
}

const serializer = createCodec<StringHeavy>();
const fbsSerializer = createFbsSerializer<StringHeavy>();
const serioSerializer = createSerioSerializer<StringHeavy>();

const rng = new Rng(2207);
const lines = new Array<string>();
for (const _ of $range(1, COUNT)) {
	lines.push(rng.str(40));
}

const value: StringHeavy = { title: "a chapter", author: "someone", lines };

export const stringHeavy: Fixture = {
	name: "string-heavy",
	note: `two short strings and ${COUNT} of up to 40 bytes, each with a u32 length prefix`,
	entries: [
		defineEntry<StringHeavy>("surge", value, surgeAdapter(serializer)),
		defineEntry<StringHeavy>("fbs", value, fbsAdapter(fbsSerializer)),
		defineEntry<StringHeavy>("serio", value, serioAdapter(serioSerializer)),
		defineEntry("blink", value, blinkAdapter(blinkCodec)),
		defineEntry(
			"zap",
			value,
			zapAdapter((zap) => zap.Strings),
		),
	],
};
