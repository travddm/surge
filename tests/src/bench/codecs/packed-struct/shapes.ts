import type { DataType as Fbs } from "@rbxts/flamework-binary-serializer";
import type * as Serio from "@rbxts/serio";
import type { DataType } from "@rbxts/surge";

/**
 * The same shape twice, so the two rows differ only in `Packed<T>`: ten
 * booleans and two optionals are twelve bytes apart from each other unpacked,
 * and twelve bits packed. All three libraries have a `Packed<T>`; surge puts
 * its bits in a region per object, fbs and serio in one stream at the head of
 * the buffer.
 */
export interface Toggles {
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
	level: DataType.u8;
	label?: string;
	offset?: DataType.i16;
}

export interface FbsToggles {
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
	level: Fbs.u8;
	label?: string;
	offset?: Fbs.i16;
}

export interface SerioToggles {
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
	level: Serio.u8;
	label?: string;
	offset?: Serio.i16;
}
