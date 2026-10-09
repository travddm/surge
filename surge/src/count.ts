//!native
//!optimize 2
// The long forms of a variable-length count (Wire format 6.9 in docs/specs/wire-format.md). A
// count below 254 is one byte, which the generated code writes and reads inline. A larger one is a
// marker byte, then the count at the width the marker names. Only a count of 254 or more reaches
// these functions, so the inline path stays one comparison, and the long form, with the
// reservation and the bytes after it, is one call in the generated code.
//
// The `write` functions write into a buffer sized for the whole value. The `grow` functions write
// into a scratch buffer of `capacity` bytes, which they grow first where the long form and the
// bytes after it do not fit, and return the buffer and its capacity with the offset.
import { grow } from "./alloc";

/** The marker of a count from 254 to 65535, which a `u16` follows. */
const U16_MARKER = 254;
/** The marker of a larger count, which a `u32` follows. */
const U32_MARKER = 255;
/** The largest count the `u16` form holds. */
const U16_MAX = 65535;

/** A scratch buffer and its capacity, after a reservation that may have grown it. */
// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple -- a real Luau multi-return, not a stored value.
type Reserved = LuaTuple<[target: buffer, capacity: number]>;
/** A scratch buffer, its capacity, and the offset after what was written into it. */
// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple -- a real Luau multi-return, not a stored value.
type Written = LuaTuple<[target: buffer, capacity: number, end: number]>;

/**
 * Writes `count`, at least 254, in its long form at `offset`: 3 bytes up to 65535, and 5 above.
 * Returns the offset after it.
 */
export function writeLongCount(target: buffer, offset: number, count: number): number {
	if (count <= U16_MAX) {
		buffer.writeu8(target, offset, U16_MARKER);
		buffer.writeu16(target, offset + 1, count);
		return offset + 3;
	}
	buffer.writeu8(target, offset, U32_MARKER);
	buffer.writeu32(target, offset + 1, count);
	return offset + 5;
}

/** Writes `source`, of `len` bytes, at least 254, after its count, and returns the offset after it. */
export function writeLongString(target: buffer, offset: number, source: string, len: number): number {
	const at = writeLongCount(target, offset, len);
	buffer.writestring(target, at, source);
	return at + len;
}

/** Writes `source`, of `len` bytes, at least 254, after its count, and returns the offset after it. */
export function writeLongBuffer(target: buffer, offset: number, source: buffer, len: number): number {
	const at = writeLongCount(target, offset, len);
	buffer.copy(target, at, source, 0, len);
	return at + len;
}

/**
 * Grows `target` where the long form of `count` and the `bytes` after it run past `capacity`, and
 * returns the buffer and its capacity.
 */
function reserve(target: buffer, capacity: number, offset: number, count: number, bytes: number): Reserved {
	const needed = offset + (count <= U16_MAX ? 3 : 5) + bytes;
	if (needed > capacity) {
		return grow(target, offset, needed);
	}
	// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple -- the sanctioned way to return one.
	return $tuple(target, capacity);
}

/** {@link writeLongCount} into a scratch buffer of `capacity` bytes. */
export function growLongCount(target: buffer, capacity: number, offset: number, count: number): Written {
	[target, capacity] = reserve(target, capacity, offset, count, 0);
	// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple -- the sanctioned way to return one.
	return $tuple(target, capacity, writeLongCount(target, offset, count));
}

/** {@link writeLongString} into a scratch buffer of `capacity` bytes. */
export function growLongString(target: buffer, capacity: number, offset: number, source: string, len: number): Written {
	[target, capacity] = reserve(target, capacity, offset, len, len);
	// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple -- the sanctioned way to return one.
	return $tuple(target, capacity, writeLongString(target, offset, source, len));
}

/** {@link writeLongBuffer} into a scratch buffer of `capacity` bytes. */
export function growLongBuffer(target: buffer, capacity: number, offset: number, source: buffer, len: number): Written {
	[target, capacity] = reserve(target, capacity, offset, len, len);
	// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple -- the sanctioned way to return one.
	return $tuple(target, capacity, writeLongBuffer(target, offset, source, len));
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
