//!optimize 2
import type { Cursor, CursorCodec } from "@rbxts/surge";
import { createCursor } from "@rbxts/surge";

import type { Adapter } from "../adapter";

/**
 * surge's cursor codec (Runtime API 3.15 in docs/specs/runtime-api.md),
 * writing every value into one `Cursor` it reuses, as a caller that writes
 * batch after batch does: each encode starts the cursor at its head, so the
 * buffer keeps the room an earlier write grew it to and no call allocates
 * one. The blob list is emptied only where a write filled it.
 *
 * The payload is that cursor, which `decode` starts at its head again and
 * reads (Benchmark harness 4.14 in docs/specs/benchmark-harness.md). Sharing
 * it reads the right bytes because every encode writes the one sample value
 * the row has.
 */
export function cursorAdapter<T>(codec: CursorCodec<T>): Adapter<T> {
	const cursor = createCursor();
	return {
		encode: (value) => {
			cursor.offset = 0;
			if (cursor.blobs.size() > 0) {
				table.clear(cursor.blobs);
			}
			codec.write(cursor, value);
			return { bytes: cursor.offset, side: cursor.blobs.size(), payload: cursor };
		},
		decode: (payload) => {
			const input = payload as Cursor;
			input.offset = 0;
			input.blobIndex = 0;
			return codec.read(input);
		},
	};
}
