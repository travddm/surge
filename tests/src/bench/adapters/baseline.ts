//!optimize 2
import type { Adapter } from "../adapter";
import type { BaselineBlobCodec, BaselineCodec, WithBlobs } from "../baseline/codecs";

/**
 * The hand-written baseline's driver. There is no library here and nothing to
 * configure: the codec is a pair of functions written for one shape, and the
 * column exists to show what surge's generated code costs above the fewest
 * instructions that shape needs. See section 4.5 of
 * docs/specs/benchmark-harness.md.
 *
 * `side` is zero: the shapes it drives hold nothing a buffer cannot.
 * `baselineBlobAdapter` drives the one that does.
 */
export function baselineAdapter<T>(codec: BaselineCodec<T>): Adapter<T> {
	return {
		encode: (value) => {
			const buf = codec.write(value);
			return { bytes: buffer.len(buf), side: 0, payload: buf };
		},
		decode: (payload) => codec.read(payload as buffer),
	};
}

/**
 * The baseline's driver for a shape with values a buffer cannot hold. The
 * codec passes them beside the bytes in the order surge does, so `side` is
 * their count. A function apart from `baselineAdapter`, so that the other
 * rows' timed calls make no check of what the codec returned.
 */
export function baselineBlobAdapter<T>(codec: BaselineBlobCodec<T>): Adapter<T> {
	return {
		encode: (value) => {
			const result = codec.write(value);
			return { bytes: buffer.len(result.buffer), side: result.blobs.size(), payload: result };
		},
		decode: (payload) => codec.read(payload as WithBlobs),
	};
}
