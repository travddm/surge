//!native
//!optimize 2
import { Flamework } from "@flamework-experimental/core";

interface Booleans {
	values: boolean[];
}

export const flamework2Serializer = Flamework.createSerializer<Booleans>();
