import { DataType, createBinarySerializer } from "@rbxts/surge";

import { defineFixture } from "../adapter";
import { surgeAdapter } from "../adapters/surge";

interface Leaf {
	name: string;
	weight: DataType.f32;
}

interface Third {
	leaf: Leaf;
	flag: boolean;
}

interface Second {
	inner: Third;
	count: DataType.u16;
}

interface First {
	inner: Second;
	label: string;
}

/** Five levels of objects: what nesting costs when no level repeats. */
interface NestedObject {
	root: First;
	version: DataType.u8;
}

const serializer = createBinarySerializer<NestedObject>();

export const nestedObject = defineFixture<NestedObject>(
	"deeply nested object",
	"five levels of objects, one field each level",
	{
		root: {
			inner: { inner: { leaf: { name: "leaf", weight: 0.5 }, flag: true }, count: 1200 },
			label: "root",
		},
		version: 3,
	},
	surgeAdapter(serializer),
);
