/**
 * Hand-written declarations for the Zap server module `server.luau` next to
 * this file, which `mise run bench:definitions` generates from
 * ../definitions/catalog.zap.
 *
 * Zap emits TypeScript definitions of its own, but they describe the event
 * layer this benchmark deliberately does not use: every row here is fired at
 * the mocked remote the Lune shim provides and measured out of what
 * `SendEvents` flushes, because Zap exposes no encoder (see
 * docs/future-work/benchmark-tooling.md). So these declarations cover exactly
 * that -- `Fire` and `SendEvents` -- and name each shape structurally, so a
 * fixture's own sample value is assignable without a second shape
 * declaration.
 *
 * `Fire` takes the player to send to. Nothing here is a real player: Zap uses
 * the value only as a table key for that player's outgoing buffer, and the
 * mocked remote ignores it.
 */
export interface ZapEvent<T> {
	Fire: (player: defined, value: T) => void;
}

/** Flushes every queued event into the remote. `opt manual_event_loop` is what exposes it. */
export declare const SendEvents: () => void;

export declare const SmallFlat: ZapEvent<{
	id: number;
	x: number;
	y: number;
	z: number;
	active: boolean;
}>;

export declare const Nested: ZapEvent<{
	root: {
		inner: { inner: { leaf: { name: string; weight: number }; flag: boolean }; count: number };
		label: string;
	};
	version: number;
}>;

export declare const Wide: ZapEvent<{
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

export declare const Large: ZapEvent<{ values: Array<number> }>;

export declare const Record: ZapEvent<{ entries: Record<string, number> }>;

export declare const Strings: ZapEvent<{ title: string; author: string; lines: Array<string> }>;

export declare const Tagged: ZapEvent<{
	events: Array<
		| { kind: "spawn"; id: number; at: vector }
		| { kind: "damage"; id: number; amount: number }
		| { kind: "chat"; id: number; text: string }
		| { kind: "despawn"; id: number }
	>;
}>;

export declare const Guarded: ZapEvent<{ values: Array<string | number | boolean> }>;

export declare const Flags: ZapEvent<{
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

export declare const Frames: ZapEvent<{ list: Array<CFrame> }>;

export declare const Bools: ZapEvent<{ values: Array<boolean> }>;

export declare const Ents: ZapEvent<{
	entities: Array<{ a: number; b: number; c: number; d: number; e: number; f: number }>;
}>;
