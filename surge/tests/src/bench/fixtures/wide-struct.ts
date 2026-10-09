//!native
//!optimize 2
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { blinkAdapter } from "../adapters/blink";
import { fbsAdapter } from "../adapters/fbs";
import { flamework2Adapter } from "../adapters/flamework2";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { zapAdapter } from "../adapters/zap";
import { WideStruct as blinkCodec } from "../blink/server";
import { fbsSerializer } from "../codecs/wide-struct/fbs";
import { flamework2Serializer } from "../codecs/wide-struct/flamework2";
import { serioSerializer } from "../codecs/wide-struct/serio";
import type { FbsWideStruct, SerioWideStruct, WideStruct } from "../codecs/wide-struct/shapes";
import { serializer } from "../codecs/wide-struct/surge";

const value = {
	f1: 1.5,
	f2: 2.5,
	f3: 3.5,
	f4: 4.5,
	f5: 5.5,
	f6: 6.5,
	f7: 7.5,
	f8: 8.5,
	f9: 9.5,
	f10: 10.5,
	f11: 11.5,
	f12: 12.5,
	f13: 13.5,
	f14: 14.5,
	f15: 15.5,
	f16: 16.5,
	f17: 17.5,
	f18: 18.5,
	f19: 19.5,
	f20: 20.5,
	f21: 21.5,
	f22: 22.5,
	f23: 23.5,
	f24: 24.5,
	f25: 25.5,
	f26: 26.5,
	f27: 27.5,
	f28: 28.5,
	f29: 29.5,
	f30: 30.5,
	f31: 31.5,
	f32: 32.5,
	f33: 33.5,
	f34: 34.5,
	f35: 35.5,
	f36: 36.5,
	f37: 37.5,
	f38: 38.5,
	f39: 39.5,
	f40: 40.5,
	f41: 41.5,
	f42: 42.5,
	f43: 43.5,
	f44: 44.5,
	f45: 45.5,
	f46: 46.5,
	f47: 47.5,
	f48: 48.5,
	f49: 49.5,
	f50: 50.5,
};

export const wideStruct: Fixture = {
	name: "wide struct",
	note: "50 f32 fields, no container",
	entries: [
		defineEntry<WideStruct>("surge", value, surgeAdapter(serializer)),
		defineEntry<FbsWideStruct>("fbs", value, fbsAdapter(fbsSerializer)),
		defineEntry<SerioWideStruct>("serio", value, serioAdapter(serioSerializer)),
		defineEntry<WideStruct>("flamework2", value, flamework2Adapter(flamework2Serializer)),
		defineEntry("blink", value, blinkAdapter(blinkCodec)),
		defineEntry(
			"zap",
			value,
			zapAdapter((zap) => zap.Wide),
		),
	],
};
