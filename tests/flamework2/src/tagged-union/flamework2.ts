//!native
//!optimize 2
import { Flamework, Serialization } from "@flamework-experimental/core";

type Event =
	| { kind: "spawn"; id: Serialization.u32; at: Vector3 }
	| { kind: "damage"; id: Serialization.u32; amount: Serialization.u16 }
	| { kind: "chat"; id: Serialization.u32; text: string }
	| { kind: "despawn"; id: Serialization.u32 };

interface TaggedUnion {
	events: Event[];
}

export const flamework2Serializer = Flamework.createSerializer<TaggedUnion>();
