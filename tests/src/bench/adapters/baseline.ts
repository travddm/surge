import type { Adapter } from "../adapter";
import type { BaselineCodec } from "../baseline/codecs";

/**
 * The hand-written baseline's driver. There is no library here and nothing to
 * configure: the codec is a pair of functions written for one shape, and the
 * column exists to show what surge's generated code costs above the fewest
 * instructions that shape needs. See Benchmarking strategy in
 * docs/testing.md.
 *
 * `side` is always zero. A hand-written codec for a fixed shape has no side
 * table, because it has nothing it cannot encode.
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
