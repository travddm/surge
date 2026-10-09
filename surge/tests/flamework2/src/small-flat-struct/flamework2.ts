//!native
//!optimize 2
import { Flamework, Serialization } from "@flamework-experimental/core";

interface SmallFlatStruct {
	id: Serialization.u32;
	x: Serialization.f32;
	y: Serialization.f32;
	z: Serialization.f32;
	active: boolean;
}

export const flamework2Serializer = Flamework.createSerializer<SmallFlatStruct>();
