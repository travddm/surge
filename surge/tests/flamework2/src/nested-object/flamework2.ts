//!native
//!optimize 2
import { Flamework, Serialization } from "@flamework-experimental/core";

interface Leaf {
	name: string;
	weight: Serialization.f32;
}

interface Third {
	leaf: Leaf;
	flag: boolean;
}

interface Second {
	inner: Third;
	count: Serialization.u16;
}

interface First {
	inner: Second;
	label: string;
}

interface NestedObject {
	root: First;
	version: Serialization.u8;
}

export const flamework2Serializer = Flamework.createSerializer<NestedObject>();
