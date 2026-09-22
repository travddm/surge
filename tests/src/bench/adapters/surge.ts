import type { Serializer } from "@rbxts/surge";

import type { Adapter } from "../adapter";

interface SurgePayload {
	buf: buffer;
	blobs: Array<defined>;
}

/**
 * surge's own driver: `createBinarySerializer<T>()` directly, which is what
 * a user writes. The blob array is the side table -- it holds the values the
 * buffer cannot carry (`Instance`, `unknown`, `any`), so it is empty for
 * every fixture whose shape has none.
 */
export function surgeAdapter<T>(serializer: Serializer<T>): Adapter<T> {
	return {
		encode: (value) => {
			const result = serializer.serialize(value);
			return {
				bytes: buffer.len(result.buffer),
				side: result.blobs.size(),
				payload: { buf: result.buffer, blobs: result.blobs } satisfies SurgePayload,
			};
		},
		decode: (payload) => {
			const { buf, blobs } = payload as SurgePayload;
			return serializer.deserialize(buf, blobs);
		},
	};
}
