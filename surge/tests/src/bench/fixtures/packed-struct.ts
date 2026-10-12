//!native
//!optimize 2
import type { DataType as Fbs } from "@rbxts/flamework-binary-serializer";
import type * as Serio from "@rbxts/serio";
import type { DataType } from "@rbxts/surge";

import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { baselineAdapter } from "../adapters/baseline";
import { blinkAdapter } from "../adapters/blink";
import { fbsAdapter } from "../adapters/fbs";
import { flamework2Adapter } from "../adapters/flamework2";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { cursorAdapter } from "../adapters/surge-cursor";
import { zapAdapter } from "../adapters/zap";
import { packedToggles as baselineCodec } from "../baseline/codecs";
import { Toggles as blinkCodec } from "../blink/server";
import { fbsPackedSerializer } from "../codecs/packed-struct/fbs-packed";
import { fbsUnpackedSerializer } from "../codecs/packed-struct/fbs-unpacked";
import { flamework2Serializer as flamework2UnpackedSerializer } from "../codecs/packed-struct/flamework2-unpacked";
import { serioPackedSerializer } from "../codecs/packed-struct/serio-packed";
import { serioUnpackedSerializer } from "../codecs/packed-struct/serio-unpacked";
import type { FbsToggles, SerioToggles, Toggles } from "../codecs/packed-struct/shapes";
import { packedSerializer } from "../codecs/packed-struct/surge-packed";
import { checkedPackedSerializer } from "../codecs/packed-struct/surge-packed-checked";
import { cursorPackedSerializer } from "../codecs/packed-struct/surge-packed-cursor";
import { unpackedSerializer } from "../codecs/packed-struct/surge-unpacked";
import { checkedUnpackedSerializer } from "../codecs/packed-struct/surge-unpacked-checked";
import { cursorUnpackedSerializer } from "../codecs/packed-struct/surge-unpacked-cursor";

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
		defineEntry<Toggles>("surge (cursor)", value, cursorAdapter(cursorUnpackedSerializer)),
		defineEntry<Toggles>("surge (readChecks)", value, surgeAdapter(checkedUnpackedSerializer)),
		defineEntry<FbsToggles>("fbs", value, fbsAdapter(fbsUnpackedSerializer)),
		defineEntry<SerioToggles>("serio", value, serioAdapter(serioUnpackedSerializer)),
		defineEntry<Toggles>("flamework2", value, flamework2Adapter(flamework2UnpackedSerializer)),
		defineEntry("blink", value, blinkAdapter(blinkCodec)),
	],
};

export const packedStruct: Fixture = {
	name: "toggles (packed)",
	note: "the same shape in `Packed<T>`: one bit per flag and per presence",
	entries: [
		defineEntry<DataType.Packed<Toggles>>("surge", value, surgeAdapter(packedSerializer)),
		defineEntry<DataType.Packed<Toggles>>("surge (cursor)", value, cursorAdapter(cursorPackedSerializer)),
		defineEntry<DataType.Packed<Toggles>>("surge (readChecks)", value, surgeAdapter(checkedPackedSerializer)),
		defineEntry<Fbs.Packed<FbsToggles>>("fbs", value, fbsAdapter(fbsPackedSerializer)),
		defineEntry<Serio.Packed<SerioToggles>>("serio", value, serioAdapter(serioPackedSerializer)),
		defineEntry(
			"zap",
			value,
			zapAdapter((zap) => zap.Flags),
		),
		defineEntry("baseline", value, baselineAdapter(baselineCodec)),
	],
};
