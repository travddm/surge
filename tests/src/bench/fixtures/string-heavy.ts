import { createBinarySerializer } from "@rbxts/surge";

import { Rng } from "../../support";
import { defineFixture } from "../adapter";
import { surgeAdapter } from "../adapters/surge";

const COUNT = 100;

interface StringHeavy {
	title: string;
	author: string;
	lines: string[];
}

const serializer = createBinarySerializer<StringHeavy>();

const rng = new Rng(2207);
const lines = new Array<string>();
for (const _ of $range(1, COUNT)) {
	lines.push(rng.str(40));
}

export const stringHeavy = defineFixture<StringHeavy>(
	"string-heavy",
	`two short strings and ${COUNT} of up to 40 bytes, each with a u32 length prefix`,
	{ title: "a chapter", author: "someone", lines },
	surgeAdapter(serializer),
);
