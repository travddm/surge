import { DataType, createBinarySerializer } from "@rbxts/surge";

import { Rng } from "../../support";
import { defineFixture } from "../adapter";
import { surgeAdapter } from "../adapters/surge";

const COUNT = 200;

interface LargeRecord {
	entries: Record<string, DataType.u8>;
}

const serializer = createBinarySerializer<LargeRecord>();

const rng = new Rng(9311);
const entries: Record<string, DataType.u8> = {};
for (const index of $range(1, COUNT)) {
	entries[`key${index}`] = rng.int(0, 255);
}

export const largeRecord = defineFixture<LargeRecord>(
	"large record",
	`${COUNT} string keys, each with a u8 value`,
	{ entries },
	surgeAdapter(serializer),
);
