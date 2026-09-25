//!native
//!optimize 2
// Native code generation, and an optimization level pinned rather than inherited; neither is
// worth anything here on its own. See the package pragma entry in
// docs/future-work/generated-code-performance.md.
// Bit-packing for `boolean` values, `optional` presence, and two-variant
// tagged-union tags inside a `DataType.Packed<T>` subtree (section 8 of
// docs/specs/wire-format.md). The transformer
// knows at compile time exactly how many packed bits a subtree needs, so it
// reserves that many bytes once (like any other fixed-size field) and
// passes the resulting buffer/byte-offset here with a compile-time-known bit
// index within that region -- no separate cursor needed, since Luau's
// `buffer.writebits`/`readbits` already address an arbitrary bit offset
// directly.
//
// Only the read side calls into this module: the write side computes a whole
// packed byte from all its bits at once (one `writeu8` per byte), since a
// bit-at-a-time write left any unused high bits holding whatever an earlier
// `serialize()` call left in the reused scratch buffer.
//
// The packed `CFrame` form is in cframe.ts.

/** Reads a single packed bit at `byteOffset * 8 + bitIndex`. */
export function unpackBit(buf: buffer, byteOffset: number, bitIndex: number): boolean {
	return buffer.readbits(buf, byteOffset * 8 + bitIndex, 1) !== 0;
}
