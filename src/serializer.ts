//!optimize 2
/** The bundled `serialize`/`deserialize` pair, matching fbs's `Serializer<T>` shape exactly. */
export interface Serializer<T> {
	serialize: (value: T) => { buffer: buffer; blobs: Array<defined> };
	deserialize: (input: buffer, inputBlobs?: Array<defined>) => T;
}

function notConfigured(): never {
	throw (
		"rbxts-transformer-surge is not registered in this project's tsconfig.json `plugins`. " +
		"createSerializer/createDeserializer/createBinarySerializer have no real implementation on " +
		"their own -- the transformer replaces every call to them at compile time."
	);
}

/**
 * Options read at the call site, where they must be written as literals: the
 * transformer decides what to emit from them at compile time.
 */
export interface SerializerOptions {
	/**
	 * Check, on every read, that `deserialize` stays inside the input buffer,
	 * and that a count it reads back is one the rest of the input could hold.
	 * A payload that fails either raises a string beginning `@rbxts/surge: `,
	 * so a caller `pcall`s at the boundary. Defaults to `false`.
	 *
	 * Turn it on wherever the bytes come from somewhere that is not trusted,
	 * which a remote event is and a `DataStore` of this game's own writing is
	 * not. It costs a branch per read. It checks lengths, counts, and the
	 * indexes that name an enum item or a packed rotation, and no other value:
	 * a payload that is the right shape but the wrong data still deserializes.
	 */
	readonly checks?: boolean;
	/**
	 * Check, on every write, that a value's lengths and counts fit its type:
	 * that a `DataType.Length<T, N>` value is exactly `N` long, and that a
	 * count fits the width `DataType.Length<T, L>` gives it. A value that does
	 * not raises a string beginning `@rbxts/surge: ` from `serialize`, where
	 * unchecked it would be padded, truncated, or have its count wrap. Defaults
	 * to `false`.
	 *
	 * It catches a value this game built wrong rather than input it was sent,
	 * so it costs a branch per container on the write side only.
	 */
	readonly writeChecks?: boolean;
}

/**
 * Replaced entirely by `rbxts-transformer-surge` at compile time (see
 * Runtime API 3.4 in docs/specs/runtime-api.md). Calling this directly means the
 * transformer isn't registered for this project.
 */
export function createSerializer<T>(
	options?: Pick<SerializerOptions, "writeChecks">,
): (value: T) => { buffer: buffer; blobs: Array<defined> } {
	return notConfigured();
}

/** See {@link createSerializer}. Takes the read side of {@link SerializerOptions}. */
export function createDeserializer<T>(
	options?: Pick<SerializerOptions, "checks">,
): (input: buffer, inputBlobs?: Array<defined>) => T {
	return notConfigured();
}

/** See {@link createSerializer}. Takes {@link SerializerOptions}. */
export function createBinarySerializer<T>(options?: SerializerOptions): Serializer<T> {
	return notConfigured();
}
