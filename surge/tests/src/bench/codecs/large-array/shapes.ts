import type { DataType as Fbs } from "@rbxts/flamework-binary-serializer";
import type * as Serio from "@rbxts/serio";
import type { DataType } from "@rbxts/surge";

export interface LargeArray {
	values: DataType.u16[];
}

export interface FbsLargeArray {
	values: Fbs.u16[];
}

/** serio's plain array is a `List` with a u32 length prefix, the width the other two also take. */
export interface SerioLargeArray {
	values: Serio.u16[];
}
