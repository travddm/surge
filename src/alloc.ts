//!native
//!optimize 2
// Two Luau file pragmas. Both are honoured anywhere ahead of the first line of code, not only on
// line 1. Neither is worth anything on this module: both functions below run once per
// `serialize()` at most, and the per-field work they used to do is four instructions in the
// caller's own generated file now. `optimize 2` is the level a published place compiles at, where
// Studio compiles at 1, so it is what makes a profile taken in Studio a profile of what runs live,
// and every module this repository compiles carries it. See Native code generation in
// docs/future-work/generated-code-performance.md.
// This module owns no cursor and no buffer. A generated serializer declares
// its own scratch buffer, capacity and write cursor in the closure it is
// emitted into, so that reserving bytes is a compare and two moves inline
// rather than a call into this module (Transformer Design §4 in
// transformer.md). Measured, that call was the whole of the cost on a shape
// with one field per element: 2.64x on one row's decode.

/**
 * Doubles `current` until it holds `needed` bytes and copies the first `live`
 * across. Generated code calls this only on the reservation that runs past
 * the end of its buffer, which is once per doubling.
 *
 * Returns the new buffer; the caller re-reads `buffer.len` for its own
 * capacity rather than taking a second return value, because this is the cold
 * path and the caller's hot path is what the shape of this API is for.
 */
export function grow(current: buffer, live: number, needed: number): buffer {
	let capacity = buffer.len(current);
	while (capacity < needed) {
		capacity *= 2;
	}
	const grown = buffer.create(capacity);
	buffer.copy(grown, 0, current, 0, live);
	return grown;
}

/**
 * Copies the first `size` bytes of `written` into an exact-size result
 * buffer. Called once per top-level `serialize()`, which is why it is still a
 * call: measured at 1.00x, both as a cost of its own and as one more call per
 * serialize.
 */
export function finishWrite(written: buffer, size: number): buffer {
	const result = buffer.create(size);
	buffer.copy(result, 0, written, 0, size);
	return result;
}
