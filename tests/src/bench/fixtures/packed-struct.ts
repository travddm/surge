import { DataType as Fbs, createBinarySerializer as createFbsSerializer } from "@rbxts/flamework-binary-serializer";
import createSerioSerializer from "@rbxts/serio";
import type * as Serio from "@rbxts/serio";
import { DataType, createBinarySerializer } from "@rbxts/surge";

import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { blinkAdapter } from "../adapters/blink";
import { fbsAdapter } from "../adapters/fbs";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { Toggles as blinkCodec } from "../blink/server";

/**
 * The same shape twice, so the two rows differ only in `Packed<T>`: ten
 * booleans and two optionals are twelve bytes apart from each other unpacked,
 * and twelve bits packed. All three libraries have a `Packed<T>`; surge puts
 * its bits in a region per object, fbs and serio in one stream at the head of
 * the buffer.
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

interface FbsToggles {
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

interface SerioToggles {
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

const unpackedSerializer = createBinarySerializer<Toggles>();
const packedSerializer = createBinarySerializer<DataType.Packed<Toggles>>();
const fbsUnpackedSerializer = createFbsSerializer<FbsToggles>();
const fbsPackedSerializer = createFbsSerializer<Fbs.Packed<FbsToggles>>();
const serioUnpackedSerializer = createSerioSerializer<SerioToggles>();
const serioPackedSerializer = createSerioSerializer<Serio.Packed<SerioToggles>>();

const value = {
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

export const unpackedStruct: Fixture = {
	name: "toggles (unpacked)",
	note: "ten booleans, a u8, and two optionals, one byte per flag and per presence",
	entries: [
		defineEntry<Toggles>("surge", value, surgeAdapter(unpackedSerializer)),
		defineEntry<FbsToggles>("fbs", value, fbsAdapter(fbsUnpackedSerializer)),
		defineEntry<SerioToggles>("serio", value, serioAdapter(serioUnpackedSerializer)),
		defineEntry("blink", value, blinkAdapter(blinkCodec)),
	],
};

export const packedStruct: Fixture = {
	name: "toggles (packed)",
	note: "the same shape in `Packed<T>`: one bit per flag and per presence",
	entries: [
		defineEntry<DataType.Packed<Toggles>>("surge", value, surgeAdapter(packedSerializer)),
		defineEntry<Fbs.Packed<FbsToggles>>("fbs", value, fbsAdapter(fbsPackedSerializer)),
		defineEntry<Serio.Packed<SerioToggles>>("serio", value, serioAdapter(serioPackedSerializer)),
	],
};
