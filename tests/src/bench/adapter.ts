import { difference } from "../support";

/**
 * One library's driver for one shape, per the harness plan in
 * docs/future-work/benchmark-tooling.md. `bytes` is the wire payload;
 * `side` is the number of entries the library passes outside that payload
 * (surge's blob array, and the equivalent in fbs and serio), which cost
 * bandwidth the buffer does not show. `payload` is whatever `decode` needs
 * back, so the two halves stay opaque to the harness.
 */
export interface Adapter<T> {
	encode: (value: T) => { bytes: number; side: number; payload: unknown };
	decode: (payload: unknown) => T;
}

/** What one fixture costs under one library. */
export interface Measurement {
	bytes: number;
	side: number;
	/** The first difference between the value and its round trip, or `undefined` when they are equal. */
	roundTrip: string | undefined;
}

/**
 * A catalog row with its shape type erased, so one array holds every shape.
 * `encode` and `decode` are the two halves the speed suite times; they
 * discard their results, exactly as the methodology in
 * benchmark-tooling.md requires.
 */
export interface Fixture {
	name: string;
	/** What the row is for: one line, printed as the table's last column. */
	note: string;
	measure: () => Measurement;
	encode: () => void;
	decode: () => void;
}

/**
 * Closes a fixture over its shape type. Every fixture module calls this and
 * exports the result, so the catalog is a plain `Array<Fixture>` and no
 * caller has to name the shape again.
 */
export function defineFixture<T>(name: string, note: string, value: T, adapter: Adapter<T>): Fixture {
	// Encoded once here, not per timed iteration: the decode timing must not
	// include the encode it reads from.
	const encoded = adapter.encode(value);
	return {
		name,
		note,
		measure: () => ({
			bytes: encoded.bytes,
			side: encoded.side,
			roundTrip: difference(value, adapter.decode(encoded.payload)),
		}),
		encode: () => {
			adapter.encode(value);
		},
		decode: () => {
			adapter.decode(encoded.payload);
		},
	};
}
