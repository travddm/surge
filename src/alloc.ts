//!native
//!optimize 2
// Two Luau file pragmas. Both are honoured anywhere ahead of the first line of code, not only on
// line 1. Native code generation buys nothing by itself: these functions are a cursor bump, so
// almost no work sits inside the native region, and the code that does the writing is generated
// into the caller's file. `optimize 2` pins the optimization level instead of inheriting the
// host's default, which is 1 in Luau and reported to be 2 in a published place, so a profile
// taken in Studio matches one taken live; it measured at 1.00x here either way. Kept because this
// is surge's own code and neither costs anything to carry. See Native code generation in
// docs/future-work/generated-code-performance.md.
// The single module-scoped scratch buffer every generated `write` function
// shares (Transformer Design §4 in transformer.md). Growing it here, once,
// keeps every generated serializer flat -- none of them branch on capacity.
let scratch = buffer.create(64);
let writeCursor = 0;

let input = buffer.create(0);
let readCursor = 0;

function growTo(size: number): void {
	let capacity = buffer.len(scratch);
	if (capacity >= size) {
		return;
	}
	while (capacity < size) {
		capacity *= 2;
	}
	const grown = buffer.create(capacity);
	buffer.copy(grown, 0, scratch, 0, writeCursor);
	scratch = grown;
}

/**
 * Reserves `size` bytes at the write cursor, growing the scratch buffer if
 * needed, and returns both the buffer to write into and the offset to write
 * at. Returned as a real Luau multi-return (no table allocation) so
 * generated code can destructure it directly at the call site.
 */
// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple -- a real Luau multi-return, not a stored value; see the doc comment above.
export function alloc(size: number): LuaTuple<[buf: buffer, offset: number]> {
	growTo(writeCursor + size);
	const offset = writeCursor;
	writeCursor += size;
	// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple -- the sanctioned way to return one (see @rbxts/compiler-types' own `$tuple` doc comment).
	return $tuple(scratch, offset);
}

/** Resets the write cursor. Called once per top-level `serialize()`. */
export function beginWrite(): void {
	writeCursor = 0;
}

/** Copies the written region into an exact-size result buffer. */
export function finishWrite(): buffer {
	const result = buffer.create(writeCursor);
	buffer.copy(result, 0, scratch, 0, writeCursor);
	return result;
}

/**
 * Reserves `size` bytes at the read cursor and returns both the input
 * buffer and the offset to read at, mirroring {@link alloc}.
 */
// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple -- a real Luau multi-return, not a stored value; see the doc comment above.
export function readAlloc(size: number): LuaTuple<[buf: buffer, offset: number]> {
	const offset = readCursor;
	readCursor += size;
	// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple -- the sanctioned way to return one (see @rbxts/compiler-types' own `$tuple` doc comment).
	return $tuple(input, offset);
}

/** Sets the input buffer and resets the read cursor. Called once per top-level `deserialize()`. */
export function beginRead(inputBuffer: buffer): void {
	input = inputBuffer;
	readCursor = 0;
}

/**
 * Overwrites a previously-`alloc()`ed 4-byte region -- used to backpatch a
 * `dict` field's entry count, written up front as a placeholder and known
 * for real only after the write loop finishes (Transformer Design §4).
 * Reads the *current* scratch buffer rather than taking one as a parameter:
 * an arbitrary number of `alloc()` calls (and therefore buffer growths) can
 * happen between the placeholder write and this backpatch, and a `buffer`
 * reference captured before the loop could already be stale.
 */
export function backpatchU32(offset: number, value: number): void {
	buffer.writeu32(scratch, offset, value);
}
