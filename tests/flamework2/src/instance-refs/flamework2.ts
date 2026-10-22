//!native
//!optimize 2
import { Flamework, Serialization } from "@flamework-experimental/core";

interface InstanceRef {
	model: Instance;
	health: Serialization.u16;
}

interface InstanceRefs {
	entries: InstanceRef[];
}

export const flamework2Serializer = Flamework.createSerializer<InstanceRefs>();
