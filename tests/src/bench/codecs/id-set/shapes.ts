import type { DataType as Fbs } from "@rbxts/flamework-binary-serializer";
import type * as Serio from "@rbxts/serio";
import type { DataType } from "@rbxts/surge";

/**
 * A set of ids: a count, then each member. Blink's set is a flag per member
 * of a list fixed in its definition, which a set of ids is not.
 */
export interface IdSet {
	ids: Set<DataType.u16>;
}

export interface FbsIdSet {
	ids: Set<Fbs.u16>;
}

export interface SerioIdSet {
	ids: Set<Serio.u16>;
}
