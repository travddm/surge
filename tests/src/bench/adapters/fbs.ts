//!optimize 2
import type { Serializer } from "@rbxts/flamework-binary-serializer";

import type { Adapter } from "../adapter";

type FbsPayload = ReturnType<Serializer<unknown>["serialize"]>;

/**
 * fbs's driver: `createBinarySerializer<T>()` from
 * `@rbxts/flamework-binary-serializer`, whose surface surge is a drop-in
 * alternative to -- so this is surge's adapter, except that fbs returns a
 * `blobs` array for every shape. It stays a separate module because the two
 * libraries version independently. fbs reads the schema at runtime from the
 * metadata its Flamework macro emits, so the fixture modules must compile
 * through `rbxts-transformer-flamework` as well (they already do; see
 * tests/tsconfig.json).
 *
 * The result is the payload, and `decode` passes its two fields to
 * `deserialize`, as fbs's README does with them (Benchmark harness 4.8 in
 * docs/specs/benchmark-harness.md).
 */
export function fbsAdapter<T>(serializer: Serializer<T>): Adapter<T> {
	return {
		encode: (value) => {
			const result = serializer.serialize(value);
			return {
				bytes: buffer.len(result.buffer),
				side: result.blobs.size(),
				payload: result,
			};
		},
		decode: (payload) => {
			const result = payload as FbsPayload;
			return serializer.deserialize(result.buffer, result.blobs);
		},
	};
}
