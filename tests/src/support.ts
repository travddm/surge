//!optimize 2
import { createBinarySerializer } from "@rbxts/surge";

// Lives next to `bench/`, not in `src/tests/`, so that directory holds suites only.

function describe(value: unknown): string {
	return `${tostring(value)} (${typeOf(value)})`;
}

/**
 * Returns the path and values of the first difference between two values, or
 * `undefined` when they are equal. Compares tables by content (arrays,
 * objects, `Map`, `Set`; keys by identity), buffers by their bytes, and every
 * other value with `==`, except that `NaN` equals `NaN` and `0` does not equal
 * `-0`, which `==` gets wrong for a round-trip check.
 */
export function difference(expected: unknown, actual: unknown, path = "value"): string | undefined {
	if (typeIs(expected, "number") && typeIs(actual, "number")) {
		const bothNaN = expected !== expected && actual !== actual;
		const sameSign = 1 / expected === 1 / actual;
		return bothNaN || (expected === actual && sameSign)
			? undefined
			: `${path}: expected ${describe(expected)}, got ${describe(actual)}`;
	}
	if (typeIs(expected, "buffer") && typeIs(actual, "buffer")) {
		return buffer.tostring(expected) === buffer.tostring(actual)
			? undefined
			: `${path}: expected the bytes ${hex(expected)}, got ${hex(actual)}`;
	}
	// Lune keeps Luau's native `vector` and Roblox's `Vector3` apart, where
	// Roblox has one type: `vector.create(x, y, z)` there is a `Vector3`. serio
	// reads every vector field back through `vector.create` (it branches on
	// `IS_LUNE` itself for the same reason), so under the Lune runner a decoded
	// vector that differs from the input only in which of the two it is has
	// round-tripped exactly.
	if (typeIs(expected, "Vector3") && typeOf(actual) === "vector") {
		const native = actual as unknown as { x: number; y: number; z: number };
		return (
			difference(expected.X, native.x, `${path}.X`) ??
			difference(expected.Y, native.y, `${path}.Y`) ??
			difference(expected.Z, native.z, `${path}.Z`)
		);
	}
	if (typeIs(expected, "table") && typeIs(actual, "table")) {
		const expectedTable = expected as Map<unknown, unknown>;
		const actualTable = actual as Map<unknown, unknown>;
		for (const [key, value] of expectedTable) {
			const inner = difference(value, actualTable.get(key), `${path}[${tostring(key)}]`);
			if (inner !== undefined) {
				return inner;
			}
		}
		for (const [key, value] of actualTable) {
			if (!expectedTable.has(key)) {
				return `${path}[${tostring(key)}]: expected nothing, got ${describe(value)}`;
			}
		}
		return undefined;
	}
	return expected === actual ? undefined : `${path}: expected ${describe(expected)}, got ${describe(actual)}`;
}

/** The bytes of a buffer as lowercase hex, two digits per byte, for exact wire-format assertions. */
export function hex(buf: buffer): string {
	const parts = new Array<string>();
	for (const i of $range(0, buffer.len(buf) - 1)) {
		parts.push(string.format("%02x", buffer.readu8(buf, i)));
	}
	return parts.join("");
}

/** {@link hex} in reverse, for handing `deserialize` bytes no `serialize` would write. */
export function unhex(digits: string): buffer {
	const result = buffer.create(digits.size() / 2);
	for (const i of $range(0, buffer.len(result) - 1)) {
		buffer.writeu8(result, i, tonumber(digits.sub(i * 2 + 1, i * 2 + 2), 16)!);
	}
	return result;
}

const PARK_MILLER_MODULUS = 2147483647;
const PARK_MILLER_MULTIPLIER = 48271;

/**
 * A seeded generator for the fuzz loops, so a failure reproduces. Not
 * `Random`: Lune does not provide it. The Park-Miller product stays below
 * 2^53, so the sequence is exact and the same on every Luau runtime.
 */
export class Rng {
	private state: number;

	constructor(seed: number) {
		this.state = seed;
	}

	/** A number in [0, 1). */
	public next(): number {
		this.state = (this.state * PARK_MILLER_MULTIPLIER) % PARK_MILLER_MODULUS;
		return (this.state - 1) / (PARK_MILLER_MODULUS - 1);
	}

	/** An integer in [min, max]. */
	public int(min: number, max: number): number {
		return min + math.floor(this.next() * (max - min + 1));
	}

	public bool(): boolean {
		return this.next() < 0.5;
	}

	/**
	 * A number that an `f32` holds exactly (a multiple of 1/8 below 2^13), so a
	 * value stored as `f32` still compares equal after the round trip.
	 */
	public f32(): number {
		return this.int(-65536, 65535) / 8;
	}

	public f64(): number {
		return (this.next() - 0.5) * 1e12;
	}

	/** A byte string of 0 to `maxLength` arbitrary bytes, including `\0` and bytes that are not valid UTF-8. */
	public str(maxLength = 12): string {
		const bytes = new Array<number>();
		for (const _ of $range(1, this.int(0, maxLength))) {
			bytes.push(this.int(0, 255));
		}
		return string.char(...bytes);
	}

	public pick<T extends defined>(values: ReadonlyArray<T>): T {
		return values[this.int(0, values.size() - 1)];
	}
}

/**
 * Transformer 3.4 in docs/specs/transformer.md: two call sites for one type
 * must produce the same bytes. `factories.spec.ts` has the second call site for this type.
 */
export interface SharedShape {
	zebra: number;
	apple: string;
	mango: boolean[];
	kind: "left" | "right";
}
export const sharedShapeSerializer = createBinarySerializer<SharedShape>();
