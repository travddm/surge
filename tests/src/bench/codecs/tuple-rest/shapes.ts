import type { DataType as Fbs } from "@rbxts/flamework-binary-serializer";
import type { DataType } from "@rbxts/surge";

/**
 * An array of tuples that end in a rest element: an id and a reading, then a
 * run of samples of the tuple's own length. serio writes a rest's count as a
 * u16 and reads it as a u32, so it has no cell; Blink and Zap have no tuple
 * with a rest.
 */
export type Reading = [id: DataType.u16, value: DataType.f32, ...samples: DataType.u8[]];

export interface Readings {
	readings: Reading[];
}

export interface FbsReadings {
	readings: Array<[id: Fbs.u16, value: Fbs.f32, ...samples: Fbs.u8[]]>;
}
