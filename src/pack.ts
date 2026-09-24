//!native
//!optimize 2
// Native code generation, and an optimization level pinned rather than inherited; neither is
// worth anything here on its own. See the package pragma entry in
// docs/future-work/generated-code-performance.md.
// Bit-packing for `boolean` values, `optional` presence, and two-variant
// tagged-union tags inside a `DataType.Packed<T>` subtree (section 8 of
// docs/specs/wire-format.md). The transformer
// knows at compile time exactly how many packed bits a subtree needs, so it
// `alloc()`s that many bytes once (like any other fixed-size field) and
// passes the resulting buffer/byte-offset here with a compile-time-known bit
// index within that region -- no separate cursor needed, since Luau's
// `buffer.writebits`/`readbits` already address an arbitrary bit offset
// directly.
//
// The transformer only emits calls into `unpackBit` now: the write side
// computes a whole packed byte from all its bits at once (one `writeu8`
// per byte) instead of one `packBit` call per bit, since a bit-at-a-time
// write left any unused high bits holding whatever an earlier `serialize()`
// call left in the reused scratch buffer. `packBit` is kept as a public
// primitive for hand-written callers -- it is otherwise unused by
// generated code.
//
// The packed `CFrame` form is in cframe.ts.

/** Writes a single packed bit at `byteOffset * 8 + bitIndex`. */
export function packBit(buf: buffer, byteOffset: number, bitIndex: number, value: boolean): void {
	buffer.writebits(buf, byteOffset * 8 + bitIndex, 1, value ? 1 : 0);
}

/** Reads a single packed bit at `byteOffset * 8 + bitIndex`. */
export function unpackBit(buf: buffer, byteOffset: number, bitIndex: number): boolean {
	return buffer.readbits(buf, byteOffset * 8 + bitIndex, 1) !== 0;
}
