// The blob/passthrough side-channel (Type Coverage -> Blob / passthrough
// channel in transformer.md). Values pushed here are never written into the
// buffer; both sides must agree on push/read order, which is the generated
// code's responsibility (encounter order), not this module's.
let writeBlobs: Array<defined> = [];

let readBlobs: Array<defined> | undefined;
let readIndex = 0;

/** Resets the write-side blob list. Called once per top-level `serialize()`. */
export function beginWriteBlobs(): void {
	writeBlobs = [];
}

/** Pushes a blob in encounter order. */
export function pushBlob(value: defined): void {
	writeBlobs.push(value);
}

/** Returns the blobs collected by the just-finished `serialize()` call. */
export function finishWriteBlobs(): Array<defined> {
	return writeBlobs;
}

/** Sets the input blob list and resets the read index. Called once per top-level `deserialize()`. */
export function beginReadBlobs(blobs: Array<defined> | undefined): void {
	readBlobs = blobs;
	readIndex = 0;
}

/** Reads the next blob in encounter order. */
export function nextBlob(): defined {
	const blobs = readBlobs;
	if (blobs === undefined) {
		throw "@rbxts/surge: deserialize() encountered a blob field but no inputBlobs array was provided";
	}
	const value = blobs[readIndex];
	readIndex += 1;
	return value;
}
