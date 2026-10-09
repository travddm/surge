//!optimize 2
import type { Adapter } from "../adapter";

/**
 * What `Flamework.createSerializer<T>()` returns in the experimental Flamework 2
 * (`@flamework-experimental/core`), for a `T` with no blob: `serialize` returns the buffer alone.
 * Its generated modules are under `codecs/`, beside a declaration of this type for each; see
 * Benchmark harness 4.10 in docs/specs/benchmark-harness.md.
 */
export interface Flamework2Serializer<T> {
	serialize: (value: T) => buffer;
	deserialize: (payload: buffer) => T;
}

/** The same for a `T` with a blob: `serialize` also returns the blob list, as a second value. */
export interface Flamework2BlobSerializer<T> {
	serialize: (value: T) => LuaTuple<[buffer, Array<defined>]>;
	deserialize: (payload: buffer, blobs: Array<defined>) => T;
}

/**
 * Flamework 2's driver for a shape with no blob. The buffer is the payload, and `decode` passes
 * it to `deserialize`, as its guide does (Benchmark harness 4.8).
 */
export function flamework2Adapter<T>(serializer: Flamework2Serializer<T>): Adapter<T> {
	return {
		encode: (value) => {
			const payload = serializer.serialize(value);
			return { bytes: buffer.len(payload), side: 0, payload };
		},
		decode: (payload) => serializer.deserialize(payload as buffer),
	};
}

/**
 * Flamework 2's driver for a shape with a blob. `serialize` returns the buffer and the list as two
 * values, so the payload is a table this adapter creates to carry both to `decode`: one table per
 * encode that no other column's adapter creates. A function apart from `flamework2Adapter`, so
 * that the other rows' timed calls create none.
 */
export function flamework2BlobAdapter<T>(serializer: Flamework2BlobSerializer<T>): Adapter<T> {
	return {
		encode: (value) => {
			const [payload, blobs] = serializer.serialize(value);
			return { bytes: buffer.len(payload), side: blobs.size(), payload: [payload, blobs] };
		},
		decode: (payload) => {
			const [bytes, blobs] = payload as [buffer, Array<defined>];
			return serializer.deserialize(bytes, blobs);
		},
	};
}
