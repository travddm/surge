//!optimize 2
import type { Adapter } from "../adapter";

/** What `serialize` returns for a shape that can hold a blob. */
interface WithBlobs {
	buffer: buffer;
	blobs: Array<defined>;
}

/**
 * surge's own driver: `createCodec<T>()` directly, which is what a user
 * writes. The blob array is the side table -- it holds the values the buffer
 * cannot carry (`Instance`, `unknown`, `any`) -- and `serialize` returns the
 * buffer alone for a fixture whose shape can hold none.
 *
 * What `serialize` returns is the payload, and `decode` passes it to
 * `deserialize` unchanged, as docs/getting-started.md does (Benchmark harness
 * 4.8 in docs/specs/benchmark-harness.md). `T` is unknown here, so `encode`
 * tells the two shapes apart with `typeIs` to count the bytes and the blobs.
 *
 * The payload's type `P` is a parameter of its own, inferred at each fixture
 * from its `Codec<T>`, where `Serialized<T>` resolves. Named here for an
 * unknown `T`, the checker expands `Serialized<T>` until it reports the
 * instantiation as too deep.
 */
export function surgeAdapter<T, P extends buffer | WithBlobs>(codec: {
	serialize: (value: T) => P;
	deserialize: (input: P) => T;
}): Adapter<T> {
	return {
		encode: (value) => {
			const result = codec.serialize(value);
			if (typeIs(result, "buffer")) {
				return { bytes: buffer.len(result), side: 0, payload: result };
			}
			const { buffer: bytes, blobs } = result as WithBlobs;
			return { bytes: buffer.len(bytes), side: blobs.size(), payload: result };
		},
		decode: (payload) => codec.deserialize(payload as P),
	};
}
