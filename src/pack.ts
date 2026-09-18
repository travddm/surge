// Bit-packing for `boolean`/`optional` fields inside a `DataType.Packed<T>`
// subtree (Type Coverage -> Packed<T> in transformer.md). The transformer
// knows at compile time exactly how many packed bits a subtree needs, so it
// `alloc()`s that many bytes once (like any other fixed-size field) and
// passes the resulting buffer/byte-offset here with a compile-time-known bit
// index within that region -- no separate cursor needed, since Luau's
// `buffer.writebits`/`readbits` already address an arbitrary bit offset
// directly.
//
// The `CFrame` axis-aligned-rotation / zero-vector packed size optimization
// described in transformer.md is not implemented here: `Packed<T>` CFrame
// fields currently fall back to the same 6xf32 encoding used outside
// `Packed<T>`. See docs/future-work/ (or the follow-up noted in
// transformer.md) before relying on packed CFrames being smaller than
// unpacked ones.

/** Writes a single packed bit at `byteOffset * 8 + bitIndex`. */
export function packBit(buf: buffer, byteOffset: number, bitIndex: number, value: boolean): void {
	buffer.writebits(buf, byteOffset * 8 + bitIndex, 1, value ? 1 : 0);
}

/** Reads a single packed bit at `byteOffset * 8 + bitIndex`. */
export function unpackBit(buf: buffer, byteOffset: number, bitIndex: number): boolean {
	return buffer.readbits(buf, byteOffset * 8 + bitIndex, 1) !== 0;
}
