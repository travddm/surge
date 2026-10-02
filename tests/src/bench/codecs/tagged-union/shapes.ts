import type { DataType as Fbs } from "@rbxts/flamework-binary-serializer";
import type * as Serio from "@rbxts/serio";
import type { DataType } from "@rbxts/surge";

export type Event =
	| { kind: "spawn"; id: DataType.u32; at: Vector3 }
	| { kind: "damage"; id: DataType.u32; amount: DataType.u16 }
	| { kind: "chat"; id: DataType.u32; text: string }
	| { kind: "despawn"; id: DataType.u32 };

export interface TaggedUnion {
	events: Event[];
}

export type FbsEvent =
	| { kind: "spawn"; id: Fbs.u32; at: Vector3 }
	| { kind: "damage"; id: Fbs.u32; amount: Fbs.u16 }
	| { kind: "chat"; id: Fbs.u32; text: string }
	| { kind: "despawn"; id: Fbs.u32 };

export interface FbsTaggedUnion {
	events: FbsEvent[];
}

export type SerioEvent =
	| { kind: "spawn"; id: Serio.u32; at: Vector3 }
	| { kind: "damage"; id: Serio.u32; amount: Serio.u16 }
	| { kind: "chat"; id: Serio.u32; text: string }
	| { kind: "despawn"; id: Serio.u32 };

export interface SerioTaggedUnion {
	events: SerioEvent[];
}
