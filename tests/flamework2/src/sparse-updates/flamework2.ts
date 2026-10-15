//!native
//!optimize 2
import { Flamework, Serialization } from "@flamework-experimental/core";

interface Update {
	id: Serialization.u16;
	health?: Serialization.u16;
	name?: string;
	position?: Vector3;
	state?: "idle" | "walking" | "running" | "dead";
}

interface Updates {
	updates: Update[];
}

export const flamework2Serializer = Flamework.createSerializer<Updates>();
