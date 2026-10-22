//!native
//!optimize 2
import { Flamework, Serialization } from "@flamework-experimental/core";

interface LargeArray {
	values: Serialization.u16[];
}

export const flamework2Serializer = Flamework.createSerializer<LargeArray>();
