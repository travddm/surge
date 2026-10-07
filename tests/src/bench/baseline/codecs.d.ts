/**
 * Declarations for the hand-written baseline codecs in `codecs.luau` next to
 * this file. Each shape is declared structurally, so a fixture's own sample
 * value is assignable without a second shape declaration -- and, unlike the
 * other columns, the shapes here are surge's own, because the baseline's job
 * is to write exactly the bytes surge writes.
 */
export interface BaselineCodec<T> {
	write: (value: T) => buffer;
	read: (buf: buffer) => T;
}

/** What a codec passes for a shape with values a buffer cannot hold: the bytes, and those values beside them, as surge does. */
export interface WithBlobs {
	buffer: buffer;
	blobs: Array<defined>;
}

/** A baseline codec for a shape with values a buffer cannot hold. */
export interface BaselineBlobCodec<T> {
	write: (value: T) => WithBlobs;
	read: (payload: WithBlobs) => T;
}

export declare const smallFlatStruct: BaselineCodec<{
	id: number;
	x: number;
	y: number;
	z: number;
	active: boolean;
}>;

export declare const nestedObject: BaselineCodec<{
	root: {
		inner: { inner: { leaf: { name: string; weight: number }; flag: boolean }; count: number };
		label: string;
	};
	version: number;
}>;

export declare const transforms: BaselineCodec<{ list: Array<CFrame> }>;

export declare const taggedUnion: BaselineCodec<{
	events: Array<
		| { kind: "spawn"; id: number; at: Vector3 }
		| { kind: "damage"; id: number; amount: number }
		| { kind: "chat"; id: number; text: string }
		| { kind: "despawn"; id: number }
	>;
}>;

export declare const packedToggles: BaselineCodec<{
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

export declare const leaderboard: BaselineCodec<{
	entries: Array<{ name: string; score: number; userId: number }>;
}>;

export declare const instanceRefs: BaselineBlobCodec<{ entries: Array<{ model: Instance; health: number }> }>;
