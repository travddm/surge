import type { DataType as Fbs } from "@rbxts/flamework-binary-serializer";
import type * as Serio from "@rbxts/serio";
import type { DataType } from "@rbxts/surge";

/**
 * Widths are explicit so a size delta reflects a format decision, not a
 * library's default. Each library brands its widths with its own type
 * aliases, which is why the shape is declared once per library over one
 * shared sample value.
 */
export interface SmallFlatStruct {
	id: DataType.u32;
	x: DataType.f32;
	y: DataType.f32;
	z: DataType.f32;
	active: boolean;
}

export interface FbsSmallFlatStruct {
	id: Fbs.u32;
	x: Fbs.f32;
	y: Fbs.f32;
	z: Fbs.f32;
	active: boolean;
}

export interface SerioSmallFlatStruct {
	id: Serio.u32;
	x: Serio.f32;
	y: Serio.f32;
	z: Serio.f32;
	active: boolean;
}
