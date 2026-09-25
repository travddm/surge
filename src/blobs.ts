//!native
//!optimize 2
// Native code generation, and an optimization level pinned rather than inherited; neither is
// worth anything here on its own. See the package pragma entry in
// docs/future-work/generated-code-performance.md.
// The blob/passthrough side-channel (section 9 of
// docs/specs/wire-format.md). Values pushed here are never written into the
// buffer; both sides must agree on push/read order, which is the generated
// code's responsibility (encounter order), not this module's.
let writeBlobs: Array<defined> = [];

let readBlobs: Array<defined> | undefined;
let readIndex = 0;

/** Resets the write-side blob list. Called once per top-level `serialize()` of a type with a blob field. */
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

/**
 * Sets the input blob list and resets the read index. Called once per top-level
 * `deserialize()` of a type with a blob field.
 */
export function beginReadBlobs(blobs: Array<defined> | undefined): void {
	readBlobs = blobs;
	readIndex = 0;
}

/** Reads the next blob in encounter order. */
export function nextBlob(): defined {
	const blobs = readBlobs;
	if (blobs === undefined) {
		throw "@rbxts/surge: deserialize() encountered a blob field but its input has no blobs array";
	}
	if (readIndex >= blobs.size()) {
		throw "@rbxts/surge: deserialize read past the end of the blobs array";
	}
	const value = blobs[readIndex];
	readIndex += 1;
	return value;
}
