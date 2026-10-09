//!native
//!optimize 2
import { Flamework, Serialization } from "@flamework-experimental/core";

type Sample = [id: Serialization.u16, x: Serialization.f32, y: Serialization.f32];

interface Samples {
	samples: Sample[];
}

export const flamework2Serializer = Flamework.createSerializer<Samples>();
