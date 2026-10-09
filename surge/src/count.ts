//!native
//!optimize 2
// The long forms of a variable-length count (Wire format 6.9 in docs/specs/wire-format.md). A
// count below 254 is one byte, which the generated code writes and reads inline. A larger one is a
// marker byte, then the count at the width the marker names. Only a count of 254 or more reaches
// these functions, so the inline path stays one comparison.

/** The marker of a count from 254 to 65535, which a `u16` follows. */
const U16_MARKER = 254;
/** The marker of a larger count, which a `u32` follows. */
const U32_MARKER = 255;

/** Writes `count`, at least 254, in its long form at `offset`: 3 bytes up to 65535, and 5 above. */
export function writeLongCount(target: buffer, offset: number, count: number): void {
	if (count <= 65535) {
		buffer.writeu8(target, offset, U16_MARKER);
		buffer.writeu16(target, offset + 1, count);
	} else {
		buffer.writeu8(target, offset, U32_MARKER);
		buffer.writeu32(target, offset + 1, count);
	}
}

/**
 * Reads the long form whose marker, 254 or 255, is the byte at `offset`, and returns the count and
 * the offset after it.
 */
// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple -- a real Luau multi-return, not a stored value.
export function readLongCount(source: buffer, offset: number, marker: number): LuaTuple<[count: number, end: number]> {
	if (marker === U16_MARKER) {
		// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple -- the sanctioned way to return one.
		return $tuple(buffer.readu16(source, offset + 1), offset + 3);
	}
	// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple -- the sanctioned way to return one.
	return $tuple(buffer.readu32(source, offset + 1), offset + 5);
}
