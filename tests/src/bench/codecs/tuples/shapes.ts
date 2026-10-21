import type { DataType as Fbs } from "@rbxts/flamework-binary-serializer";
import type * as Serio from "@rbxts/serio";
import type { DataType } from "@rbxts/surge";

/**
 * An array of tuples of fixed-size elements: an id and a two-component
 * reading. Blink and Zap have no cell: neither has a tuple type.
 */
export type Sample = [id: DataType.u16, x: DataType.f32, y: DataType.f32];

export interface Samples {
	samples: Sample[];
}

export interface FbsSamples {
	samples: Array<[id: Fbs.u16, x: Fbs.f32, y: Fbs.f32]>;
}

export interface SerioSamples {
	samples: Array<[id: Serio.u16, x: Serio.f32, y: Serio.f32]>;
}
