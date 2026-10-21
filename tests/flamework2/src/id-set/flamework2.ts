//!native
//!optimize 2
import { Flamework, Serialization } from "@flamework-experimental/core";

interface IdSet {
	ids: Set<Serialization.u16>;
}

export const flamework2Serializer = Flamework.createSerializer<IdSet>();
