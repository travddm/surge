// The signatures of the real `@rbxts/surge/out/abi`, the helpers generated
// code calls, so a test can type-check transformed output the way roblox-ts
// does. Declarations only: nothing here runs.
//
// Reserving bytes is not among them: a generated serializer keeps its own
// buffer and cursors and does that inline, so the write-side exports left are
// the cold ones: growth, the copy out, and the long forms of a count.
export declare function grow(current: buffer, live: number, needed: number): buffer;
export declare function finishWrite(written: buffer, size: number): buffer;
export declare function beginWriteBlobs(): void;
export declare function pushBlob(value: defined): void;
export declare function finishWriteBlobs(): Array<defined>;
export declare function beginReadBlobs(blobs: Array<defined> | undefined): void;
export declare function nextBlob(): defined;
export declare function writePackedCFrame(buf: buffer, pos: number, value: CFrame): number;
export declare function readPackedCFrame(buf: buffer, pos: number): LuaTuple<[value: CFrame, size: number]>;
export declare function writeLongCount(target: buffer, offset: number, count: number): number;
export declare function writeLongString(target: buffer, offset: number, source: string, len: number): number;
export declare function writeLongBuffer(target: buffer, offset: number, source: buffer, len: number): number;
export declare function growLongCount(
	target: buffer,
	capacity: number,
	offset: number,
	count: number,
): LuaTuple<[target: buffer, capacity: number, end: number]>;
export declare function growLongString(
	target: buffer,
	capacity: number,
	offset: number,
	source: string,
	len: number,
): LuaTuple<[target: buffer, capacity: number, end: number]>;
export declare function growLongBuffer(
	target: buffer,
	capacity: number,
	offset: number,
	source: buffer,
	len: number,
): LuaTuple<[target: buffer, capacity: number, end: number]>;
export declare function readLongCount(
	source: buffer,
	offset: number,
	marker: number,
): LuaTuple<[count: number, end: number]>;
