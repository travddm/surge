//!optimize 2
import type { Serializer } from "@rbxts/surge";

import type { Adapter } from "../adapter";

/** What `serialize` returns for a shape that can hold a blob. */
interface WithBlobs {
	buffer: buffer;
	blobs: Array<defined>;
}

/**
 * surge's own driver: `createBinarySerializer<T>()` directly, which is what
 * a user writes. The blob array is the side table -- it holds the values the
 * buffer cannot carry (`Instance`, `unknown`, `any`) -- and `serialize`
 * returns the buffer alone for a fixture whose shape can hold none.
 *
 * What `serialize` returns is the payload, and `decode` passes it to
 * `deserialize` as docs/getting-started.md does: the buffer, or the table's
 * two fields (Benchmark harness 4.8 in docs/specs/benchmark-harness.md). `T`
 * is unknown here, so `typeIs` tells the two apart, as any generic caller must.
 */
export function surgeAdapter<T>(serializer: Serializer<T>): Adapter<T> {
	return {
		encode: (value) => {
			const result = serializer.serialize(value);
			if (typeIs(result, "buffer")) {
				return { bytes: buffer.len(result), side: 0, payload: result };
			}
			const { buffer: bytes, blobs } = result as WithBlobs;
			return { bytes: buffer.len(bytes), side: blobs.size(), payload: result };
		},
		decode: (payload) => {
			if (typeIs(payload, "buffer")) {
				return serializer.deserialize(payload);
			}
			const { buffer: bytes, blobs } = payload as WithBlobs;
			return serializer.deserialize(bytes, blobs);
		},
	};
}
