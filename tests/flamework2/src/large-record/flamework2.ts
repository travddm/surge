//!native
//!optimize 2
import { Flamework, Serialization } from "@flamework-experimental/core";

interface LargeRecord {
	entries: Record<string, Serialization.u8>;
}

export const flamework2Serializer = Flamework.createSerializer<LargeRecord>();
