import { DataType, createBinarySerializer } from "@rbxts/surge";

import { defineFixture } from "../adapter";
import { surgeAdapter } from "../adapters/surge";

/**
 * 50 fixed-size fields: 100 of the 120 locals at which the emitter starts
 * wrapping an object's fields in blocks (Luau function-size limits in
 * docs/transformer.md), so this row is the widest struct that still compiles
 * to one straight run of writes.
 */
interface WideStruct {
	f1: DataType.f32;
	f2: DataType.f32;
	f3: DataType.f32;
	f4: DataType.f32;
	f5: DataType.f32;
	f6: DataType.f32;
	f7: DataType.f32;
	f8: DataType.f32;
	f9: DataType.f32;
	f10: DataType.f32;
	f11: DataType.f32;
	f12: DataType.f32;
	f13: DataType.f32;
	f14: DataType.f32;
	f15: DataType.f32;
	f16: DataType.f32;
	f17: DataType.f32;
	f18: DataType.f32;
	f19: DataType.f32;
	f20: DataType.f32;
	f21: DataType.f32;
	f22: DataType.f32;
	f23: DataType.f32;
	f24: DataType.f32;
	f25: DataType.f32;
	f26: DataType.f32;
	f27: DataType.f32;
	f28: DataType.f32;
	f29: DataType.f32;
	f30: DataType.f32;
	f31: DataType.f32;
	f32: DataType.f32;
	f33: DataType.f32;
	f34: DataType.f32;
	f35: DataType.f32;
	f36: DataType.f32;
	f37: DataType.f32;
	f38: DataType.f32;
	f39: DataType.f32;
	f40: DataType.f32;
	f41: DataType.f32;
	f42: DataType.f32;
	f43: DataType.f32;
	f44: DataType.f32;
	f45: DataType.f32;
	f46: DataType.f32;
	f47: DataType.f32;
	f48: DataType.f32;
	f49: DataType.f32;
	f50: DataType.f32;
}

const serializer = createBinarySerializer<WideStruct>();

const value: WideStruct = {
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

export const wideStruct = defineFixture<WideStruct>(
	"wide struct",
	"50 f32 fields, just under the emitter's block-split threshold",
	value,
	surgeAdapter(serializer),
);
