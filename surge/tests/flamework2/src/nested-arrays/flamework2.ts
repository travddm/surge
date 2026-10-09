//!native
//!optimize 2
import { Flamework, Serialization } from "@flamework-experimental/core";

interface NestedArrays {
	rows: Serialization.u16[][];
}

export const flamework2Serializer = Flamework.createSerializer<NestedArrays>();
