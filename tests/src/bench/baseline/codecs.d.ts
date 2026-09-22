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
