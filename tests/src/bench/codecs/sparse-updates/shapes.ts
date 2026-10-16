import type { DataType as Fbs } from "@rbxts/flamework-binary-serializer";
import type * as Serio from "@rbxts/serio";
import type { DataType } from "@rbxts/surge";

/** The literal union each update may carry, an index of one byte. */
export type State = "idle" | "walking" | "running" | "dead";

/**
 * An array of updates of which only some fields are present: an id, then four
 * optionals of different kinds, each a presence byte and, when present, its
 * value.
 */
export interface Update {
	id: DataType.u16;
	health?: DataType.u16;
	name?: string;
	position?: Vector3;
	state?: State;
}

export interface Updates {
	updates: Update[];
}

export interface FbsUpdates {
	updates: Array<{ id: Fbs.u16; health?: Fbs.u16; name?: string; position?: Vector3; state?: State }>;
}

export interface SerioUpdates {
	updates: Array<{ id: Serio.u16; health?: Serio.u16; name?: string; position?: Vector3; state?: State }>;
}
