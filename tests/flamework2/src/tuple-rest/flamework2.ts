//!native
//!optimize 2
import { Flamework, Serialization } from "@flamework-experimental/core";

type Reading = [id: Serialization.u16, value: Serialization.f32, ...samples: Serialization.u8[]];

interface Readings {
	readings: Reading[];
}

export const flamework2Serializer = Flamework.createSerializer<Readings>();
