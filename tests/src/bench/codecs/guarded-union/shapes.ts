import type * as Serio from "@rbxts/serio";

/**
 * No discriminant field: each variant is told apart by a runtime guard. surge
 * and fbs share the shape, because both read a plain `number` as f64.
 */
export interface GuardedUnion {
	values: Array<string | number | boolean>;
}

/**
 * serio reads a plain `number` as f32, so the number variant is branded
 * f64 here: the row measures how each library tags a variant, not what its
 * default numeric width costs.
 */
export interface SerioGuardedUnion {
	values: Array<string | Serio.f64 | boolean>;
}
