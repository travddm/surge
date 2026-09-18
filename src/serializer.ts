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
 * Replaced entirely by `rbxts-transformer-surge` at compile time (see
 * Transformer Design §1 in transformer.md). Calling this directly means the
 * transformer isn't registered for this project.
 */
export function createSerializer<T>(): (value: T) => { buffer: buffer; blobs: Array<defined> } {
	return notConfigured();
}

/** See {@link createSerializer}. */
export function createDeserializer<T>(): (input: buffer, inputBlobs?: Array<defined>) => T {
	return notConfigured();
}

/** See {@link createSerializer}. */
export function createBinarySerializer<T>(): Serializer<T> {
	return notConfigured();
}
