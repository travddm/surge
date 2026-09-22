import { DataType, createBinarySerializer } from "@rbxts/surge";

import { defineFixture } from "../adapter";
import { surgeAdapter } from "../adapters/surge";

/**
 * The same shape twice, so the two rows differ only in `Packed<T>`: ten
 * booleans and two optionals are twelve bytes apart from each other unpacked,
 * and twelve bits packed.
 */
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
	level: DataType.u8;
	label?: string;
	offset?: DataType.i16;
}

const unpackedSerializer = createBinarySerializer<Toggles>();
const packedSerializer = createBinarySerializer<DataType.Packed<Toggles>>();

const value: Toggles = {
	a: true,
	b: false,
	c: true,
	d: true,
	e: false,
	f: false,
	g: true,
	h: false,
	i: true,
	j: true,
	level: 7,
	label: "toggles",
	offset: -300,
};

export const unpackedStruct = defineFixture<Toggles>(
	"toggles (unpacked)",
	"ten booleans, a u8, and two optionals, one byte per flag and per presence",
	value,
	surgeAdapter(unpackedSerializer),
);

export const packedStruct = defineFixture<DataType.Packed<Toggles>>(
	"toggles (packed)",
	"the same shape in `Packed<T>`: one bit per flag and per presence",
	value,
	surgeAdapter(packedSerializer),
);
