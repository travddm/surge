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
import { StringHeavy as blinkCodec } from "../blink/server";
import { fbsSerializer } from "../codecs/string-heavy/fbs";
import { flamework2Serializer } from "../codecs/string-heavy/flamework2";
import { serioSerializer } from "../codecs/string-heavy/serio";
import type { StringHeavy } from "../codecs/string-heavy/shapes";
import { serializer } from "../codecs/string-heavy/surge";

const COUNT = 100;

const rng = new Rng(2207);
const lines = new Array<string>();
for (const _ of $range(1, COUNT)) {
	lines.push(rng.str(40));
}

const value: StringHeavy = { title: "a chapter", author: "someone", lines };

export const stringHeavy: Fixture = {
	name: "string-heavy",
	note: `two short strings and ${COUNT} of up to 40 bytes, each with a count of its bytes`,
	entries: [
		defineEntry<StringHeavy>("surge", value, surgeAdapter(serializer)),
		defineEntry<StringHeavy>("fbs", value, fbsAdapter(fbsSerializer)),
		defineEntry<StringHeavy>("serio", value, serioAdapter(serioSerializer)),
		defineEntry<StringHeavy>("flamework2", value, flamework2Adapter(flamework2Serializer)),
		defineEntry("blink", value, blinkAdapter(blinkCodec)),
		defineEntry(
			"zap",
			value,
			zapAdapter((zap) => zap.Strings),
		),
	],
};
