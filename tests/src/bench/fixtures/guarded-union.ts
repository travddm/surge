import { createBinarySerializer } from "@rbxts/surge";

import { Rng } from "../../support";
import { defineFixture } from "../adapter";
import { surgeAdapter } from "../adapters/surge";

const COUNT = 100;

/** No discriminant field: each variant is told apart by a runtime guard. */
interface GuardedUnion {
	values: Array<string | number | boolean>;
}

const serializer = createBinarySerializer<GuardedUnion>();

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

export const guardedUnion = defineFixture<GuardedUnion>(
	"guarded union",
	`${COUNT} values over string, number, and boolean`,
	{ values },
	surgeAdapter(serializer),
);
