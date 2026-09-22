//!optimize 2
import type { Adapter } from "../adapter";
import type { BlinkCodec } from "../blink/server";

/**
 * Blink's driver: the `Write`/`Read` pair an `export`ed type generates, which
 * is the only part of its output that works as a bare serializer -- the rest
 * is its event layer, and the module wires that to real RemoteEvents when it
 * is required (see the stubs in scripts/lune-roblox-shim.luau).
 *
 * `side` is always zero: a Blink export cannot carry an `Instance` or an
 * `unknown`, which are the only things the other adapters put beside the
 * buffer.
 */
export function blinkAdapter<T>(codec: BlinkCodec<T>): Adapter<T> {
	return {
		encode: (value) => {
			const buf = codec.Write(value);
			return { bytes: buffer.len(buf), side: 0, payload: buf };
		},
		decode: (payload) => codec.Read(payload as buffer),
	};
}
