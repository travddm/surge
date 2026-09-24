//!optimize 2
/**
 * How far a round trip moved a value, in the units of its own components.
 *
 * `difference` in ../support says *whether* a round trip lost something; this
 * says how much, which is what separates f32 rounding (about 1e-7 on a
 * rotation component) from an encoding that quantizes on purpose. The size
 * table needs both, because three libraries share its round-trip column
 * (section 5.2 of docs/specs/benchmark-harness.md).
 */

/** `undefined` on either side wins: it means "not expressible as a number". */
function worse(left: number | undefined, right: number | undefined): number | undefined {
	if (left === undefined || right === undefined) {
		return undefined;
	}
	return math.max(left, right);
}

/** Lune's native `vector` and Roblox's `Vector3` are one type in Roblox; see `difference`. */
function vectorComponents(value: unknown): Array<number> | undefined {
	if (typeIs(value, "Vector3")) {
		return [value.X, value.Y, value.Z];
	}
	if (typeOf(value) === "vector") {
		const native = value as unknown as { x: number; y: number; z: number };
		return [native.x, native.y, native.z];
	}
	return undefined;
}

/** `GetComponents` is a `LuaTuple`, which only destructuring turns into an array. */
function cframeComponents(value: CFrame): Array<number> {
	const [x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22] = value.GetComponents();
	return [x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22];
}

function maxOverComponents(expected: ReadonlyArray<number>, actual: ReadonlyArray<number>): number {
	let worst = 0;
	for (const index of $range(0, expected.size() - 1)) {
		worst = math.max(worst, math.abs(expected[index] - actual[index]));
	}
	return worst;
}

/**
 * The largest absolute difference between two values' numeric components, or
 * `undefined` when they differ in something no number describes -- a missing
 * key, another string, another variant. Walks the same structures
 * `difference` does.
 */
export function maxComponentError(expected: unknown, actual: unknown): number | undefined {
	if (typeIs(expected, "number") && typeIs(actual, "number")) {
		return math.abs(expected - actual);
	}
	if (typeIs(expected, "CFrame") && typeIs(actual, "CFrame")) {
		return maxOverComponents(cframeComponents(expected), cframeComponents(actual));
	}

	const expectedVector = vectorComponents(expected);
	if (expectedVector !== undefined) {
		const actualVector = vectorComponents(actual);
		return actualVector === undefined ? undefined : maxOverComponents(expectedVector, actualVector);
	}

	if (typeIs(expected, "table") && typeIs(actual, "table")) {
		const expectedTable = expected as Map<unknown, unknown>;
		const actualTable = actual as Map<unknown, unknown>;
		let worst: number | undefined = 0;
		for (const [key, value] of expectedTable) {
			worst = worse(worst, maxComponentError(value, actualTable.get(key)));
		}
		for (const [key] of actualTable) {
			if (!expectedTable.has(key)) {
				return undefined;
			}
		}
		return worst;
	}

	return expected === actual ? 0 : undefined;
}
