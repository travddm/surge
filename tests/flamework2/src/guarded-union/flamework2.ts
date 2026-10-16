//!native
//!optimize 2
import { Flamework } from "@flamework-experimental/core";

interface GuardedUnion {
	values: Array<string | number | boolean>;
}

export const flamework2Serializer = Flamework.createSerializer<GuardedUnion>();
