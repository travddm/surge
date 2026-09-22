import type { Serializer } from "@rbxts/flamework-binary-serializer";

import type { Adapter } from "../adapter";

interface FbsPayload {
	buf: buffer;
	blobs: Array<defined>;
}

/**
 * fbs's driver: `createBinarySerializer<T>()` from
 * `@rbxts/flamework-binary-serializer`, whose surface surge is a drop-in
 * alternative to -- so this is surge's adapter with one import changed. It
 * stays a separate module because the two libraries version independently.
 * fbs reads the schema at runtime from the metadata its Flamework macro
 * emits, so the fixture modules must compile through
 * `rbxts-transformer-flamework` as well (they already do; see
 * tests/tsconfig.json).
 */
export function fbsAdapter<T>(serializer: Serializer<T>): Adapter<T> {
	return {
		encode: (value) => {
			const result = serializer.serialize(value);
			return {
				bytes: buffer.len(result.buffer),
				side: result.blobs.size(),
				payload: { buf: result.buffer, blobs: result.blobs } satisfies FbsPayload,
			};
		},
		decode: (payload) => {
			const { buf, blobs } = payload as FbsPayload;
			return serializer.deserialize(buf, blobs);
		},
	};
}
