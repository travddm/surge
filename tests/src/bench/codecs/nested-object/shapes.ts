import type { DataType as Fbs } from "@rbxts/flamework-binary-serializer";
import type * as Serio from "@rbxts/serio";
import type { DataType } from "@rbxts/surge";

export interface Leaf {
	name: string;
	weight: DataType.f32;
}

export interface Third {
	leaf: Leaf;
	flag: boolean;
}

export interface Second {
	inner: Third;
	count: DataType.u16;
}

export interface First {
	inner: Second;
	label: string;
}

/** Five levels of objects: what nesting costs when no level repeats. */
export interface NestedObject {
	root: First;
	version: DataType.u8;
}

export interface FbsNestedObject {
	root: {
		inner: {
			inner: { leaf: { name: string; weight: Fbs.f32 }; flag: boolean };
			count: Fbs.u16;
		};
		label: string;
	};
	version: Fbs.u8;
}

export interface SerioNestedObject {
	root: {
		inner: {
			inner: { leaf: { name: string; weight: Serio.f32 }; flag: boolean };
			count: Serio.u16;
		};
		label: string;
	};
	version: Serio.u8;
}
