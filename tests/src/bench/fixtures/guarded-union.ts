//!native
//!optimize 2
import { createBinarySerializer as createFbsSerializer } from "@rbxts/flamework-binary-serializer";
import createSerioSerializer from "@rbxts/serio";
import type * as Serio from "@rbxts/serio";
import { createCodec } from "@rbxts/surge";

import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { fbsAdapter } from "../adapters/fbs";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { zapAdapter } from "../adapters/zap";

const COUNT = 100;

/**
 * No discriminant field: each variant is told apart by a runtime guard. surge
 * and fbs share the shape, because both read a plain `number` as f64.
 */
interface GuardedUnion {
	values: Array<string | number | boolean>;
}

/**
 * serio reads a plain `number` as f32, so the number variant is branded
 * f64 here: the row measures how each library tags a variant, not what its
 * default numeric width costs.
 */
interface SerioGuardedUnion {
	values: Array<string | Serio.f64 | boolean>;
}

const serializer = createCodec<GuardedUnion>();
const serializerWithChecks = createCodec<GuardedUnion>({ readChecks: true });
const fbsSerializer = createFbsSerializer<GuardedUnion>();
const serioSerializer = createSerioSerializer<SerioGuardedUnion>();

const rng = new Rng(3301);
const values = new Array<string | number | boolean>();
for (const _ of $range(1, COUNT)) {
	const variant = rng.int(0, 2);
	if (variant === 0) {
		values.push(rng.str(16));
	} else if (variant === 1) {
		values.push(rng.f64());
	} else {
		values.push(rng.bool());
	}
}

export const guardedUnion: Fixture = {
	name: "guarded union",
	note: `${COUNT} values over string, number, and boolean`,
	entries: [
		defineEntry<GuardedUnion>("surge", { values }, surgeAdapter(serializer)),
		defineEntry<GuardedUnion>("surge (readChecks)", { values }, surgeAdapter(serializerWithChecks)),
		defineEntry<GuardedUnion>("fbs", { values }, fbsAdapter(fbsSerializer)),
		defineEntry<SerioGuardedUnion>("serio", { values }, serioAdapter(serioSerializer)),
		defineEntry(
			"zap",
			{ values },
			zapAdapter((zap) => zap.Guarded),
		),
	],
};
