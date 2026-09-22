import { difference } from "../support";
import { maxComponentError } from "./max-error";

/**
 * One library's driver for one shape, per the harness plan in
 * docs/future-work/benchmark-tooling.md. `bytes` is the wire payload;
 * `side` is the number of entries the library passes outside that payload
 * (surge's and fbs's blob array, serio's), which cost bandwidth the buffer
 * does not show. `payload` is whatever `decode` needs back, so the two
 * halves stay opaque to the harness.
 */
export interface Adapter<T> {
	encode: (value: T) => Encoded;
	decode: (payload: unknown) => T;
}

/** What one `encode` produced: its cost, and whatever its `decode` needs back. */
export interface Encoded {
	bytes: number;
	side: number;
	payload: unknown;
}

/**
 * A column of the size table: the four comparison libraries, surge itself,
 * and the hand-written baseline, which is not a library at all but is driven
 * through the same interface (see Benchmarking strategy in docs/testing.md).
 */
export type Library = "surge" | "fbs" | "serio" | "blink" | "zap" | "baseline";

/**
 * Column order of `docs/benchmarks/size.md`. surge comes first: the other
 * columns carry their ratio against it.
 */
export const LIBRARIES: ReadonlyArray<Library> = ["surge", "fbs", "serio", "blink", "zap", "baseline"];

/**
 * Libraries the speed suite skips. Zap has no callable encoder: its bytes
 * come from firing one event at the mocked RemoteEvent the Lune runner
 * provides, which the real Roblox process the speed tier runs in does not
 * have, and an encode timed through the event path would measure batching
 * and the mock as much as the encoder. Its generated module cannot even be
 * required there -- it errors on a client, and Studio's edit mode answers
 * true to both `IsClient` and `IsServer` -- which is why `defineEntry`
 * builds a size-only entry on first use rather than at import. See
 * docs/future-work/benchmark-tooling.md.
 */
export const SIZE_ONLY: ReadonlyArray<Library> = ["zap"];

/** What one fixture costs under one library. */
export interface Measurement {
	bytes: number;
	side: number;
	/** The first difference between the value and its round trip, or `undefined` when they are equal. */
	roundTrip: string | undefined;
	/**
	 * How far the round trip moved the value's worst component, `0` when it
	 * did not, and `undefined` when the two differ in something no number
	 * describes. It separates f32 rounding from a quantized encoding.
	 */
	maxError: number | undefined;
}

/**
 * One library's half of one catalog row. `encode` and `decode` are the two
 * halves the speed suite times; they discard their results, exactly as the
 * methodology in benchmark-tooling.md requires.
 */
export interface Entry {
	library: Library;
	measure: () => Measurement;
	encode: () => void;
	decode: () => void;
}

/**
 * A catalog row: one shape, measured once per library that can express it.
 * The shape types are erased here, so one array holds every row.
 */
export interface Fixture {
	name: string;
	/** What the row is for: one line, printed as the table's last column. */
	note: string;
	entries: ReadonlyArray<Entry>;
}

/**
 * Closes one library's half of a row over its shape type, so a `Fixture` is
 * a plain value and no caller has to name the shape again. Each library
 * brands its widths with its own type aliases, so a row declares its shape
 * once per library; `value` is the same sample for all of them, except
 * where a library cannot express the shape the others take (the large
 * record, which fbs and serio can only hold as a `Map`).
 */
export function defineEntry<T>(library: Library, value: T, adapter: Adapter<T>): Entry {
	if (SIZE_ONLY.includes(library)) {
		return deferredEntry(library, value, adapter);
	}

	// Encoded once here, not per timed iteration: the decode timing must not
	// include the encode it reads from.
	const encoded = adapter.encode(value);
	return {
		library,
		measure: () => measurementOf(value, adapter, encoded),
		encode: () => {
			adapter.encode(value);
		},
		decode: () => {
			adapter.decode(encoded.payload);
		},
	};
}

function measurementOf<T>(value: T, adapter: Adapter<T>, encoded: Encoded): Measurement {
	const decoded = adapter.decode(encoded.payload);
	return {
		bytes: encoded.bytes,
		side: encoded.side,
		roundTrip: difference(value, decoded),
		maxError: maxComponentError(value, decoded),
	};
}

/**
 * The same row for a library the speed suite skips, with the first encode put
 * off until a tier asks for a number. Loading a fixture then costs nothing but
 * the closure, which is what lets the speed tier load the catalog in a real
 * Roblox process, where Zap's module cannot be required at all.
 *
 * Only a size-only library gets this: the two timed halves above have to stay
 * free of the readiness check this needs, which on the fastest rows would be a
 * measurable part of what they report.
 */
function deferredEntry<T>(library: Library, value: T, adapter: Adapter<T>): Entry {
	let encoded: Encoded | undefined;
	const encodeOnce = (): Encoded => {
		if (encoded === undefined) {
			encoded = adapter.encode(value);
		}
		return encoded;
	};

	return {
		library,
		measure: () => measurementOf(value, adapter, encodeOnce()),
		encode: () => {
			adapter.encode(value);
		},
		decode: () => {
			adapter.decode(encodeOnce().payload);
		},
	};
}
