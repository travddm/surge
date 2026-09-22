/**
 * Hand-written declarations for the Blink server module `server.luau` next to
 * this file, which `mise run bench:definitions` generates from
 * ../definitions/catalog.blink.
 *
 * Not Blink's own `option Typescript` output: at 0.18.8 that file declares each
 * export with `declare const` and never exports it, so nothing in it can be
 * imported. These declarations cover only what the adapter uses -- one
 * `Write`/`Read` pair per exported type -- and name each shape structurally, so
 * a fixture's own sample value is assignable without a second shape
 * declaration.
 */
export interface BlinkCodec<T> {
	Read: (buffer: buffer) => T;
	Write: (value: T) => buffer;
}

export declare const SmallFlatStruct: BlinkCodec<{
	id: number;
	x: number;
	y: number;
	z: number;
	active: boolean;
}>;

export declare const NestedObject: BlinkCodec<{
	root: {
		inner: { inner: { leaf: { name: string; weight: number }; flag: boolean }; count: number };
		label: string;
	};
	version: number;
}>;

export declare const WideStruct: BlinkCodec<{
	f1: number;
	f2: number;
	f3: number;
	f4: number;
	f5: number;
	f6: number;
	f7: number;
	f8: number;
	f9: number;
	f10: number;
	f11: number;
	f12: number;
	f13: number;
	f14: number;
	f15: number;
	f16: number;
	f17: number;
	f18: number;
	f19: number;
	f20: number;
	f21: number;
	f22: number;
	f23: number;
	f24: number;
	f25: number;
	f26: number;
	f27: number;
	f28: number;
	f29: number;
	f30: number;
	f31: number;
	f32: number;
	f33: number;
	f34: number;
	f35: number;
	f36: number;
	f37: number;
	f38: number;
	f39: number;
	f40: number;
	f41: number;
	f42: number;
	f43: number;
	f44: number;
	f45: number;
	f46: number;
	f47: number;
	f48: number;
	f49: number;
	f50: number;
}>;

export declare const LargeArray: BlinkCodec<{ values: Array<number> }>;

export declare const LargeRecord: BlinkCodec<{ entries: Record<string, number> }>;

export declare const StringHeavy: BlinkCodec<{ title: string; author: string; lines: Array<string> }>;

export declare const TaggedUnion: BlinkCodec<{
	events: Array<
		| { kind: "spawn"; id: number; at: Vector3 }
		| { kind: "damage"; id: number; amount: number }
		| { kind: "chat"; id: number; text: string }
		| { kind: "despawn"; id: number }
	>;
}>;

export declare const Toggles: BlinkCodec<{
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
	level: number;
	label?: string;
	offset?: number;
}>;

export declare const Transforms: BlinkCodec<{ list: Array<CFrame> }>;

export declare const Booleans: BlinkCodec<{ values: Array<boolean> }>;

export declare const Entities: BlinkCodec<{
	entities: Array<{ a: number; b: number; c: number; d: number; e: number; f: number }>;
}>;
