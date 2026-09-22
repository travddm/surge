import { DataType, createBinarySerializer } from "@rbxts/surge";

import { Rng } from "../../support";
import { defineFixture } from "../adapter";
import { surgeAdapter } from "../adapters/surge";

const COUNT = 1000;

interface LargeArray {
	values: DataType.u16[];
}

const serializer = createBinarySerializer<LargeArray>();

const rng = new Rng(4127);
const values = new Array<DataType.u16>();
for (const _ of $range(1, COUNT)) {
	values.push(rng.int(0, 65535));
}

export const largeArray = defineFixture<LargeArray>(
	"large array",
	`${COUNT} u16 elements behind one u32 length prefix`,
	{ values },
	surgeAdapter(serializer),
);
