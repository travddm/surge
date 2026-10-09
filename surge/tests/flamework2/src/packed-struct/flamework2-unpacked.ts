//!native
//!optimize 2
import { Flamework, Serialization } from "@flamework-experimental/core";

interface Toggles {
	a: boolean;
	b: boolean;
	c: boolean;
	d: boolean;
	e: boolean;
	f: boolean;
	g: boolean;
	h: boolean;
	i: boolean;
	j: boolean;
	level: Serialization.u8;
	label?: string;
	offset?: Serialization.i16;
}

export const flamework2Serializer = Flamework.createSerializer<Toggles>();
