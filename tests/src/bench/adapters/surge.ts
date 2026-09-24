//!optimize 2
import type { Serialized, Serializer } from "@rbxts/surge";

import type { Adapter } from "../adapter";

/**
 * surge's own driver: `createBinarySerializer<T>()` directly, which is what
 * a user writes. The blob array is the side table -- it holds the values the
 * buffer cannot carry (`Instance`, `unknown`, `any`), and `serialize` returns
 * none for a fixture whose shape has none.
 *
 * The result is the payload, and `decode` passes its two fields to
 * `deserialize`, as docs/getting-started.md does with them. Copying them
 * into a table of the adapter's own would time work a user does not do
 * (Benchmark harness 4.8 in docs/specs/benchmark-harness.md).
 */
export function surgeAdapter<T>(serializer: Serializer<T>): Adapter<T> {
	return {
		encode: (value) => {
			const result = serializer.serialize(value);
			return {
				bytes: buffer.len(result.buffer),
				side: result.blobs === undefined ? 0 : result.blobs.size(),
				payload: result,
			};
		},
		decode: (payload) => {
			const result = payload as Serialized<T>;
			return serializer.deserialize(result.buffer, result.blobs);
		},
	};
}
