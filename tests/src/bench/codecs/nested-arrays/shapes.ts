import type { DataType as Fbs } from "@rbxts/flamework-binary-serializer";
import type * as Serio from "@rbxts/serio";
import type { DataType } from "@rbxts/surge";

/**
 * Rows of different lengths, so no row has a size of its own: each writes its
 * count and its elements.
 */
export interface NestedArrays {
	rows: DataType.u16[][];
}

export interface FbsNestedArrays {
	rows: Fbs.u16[][];
}

export interface SerioNestedArrays {
	rows: Serio.u16[][];
}
