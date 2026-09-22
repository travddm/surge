import type { SerializedData, Serializer } from "@rbxts/serio";

import type { Adapter } from "../adapter";

/**
 * serio's driver: `createSerializer<T>()`, whose `serialize` returns one
 * `SerializedData` record rather than a buffer and a blob array. Both of its
 * fields are optional -- a shape that costs zero bytes leaves `buf`
 * undefined, and one with nothing for the side table leaves `blobs`
 * undefined -- so a missing field is zero here, not an error.
 */
export function serioAdapter<T>(serializer: Serializer<T>): Adapter<T> {
	return {
		encode: (value) => {
			const data = serializer.serialize(value);
			return {
				bytes: data.buf === undefined ? 0 : buffer.len(data.buf),
				side: data.blobs === undefined ? 0 : data.blobs.size(),
				payload: data,
			};
		},
		decode: (payload) => serializer.deserialize(payload as SerializedData),
	};
}
