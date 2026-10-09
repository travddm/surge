//!native
//!optimize 2
import { Flamework, Serialization } from "@flamework-experimental/core";

interface Entity {
	a: Serialization.u8;
	b: Serialization.u8;
	c: Serialization.u8;
	d: Serialization.u8;
	e: Serialization.u8;
	f: Serialization.u8;
}

interface Entities {
	entities: Entity[];
}

export const flamework2Serializer = Flamework.createSerializer<Entities>();
