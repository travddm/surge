import type { DataType as Fbs } from "@rbxts/flamework-binary-serializer";
import type * as Serio from "@rbxts/serio";
import type { DataType } from "@rbxts/surge";

export interface LargeRecord {
	entries: Record<string, DataType.u8>;
}

/**
 * fbs and serio read an object's fields from the property list their
 * Flamework macro sees, which an index signature does not provide: both
 * reach a string-keyed table only as a `Map`. The two shapes therefore
 * differ, and the row compares surge's index signature against their map --
 * the same 200 pairs either way, so the byte counts stay comparable.
 */
export interface FbsLargeRecord {
	entries: Map<string, Fbs.u8>;
}

export interface SerioLargeRecord {
	entries: Map<string, Serio.u8>;
}
