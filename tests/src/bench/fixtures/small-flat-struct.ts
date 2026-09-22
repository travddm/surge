import { DataType, createBinarySerializer } from "@rbxts/surge";

import { defineFixture } from "../adapter";
import { surgeAdapter } from "../adapters/surge";

/** Widths are explicit so a size delta reflects a format decision, not a library's default. */
interface SmallFlatStruct {
	id: DataType.u32;
	x: DataType.f32;
	y: DataType.f32;
	z: DataType.f32;
	active: boolean;
}

const serializer = createBinarySerializer<SmallFlatStruct>();

export const smallFlatStruct = defineFixture<SmallFlatStruct>(
	"small flat struct",
	"five fixed-size fields, no container",
	{ id: 4_000_000, x: 1.5, y: -2.25, z: 0.125, active: true },
	surgeAdapter(serializer),
);
