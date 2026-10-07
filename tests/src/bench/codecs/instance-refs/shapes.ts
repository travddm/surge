import type { DataType as Fbs } from "@rbxts/flamework-binary-serializer";
import type * as Serio from "@rbxts/serio";
import type { DataType } from "@rbxts/surge";

/**
 * An `Instance` cannot go into a buffer, so each library passes it beside the
 * bytes: surge and fbs in a `blobs` array, serio in its `SerializedData`.
 * One per entry, so the row is mostly the cost of that side channel.
 */
export interface InstanceRef {
	model: Instance;
	health: DataType.u16;
}

export interface InstanceRefs {
	entries: InstanceRef[];
}

export interface FbsInstanceRefs {
	entries: Array<{ model: Instance; health: Fbs.u16 }>;
}

export interface SerioInstanceRefs {
	entries: Array<{ model: Instance; health: Serio.u16 }>;
}
